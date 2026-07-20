import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useSession } from '@/components/session/SessionContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { buildDispatchOpenPath } from '@/lib/dispatchOpenOrchestration';
import { useAdminDispatchDrawer } from '@/components/portal/AdminDispatchDrawerContext';
import { useNavigate } from 'react-router-dom';
import { useOwnerNotifications } from '@/components/notifications/useOwnerNotifications';
import { getNotificationDisplay } from '@/components/notifications/formatNotificationDetailsMessage';
import { useConfirmationsQuery } from '@/components/notifications/useConfirmationsQuery';
import {
  getNotificationEffectiveReadFlag,
  isNotificationMarkedReadOnClick,
} from '@/components/notifications/ownerActionStatus';
import {
  canUserSeeNotification,
  normalizeVisibilityId,
} from '@/lib/dispatchVisibility';
import NotificationsPageItem from '@/components/notifications/NotificationsPageItem';
import { getActiveCompanyId, getEffectiveView } from '@/components/session/workspaceUtils';
import { AVAILABILITY_REQUEST_NOTIFICATION_CATEGORY } from '@/components/notifications/availabilityRequestNotifications';
import { useAuth } from '@/lib/AuthContext';
import { resolveCompanyOwnerCompanyId } from '@/services/currentAppIdentityService';

export default function Notifications() {
  const { session } = useSession();
  const { currentAppIdentity } = useAuth();
  const navigate = useNavigate();
  const { openAdminDispatchDrawer } = useAdminDispatchDrawer();
  const effectiveView = getEffectiveView(session);
  const activeCompanyId = getActiveCompanyId(session);
  const isOwner = effectiveView === 'CompanyOwner';
  const isDriver = effectiveView === 'Driver';
  const isAdmin = effectiveView === 'Admin';
  const ownerWorkspaceCompanyId = React.useMemo(
    () => resolveCompanyOwnerCompanyId({ currentAppIdentity, session }),
    [currentAppIdentity, session],
  );
  const notificationScopeCompanyId = isOwner ? ownerWorkspaceCompanyId : activeCompanyId;
  const { notifications, unreadCount, isLoading, markReadAsync, markAllRead, markAllReadPending } = useOwnerNotifications(session);

  const { data: confirmations = [] } = useConfirmationsQuery(isOwner, notificationScopeCompanyId);

  const { data: dispatches = [] } = useQuery({
    queryKey: ['portal-dispatches', notificationScopeCompanyId],
    queryFn: () => base44.entities.Dispatch.filter({ company_id: notificationScopeCompanyId }, '-date', 200),
    enabled: !!notificationScopeCompanyId,
  });

  const dispatchMap = Object.fromEntries(dispatches.map((dispatch) => [dispatch.id, dispatch]));
  const visibleDispatchIds = new Set(dispatches.map((dispatch) => normalizeVisibilityId(dispatch.id)));
  const filteredNotifications = notifications.filter((notification) =>
    canUserSeeNotification(session, notification, {
      visibleDispatchIds,
      driverDispatchIds: visibleDispatchIds,
    })
  );
  const { data: ownerCompany = null } = useQuery({
    queryKey: ['owner-company-notification-scope', notificationScopeCompanyId],
    queryFn: async () => {
      if (!notificationScopeCompanyId) return null;
      const companies = await base44.entities.Company.filter({ id: notificationScopeCompanyId }, '-created_date', 1);
      return companies?.[0] || null;
    },
    enabled: isOwner && !!notificationScopeCompanyId,
  });
  const ownerScopeTrucks = Array.isArray(ownerCompany?.trucks) ? ownerCompany.trucks : [];
  
  const handleNotificationClick = async (n) => {
    if (!session) return;

    if (!isDriver && isNotificationMarkedReadOnClick(n) && !n.read_flag) {
      try {
        await markReadAsync(n.id);
      } catch {
        return;
      }
    }

    if (n.notification_category === AVAILABILITY_REQUEST_NOTIFICATION_CATEGORY && isOwner) {
      navigate(createPageUrl('Availability'));
      return;
    }

    if (n.related_dispatch_id) {
      if (isAdmin) {
        openAdminDispatchDrawer({ dispatchId: n.related_dispatch_id, notificationId: n.id });
        return;
      }

      const targetPath = buildDispatchOpenPath('Portal', {
        dispatchId: n.related_dispatch_id,
        notificationId: n.id,
      });
      navigate(createPageUrl(targetPath));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Notifications</h2>
          <p className="text-sm text-slate-500">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={markAllReadPending}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Mark All Read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-700 rounded-full" />
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No notifications yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map(n => {
            const dispatch = dispatchMap[n.related_dispatch_id] || null;
            const display = getNotificationDisplay(n, dispatch);
            const effectiveReadFlag = getNotificationEffectiveReadFlag({
              session,
              notification: n,
              dispatch,
              confirmations,
              ownerAllowedTrucks: ownerScopeTrucks,
            });

            return (
              <NotificationsPageItem
                key={n.id}
                notification={n}
                display={display}
                effectiveReadFlag={effectiveReadFlag}
                dispatch={dispatch}
                confirmations={confirmations}
                ownerAllowedTrucks={ownerScopeTrucks}
                onClick={() => handleNotificationClick(n)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
