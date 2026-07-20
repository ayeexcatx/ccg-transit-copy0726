import { useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useConfirmationsQuery } from './useConfirmationsQuery';
import { getNotificationEffectiveReadFlag } from './ownerActionStatus';
import { notifyOwnerDriverSeen } from './createNotifications';
import { getEffectiveView } from '@/components/session/workspaceUtils';
import {
  canUserSeeNotification,
  getDriverDispatchIdSet,
  normalizeVisibilityId,
} from '@/lib/dispatchVisibility';
import { resolveCompanyOwnerCompanyId, resolveDriverIdentity } from '@/services/currentAppIdentityService';
import { listDriverDispatchesForDriver } from '@/lib/driverDispatch';
import { appendDispatchActivityEntries, getSessionActorName } from '@/lib/dispatchActivity';

function getDriverNotificationSeenKind(notification, dispatch = null) {
  const notificationType = String(notification?.notification_type || '').toLowerCase();
  if (notificationType === 'driver_removed') return 'removed';
  if (notificationType === 'driver_amended') return 'amended';
  if (notificationType === 'driver_cancelled') return 'cancelled';

  const normalizedStatus = String(dispatch?.status || '').toLowerCase();
  if (normalizedStatus === 'amended') return 'amended';
  if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') return 'cancelled';
  return 'assigned';
}

function buildSharedOwnerNotificationEventKey(notification) {
  const category = String(notification?.notification_category || 'uncategorized').toLowerCase();
  const dispatchId = String(notification?.related_dispatch_id || 'none');
  const notificationType = String(notification?.notification_type || 'none').toLowerCase();
  const recipientType = String(notification?.recipient_type || '').toLowerCase();
  const companyId = String(notification?.recipient_company_id || 'none');
  const requiredTrucks = Array.isArray(notification?.required_trucks)
    ? [...notification.required_trucks].filter(Boolean).map(String).sort().join(',')
    : '';
  const dispatchStatusKey = String(notification?.dispatch_status_key || '').trim();
  const normalizedDispatchStatusKey = dispatchStatusKey
    ? dispatchStatusKey.replace(/:[^:]+$/, '')
    : '';
  const message = String(notification?.message || '').trim().toLowerCase();
  const title = String(notification?.title || '').trim().toLowerCase();
  const isDriverSeenSharedOwnerEvent = category === 'driver_dispatch_seen' && recipientType === 'accesscode';

  if (isDriverSeenSharedOwnerEvent) {
    return `owner:${companyId}:driver_dispatch_seen:${dispatchId}:${notificationType}:${normalizedDispatchStatusKey}:${requiredTrucks}`;
  }

  if (recipientType !== 'accesscode') {
    return `${recipientType}:${category}:${dispatchId}:${notificationType}:${normalizedDispatchStatusKey}:${requiredTrucks}:${message}:${title}`;
  }

  return `owner:${companyId}:${category}:${dispatchId}:${notificationType}:${normalizedDispatchStatusKey}:${requiredTrucks}:${message}:${title}`;
}

export function useOwnerNotifications(session) {
  const { currentAppIdentity } = useAuth();
  const queryClient = useQueryClient();
  const pendingDriverSeenKeysRef = useRef(new Set());
  const driverIdentity = resolveDriverIdentity({ currentAppIdentity, session });
  const effectiveView = getEffectiveView(session);
  const isDriver = effectiveView === 'Driver';
  const isOwner = effectiveView === 'CompanyOwner';
  const isAdmin = effectiveView === 'Admin';
  const ownerWorkspaceCompanyId = resolveCompanyOwnerCompanyId({ currentAppIdentity, session });
  const notificationScopeCompanyId = isOwner ? ownerWorkspaceCompanyId : null;

  const queryKey = useMemo(() => [
    'notifications',
    session?.id || null,
    effectiveView || null,
    session?.raw_code_type || null,
    notificationScopeCompanyId || null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [session?.id, effectiveView, session?.raw_code_type, notificationScopeCompanyId]);

  const { data: rawNotifications = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!session) return [];
      if (!['Admin', 'CompanyOwner', 'Driver'].includes(effectiveView)) return [];
      if (isAdmin) {
        return base44.entities.Notification.filter({ recipient_type: 'Admin' }, '-created_date', 200);
      }

      const isAdminOwnerWorkspace = isOwner && session.raw_code_type === 'Admin';
      if (isAdminOwnerWorkspace && notificationScopeCompanyId) {
        const [allAccessCodeNotifications, ownerCodes] = await Promise.all([
          base44.entities.Notification.filter({ recipient_type: 'AccessCode' }, '-created_date', 200),
          base44.entities.AccessCode.filter({
            code_type: 'CompanyOwner',
            active_flag: true,
            company_id: notificationScopeCompanyId,
          }, '-created_date', 500),
        ]);

        const ownerCodeIdSet = new Set((ownerCodes || []).map((code) => String(code.id)));
        return (allAccessCodeNotifications || []).filter((notification) => {
          const recipientId = String(notification.recipient_access_code_id || notification.recipient_id || '');
          return ownerCodeIdSet.has(recipientId);
        });
      }

      const isOwnerWorkspace = isOwner && session.raw_code_type !== 'Admin';
      if (isOwnerWorkspace && notificationScopeCompanyId) {
        const [allAccessCodeNotifications, ownerCodes] = await Promise.all([
          base44.entities.Notification.filter({ recipient_type: 'AccessCode' }, '-created_date', 200),
          base44.entities.AccessCode.filter({
            code_type: 'CompanyOwner',
            active_flag: true,
            company_id: notificationScopeCompanyId,
          }, '-created_date', 500),
        ]);

        const ownerCodeIdSet = new Set((ownerCodes || []).map((code) => String(code.id)));
        return (allAccessCodeNotifications || []).filter((notification) => {
          const recipientId = String(notification.recipient_access_code_id || notification.recipient_id || '');
          if (ownerCodeIdSet.has(recipientId)) return true;
          const sessionId = String(session?.id || '');
          return sessionId.length > 0 && recipientId === sessionId;
        });
      }

      const all = await base44.entities.Notification.filter({ recipient_type: 'AccessCode' }, '-created_date', 200);
      return all.filter((notification) => {
        const recipientAccessCodeId = String(notification?.recipient_access_code_id || '');
        const recipientId = String(notification?.recipient_id || '');
        const sessionId = String(session?.id || '');
        return recipientAccessCodeId === sessionId || recipientId === sessionId;
      });
    },
    enabled: !!session,
    refetchInterval: 30000,
  });

  const { data: driverAssignments = [] } = useQuery({
    queryKey: ['driver-dispatch-assignments', driverIdentity],
    queryFn: () => listDriverDispatchesForDriver(driverIdentity),
    enabled: isDriver && !!driverIdentity,
  });

  const { data: confirmations = [] } = useConfirmationsQuery(isOwner, notificationScopeCompanyId);
  const { data: ownerCompany = null } = useQuery({
    queryKey: ['owner-company-notification-scope', notificationScopeCompanyId],
    queryFn: async () => {
      if (!notificationScopeCompanyId) return null;
      const companies = await base44.entities.Company.filter({ id: notificationScopeCompanyId }, '-created_date', 1);
      return companies?.[0] || null;
    },
    enabled: isOwner && !!notificationScopeCompanyId,
  });

  const { data: dispatches = [] } = useQuery({
    queryKey: ['portal-dispatches', notificationScopeCompanyId],
    queryFn: () => base44.entities.Dispatch.filter({ company_id: notificationScopeCompanyId }, '-date', 200),
    enabled: !!notificationScopeCompanyId && !isAdmin,
  });

  const driverDispatchIds = getDriverDispatchIdSet(driverAssignments);
  const validDispatchIds = new Set(dispatches.map((dispatch) => normalizeVisibilityId(dispatch.id)));

  const dispatchById = new Map(
    dispatches.map((dispatch) => [normalizeVisibilityId(dispatch.id), dispatch])
  );

  const notifications = useMemo(() => rawNotifications
    .filter((notification) => canUserSeeNotification(session, notification, {
      visibleDispatchIds: validDispatchIds,
      driverDispatchIds,
    }))
    .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rawNotifications, session, validDispatchIds, driverDispatchIds]);

  const notificationsForDisplay = useMemo(() => {
    if (!isOwner) return notifications;

    const dedupedByEvent = new Map();
    notifications.forEach((notification) => {
      const eventKey = buildSharedOwnerNotificationEventKey(notification);
      const current = dedupedByEvent.get(eventKey);
      if (!current) {
        dedupedByEvent.set(eventKey, notification);
        return;
      }

      const currentRead = current.read_flag === true;
      const nextRead = notification.read_flag === true;
      if (currentRead && !nextRead) {
        dedupedByEvent.set(eventKey, notification);
        return;
      }

      if (currentRead === nextRead) {
        const currentCreatedAt = new Date(current.created_date || 0).getTime();
        const nextCreatedAt = new Date(notification.created_date || 0).getTime();
        if (nextCreatedAt > currentCreatedAt) {
          dedupedByEvent.set(eventKey, notification);
        }
      }
    });

    return [...dedupedByEvent.values()]
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  }, [isOwner, notifications]);

  const ownerScopeTrucks = Array.isArray(ownerCompany?.trucks) ? ownerCompany.trucks : [];

  const notificationsWithStatus = notificationsForDisplay.map((notification) => ({
    ...notification,
    effectiveReadFlag: getNotificationEffectiveReadFlag({
      session,
      notification,
      dispatch: notification.related_dispatch_id
        ? dispatchById.get(normalizeVisibilityId(notification.related_dispatch_id)) || null
        : null,
      confirmations,
      ownerAllowedTrucks: ownerScopeTrucks,
    }),
  }));

  const unreadCount = notificationsWithStatus.filter((notification) => !notification.effectiveReadFlag).length;

  const invalidateNotificationQueries = useCallback(() => Promise.all([
    queryClient.invalidateQueries({ queryKey }),
    queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    queryClient.invalidateQueries({ queryKey: ['portal-dispatches', notificationScopeCompanyId] }),
    queryClient.invalidateQueries({ queryKey: ['driver-dispatch-assignments', driverIdentity] }),
  ]), [queryClient, queryKey, notificationScopeCompanyId, driverIdentity]);

  const markNotificationReadAcrossUnderlyingRows = async (target) => {
    if (!target?.id) return null;

    const sharedOwnerEventKey = isOwner ? buildSharedOwnerNotificationEventKey(target) : null;
    const relatedSharedEntries = sharedOwnerEventKey
      ? notifications.filter((entry) => buildSharedOwnerNotificationEventKey(entry) === sharedOwnerEventKey)
      : [];

    const isSharedOwnerRead = isOwner
      && String(target.notification_category || '').toLowerCase() === 'driver_dispatch_seen'
      && String(target.recipient_type || '').toLowerCase() === 'accesscode';

    if (!isSharedOwnerRead) {
      if (relatedSharedEntries.length > 1) {
        await Promise.all(relatedSharedEntries
          .filter((entry) => entry.read_flag !== true)
          .map((entry) => base44.entities.Notification.update(entry.id, { read_flag: true })));
        return true;
      }
      return base44.entities.Notification.update(target.id, { read_flag: true });
    }

    const related = await base44.entities.Notification.filter({
      recipient_type: 'AccessCode',
      notification_category: target.notification_category,
      related_dispatch_id: target.related_dispatch_id || null,
    }, '-created_date', 500);
    const relatedSharedOwnerEntries = (related || []).filter((entry) =>
      buildSharedOwnerNotificationEventKey(entry) === sharedOwnerEventKey
    );
    const ownerReadAt = new Date().toISOString();
    const ownerReadByName = getSessionActorName(session);

    await Promise.all(relatedSharedOwnerEntries
      .filter((entry) => entry.read_flag !== true)
      .map((entry) => base44.entities.Notification.update(entry.id, {
        read_flag: true,
        owner_read_at: ownerReadAt,
        owner_read_by_access_code_id: session?.id || null,
        owner_read_by_name: ownerReadByName,
      })));

    if (target.related_dispatch_id) {
      await appendDispatchActivityEntries(target.related_dispatch_id, [{
        timestamp: ownerReadAt,
        actor_type: 'CompanyOwner',
        actor_id: session?.id,
        actor_name: ownerReadByName,
        action: 'owner_viewed_driver_seen_acknowledgement',
        message: `${ownerReadByName} viewed a driver-seen acknowledgement`,
      }]);
    }

    return true;
  };

  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      const target = notificationsForDisplay.find((notification) => String(notification.id) === String(id));
      if (!target) return null;
      return markNotificationReadAcrossUnderlyingRows(target);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });

      const previousNotifications = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (current = []) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, read_flag: true } : notification
        )
      );

      return { previousNotifications };
    },
    onError: (_error, _id, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(queryKey, context.previousNotifications);
      }
    },
    onSettled: invalidateNotificationQueries,
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notificationsForDisplay.filter((n) => !n.effectiveReadFlag);
      await Promise.all(unread.map((notification) => markNotificationReadAcrossUnderlyingRows(notification)));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey }),
    queryClient.invalidateQueries({ queryKey: ['portal-dispatches', notificationScopeCompanyId] }),
  ]);

  const markRead = (id) => markReadMutation.mutate(id);
  const markReadAsync = (id) => markReadMutation.mutateAsync(id);
  const markAllRead = () => markAllReadMutation.mutate();

  const markDispatchRelatedReadAsync = async (dispatchId) => {
    if (!isDriver || !dispatchId) return [];

    const normalizedDispatchId = String(dispatchId);
    const matchingNotifications = notifications.filter((notification) =>
      !notification.read_flag &&
      notification.notification_category === 'driver_dispatch_update' &&
      String(notification.related_dispatch_id ?? '') === normalizedDispatchId &&
      (notification.recipient_access_code_id === session.id || notification.recipient_id === session.id)
    );

    if (!matchingNotifications.length) return [];

    await Promise.all(
      matchingNotifications.map((notification) =>
        base44.entities.Notification.update(notification.id, { read_flag: true })
      )
    );

    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ]);

    return matchingNotifications.map((notification) => notification.id);
  };

  const markDriverDispatchSeenAsync = async ({ dispatch, notificationId = null } = {}) => {
    if (!isDriver || !dispatch?.id || !driverIdentity) return;

    const matchingAssignments = driverAssignments.filter((assignment) =>
      assignment?.active_flag !== false &&
      assignment?.is_visible_to_driver !== false &&
      ['sent', 'seen'].includes(String(assignment?.delivery_status || 'sent').toLowerCase()) &&
      String(assignment.dispatch_id ?? '') === String(dispatch.id)
    );

    const unseenAssignments = matchingAssignments.filter((assignment) => !assignment?.last_seen_at);
    const matchingNotifications = notifications
      .filter((notification) =>
        notification.notification_category === 'driver_dispatch_update' &&
        String(notification.related_dispatch_id ?? '') === String(dispatch.id) &&
        (notification.recipient_access_code_id === session.id || notification.recipient_id === session.id)
      )
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));

    const targetNotification = notificationId
      ? matchingNotifications.find((notification) => String(notification.id) === String(notificationId)) || null
      : null;
    const currentRelevantNotification = targetNotification || matchingNotifications[0] || null;
    const unreadNotifications = matchingNotifications.filter((notification) => !notification.read_flag);
    const seenKind = getDriverNotificationSeenKind(currentRelevantNotification, dispatch);
    const seenVersionKey = String(currentRelevantNotification?.id || `${dispatch.id}:${seenKind}`).trim();
    const seenActionKey = `${dispatch.id}:${driverIdentity}:${seenKind}:${seenVersionKey}`;

    if (!unseenAssignments.length && !unreadNotifications.length) return;
    if (pendingDriverSeenKeysRef.current.has(seenActionKey)) return;

    pendingDriverSeenKeysRef.current.add(seenActionKey);

    try {
      const seenAt = new Date().toISOString();

      if (unreadNotifications.length) {
        await Promise.all(unreadNotifications.map((notification) =>
          base44.entities.Notification.update(notification.id, { read_flag: true })
        ));
      }

      if (unseenAssignments.length) {
        await Promise.all(unseenAssignments.map((assignment) => {
          if (!assignment?.id) return Promise.resolve();
          return base44.entities.DriverDispatch.update(assignment.id, {
            delivery_status: 'seen',
            last_seen_at: seenAt,
            last_opened_at: seenAt,
          });
        }));

        await notifyOwnerDriverSeen({
          dispatch,
          assignments: matchingAssignments,
          driverId: driverIdentity,
          driverName: session?.label || session?.driver_name || session?.name || matchingAssignments[0]?.driver_name,
          seenKind,
          seenVersionKey,
        });
      }

      await invalidateNotificationQueries();
      await queryClient.invalidateQueries({ queryKey: ['driver-dispatch-assignments', dispatch.id] });
    } finally {
      pendingDriverSeenKeysRef.current.delete(seenActionKey);
    }
  };

  const markDriverRemovalNotificationSeenAsync = async ({ notification, dispatch = null } = {}) => {
    if (!isDriver || !notification?.id) return;

    const seenActionKey = `${notification.related_dispatch_id || 'removed'}:${driverIdentity}:removed:${notification.id}`;
    if (pendingDriverSeenKeysRef.current.has(seenActionKey)) return;
    pendingDriverSeenKeysRef.current.add(seenActionKey);

    try {
      const relatedRemovalNotifications = notifications.filter((entry) =>
        entry.notification_category === 'driver_dispatch_update' &&
        String(entry.related_dispatch_id ?? '') === String(notification.related_dispatch_id ?? '') &&
        (entry.recipient_access_code_id === session.id || entry.recipient_id === session.id) &&
        String(entry.notification_type || '').toLowerCase() === 'driver_removed' &&
        !entry.read_flag
      );

      const notificationsToMarkRead = relatedRemovalNotifications.length ? relatedRemovalNotifications : (!notification.read_flag ? [notification] : []);
      if (notificationsToMarkRead.length) {
        await Promise.all(notificationsToMarkRead.map((entry) =>
          base44.entities.Notification.update(entry.id, { read_flag: true })
        ));
      }

      await notifyOwnerDriverSeen({
        dispatch: dispatch || {
          id: notification.related_dispatch_id,
          company_id: notification.recipient_company_id || notificationScopeCompanyId,
          status: 'Dispatch',
          shift_time: null,
          reference_tag: null,
          job_number: null,
        },
        assignments: (notification?.required_trucks || ['Removed']).map((truckNumber) => ({
          active_flag: true,
          truck_number: truckNumber,
        })),
        driverId: driverIdentity,
        driverName: session?.label || session?.driver_name || session?.name || 'Driver',
        seenKind: 'removed',
        seenVersionKey: String(notification.id),
      });

      await invalidateNotificationQueries();
    } finally {
      pendingDriverSeenKeysRef.current.delete(seenActionKey);
    }
  };

  return {
    notifications: notificationsWithStatus,
    unreadCount,
    isLoading,
    refresh,
    markRead,
    markReadAsync,
    markDispatchRelatedReadAsync,
    markDriverDispatchSeenAsync,
    markDriverRemovalNotificationSeenAsync,
    markAllRead,
    markAllReadPending: markAllReadMutation.isPending,
  };
}
