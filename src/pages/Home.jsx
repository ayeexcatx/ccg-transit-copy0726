import React, { useMemo, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../components/session/SessionContext';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import AnnouncementCard from '@/components/announcements/AnnouncementCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Sun, Moon, ArrowRight, Megaphone, Truck, BookOpenText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { getDispatchBucket } from '../components/portal/dispatchBuckets';
import { createPageUrl } from '@/utils';
import { buildDispatchOpenPath } from '@/lib/dispatchOpenOrchestration';
import { Link, useNavigate } from 'react-router-dom';
import ActionNeededSection from '@/components/notifications/ActionNeededSection';
import AvailabilityRequestPrompt from '@/components/availability/AvailabilityRequestPrompt';
import { getNotificationTruckBadges } from '@/components/notifications/notificationTruckDisplay';
import { formatNotificationTime } from '@/components/notifications/notificationTimeFormat';
import { useOwnerNotifications } from '../components/notifications/useOwnerNotifications';
import { useConfirmationsQuery } from '../components/notifications/useConfirmationsQuery';
import { getEffectiveView, getWorkspaceDisplayLabel } from '../components/session/workspaceUtils';
import {
  getNotificationEffectiveReadFlag,
  isNotificationMarkedReadOnClick,
} from '../components/notifications/ownerActionStatus';
import {
  buildDriverAssignedTrucksByDispatch,
  canUserSeeDispatch,
  getVisibleTrucksForDispatch as getVisibleDispatchTrucks,
  normalizeVisibilityId,
} from '@/lib/dispatchVisibility';
import { listDriverDispatchesForDriver } from '@/lib/driverDispatch';
import { resolveCompanyOwnerCompanyId, resolveDriverIdentity } from '@/services/currentAppIdentityService';
import {
  isAvailabilityRequestNotification,
  isAvailabilityRequestUnresolved,
  getLatestAvailabilityUpdateMs,
} from '@/components/notifications/availabilityRequestNotifications';
import {
  driverProtocolAckQueryKey,
  getDriverProtocolState,
} from '@/services/driverProtocolAcknowledgmentService';

const HOME_ACTIVITY_LIMIT = 8;
const CONFIRMATION_GROUP_WINDOW_MS = 90 * 1000;
const OWNER_ACTIVITY_SUPPRESSION_WINDOW_MS = 90 * 1000;

const dateOnly = (v) => (typeof v === 'string' ? v.slice(0, 10) : v);
const normalizeId = (value) => normalizeVisibilityId(value);

const statusColors = {
  Scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  Dispatch: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Amended: 'bg-amber-50 text-amber-700 border-amber-200',
  Cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const homeSectionCardClass = 'rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden';
const homeSectionHeaderClass = 'flex min-h-14 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3';

const confirmationActionLabel = (type) => {
  const normalized = String(type || '').toLowerCase();
  if (normalized === 'scheduled' || normalized === 'schedule') return 'schedule';
  if (normalized === 'amended') return 'amended dispatch';
  if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'cancellation') return 'cancellation';
  return 'dispatch';
};

const parseActivityTimestampMs = (value) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeOwnerNameForComparison = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

const buildActivityTimestamp = (...values) => {
  for (const value of values) {
    const timestampMs = parseActivityTimestampMs(value);
    if (timestampMs > 0) {
      return {
        activity_timestamp: value,
        activity_timestamp_ms: timestampMs,
      };
    }
  }

  return {
    activity_timestamp: null,
    activity_timestamp_ms: 0,
  };
};

const parseTruckNumberFromMessage = (message) => {
  const match = String(message || '').match(/\bTruck\s+([A-Za-z0-9-]+)/i);
  return match?.[1] || null;
};

const buildDispatchContextPieces = (dispatch, { trucks = [], includeTrucks = false } = {}) => {
  const context = [];
  if (includeTrucks && trucks.length) context.push(`Truck${trucks.length > 1 ? 's' : ''}: ${trucks.join(', ')}`);
  if (dispatch?.date) context.push(formatDispatchDate(dispatch.date));
  const dispatchTime = formatDispatchTime(dispatch?.start_time);
  if (dispatchTime) {
    context.push(dispatchTime);
  } else if (String(dispatch?.status || '').toLowerCase() === 'scheduled' && dispatch?.shift_time) {
    context.push(dispatch.shift_time);
  }
  return context;
};

const parseSelectedOwnerName = (message) => {
  const text = String(message || '').trim();
  if (!text) return '';
  const ownerSuffixMatch = text.match(/selected\s+(.+?)\s+\(Owner\)/i);
  if (ownerSuffixMatch?.[1]) return ownerSuffixMatch[1].trim();
  const genericMatch = text.match(/selected\s+(.+?)(?:\s+as|\s*$)/i);
  return genericMatch?.[1]?.trim() || '';
};

const parseDriverAssignmentFromMessage = (message) => {
  const text = String(message || '').trim();
  if (!text) return { assignee: '', truckNumber: '', verb: 'assigned' };

  const assignedMatch = text.match(/assigned\s+driver\s+(.+?)\s+to Truck\s+([A-Za-z0-9-]+)/i);
  if (assignedMatch) {
    return {
      assignee: assignedMatch[1]?.trim() || '',
      truckNumber: assignedMatch[2]?.trim() || '',
      verb: 'assigned',
    };
  }

  const changedMatch = text.match(/changed\s+driver\s+from\s+.+?\s+to\s+(.+?)\s+on Truck\s+([A-Za-z0-9-]+)/i);
  if (changedMatch) {
    return {
      assignee: changedMatch[1]?.trim() || '',
      truckNumber: changedMatch[2]?.trim() || '',
      verb: 'assigned',
    };
  }

  const removedMatch = text.match(/(?:removed|unassigned)\s+driver\s+(.+?)\s+from Truck\s+([A-Za-z0-9-]+)/i);
  if (removedMatch) {
    return {
      assignee: removedMatch[1]?.trim() || '',
      truckNumber: removedMatch[2]?.trim() || '',
      verb: 'removed',
    };
  }

  return { assignee: '', truckNumber: '', verb: 'assigned' };
};

const parseTruckEditFromMessage = (message) => {
  const text = String(message || '').trim();
  if (!text) return { fromTruck: '', toTruck: '', isSwap: false };

  const swapForMatch = text.match(/swapped\s+([A-Za-z0-9-]+)\s+for\s+([A-Za-z0-9-]+)/i);
  if (swapForMatch) {
    return {
      fromTruck: swapForMatch[1]?.trim() || '',
      toTruck: swapForMatch[2]?.trim() || '',
      isSwap: true,
    };
  }

  const swapWithMatch = text.match(/swapped\s+([A-Za-z0-9-]+)\s+with\s+([A-Za-z0-9-]+)/i);
  if (swapWithMatch) {
    return {
      fromTruck: swapWithMatch[2]?.trim() || '',
      toTruck: swapWithMatch[1]?.trim() || '',
      isSwap: true,
    };
  }

  const changedMatch = text.match(/(?:changed|updated|replaced)\s+(?:Truck\s+)?([A-Za-z0-9-]+)\s+(?:to|with|for)\s+(?:Truck\s+)?([A-Za-z0-9-]+)/i);
  if (changedMatch) {
    return {
      fromTruck: changedMatch[1]?.trim() || '',
      toTruck: changedMatch[2]?.trim() || '',
      isSwap: false,
    };
  }

  const fromToMatch = text.match(/from\s+(?:Truck\s+)?([A-Za-z0-9-]+)\s+to\s+(?:Truck\s+)?([A-Za-z0-9-]+)/i);
  if (fromToMatch) {
    return {
      fromTruck: fromToMatch[1]?.trim() || '',
      toTruck: fromToMatch[2]?.trim() || '',
      isSwap: false,
    };
  }

  return { fromTruck: '', toTruck: '', isSwap: false };
};

const formatDispatchDate = (dateValue) => (dateValue ? format(parseISO(dateValue), 'EEE, MMM d, yyyy') : '');

const formatDispatchTime = (startTime) => {
  if (!startTime) return '';

  const time = String(startTime).trim();
  if (!time) return '';

  const amPmMatch = time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])$/);
  if (amPmMatch) {
    const [, hourRaw, minute, periodRaw] = amPmMatch;
    let hour = Number(hourRaw);
    if (!Number.isFinite(hour) || hour < 1) hour = 12;
    if (hour > 12) hour = hour % 12 || 12;
    return `${hour}:${minute} ${periodRaw.toUpperCase()}`;
  }

  const hhMmMatch = time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!hhMmMatch) return '';

  let hour24 = Number(hhMmMatch[1]);
  const minute = hhMmMatch[2];
  if (!Number.isFinite(hour24) || hour24 < 0 || hour24 > 23) return '';

  const period = hour24 >= 12 ? 'PM' : 'AM';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${minute} ${period}`;
};

const getEasternHour = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'America/New_York',
  }).formatToParts(new Date());

  const hourPart = parts.find((part) => part.type === 'hour')?.value;
  const hour = Number(hourPart);

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error('Invalid Eastern hour');
  }

  return hour;
};

const getHomeGreeting = (userName) => {
  const safeName = typeof userName === 'string' ? userName.trim() : '';

  try {
    const hour = getEasternHour();
    let greeting = 'Good morning';

    if (hour >= 12 && hour <= 16) greeting = 'Good afternoon';
    else if (hour >= 17 && hour <= 20) greeting = 'Good evening';
    else if (hour >= 21 || hour <= 2) greeting = 'Good night';

    return safeName ? `${greeting}, ${safeName}!` : `${greeting}!`;
  } catch {
    return safeName ? `Welcome back, ${safeName}!` : 'Welcome back!';
  }
};

function MiniDispatchCard({ dispatch, companyName, truckNumbers = [] }) {

  return (
    <Link to={createPageUrl(buildDispatchOpenPath('Portal', { dispatchId: dispatch.id, normalizeId }))}>
      <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer">
        <div className="shrink-0 mt-0.5">
          {dispatch.shift_time === 'Day Shift'
            ? <Sun className="h-4 w-4 text-amber-400" />
            : <Moon className="h-4 w-4 text-slate-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <Badge className={`${statusColors[dispatch.status]} border text-xs`}>{dispatch.status}</Badge>
            </div>
            <div className="shrink-0 text-right text-xs text-slate-500 leading-tight">
              <div className="whitespace-nowrap">{formatDispatchDate(dispatch.date)}</div>
              {dispatch.start_time && (
                <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                  <Clock className="h-3 w-3" />
                  <span>{formatDispatchTime(dispatch.start_time)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-0.5 space-y-0.5 min-w-0">
            {dispatch.client_name && (
              <p className="text-sm font-medium text-slate-700 truncate">{dispatch.client_name}</p>
            )}
            {dispatch.job_number && (
              <p className="text-xs text-slate-600 truncate">Job #{dispatch.job_number}</p>
            )}
            {companyName && (
              <p className="text-xs text-slate-600 truncate">{companyName}</p>
            )}
            {truckNumbers.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                <Truck className="h-3 w-3 text-slate-600" />
                {truckNumbers.map((truck) => (
                  <Badge key={truck} variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-5">
                    {truck}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300 shrink-0 mt-1" />
      </div>
    </Link>
  );
}

export default function Home() {
  const { session } = useSession();
  const { currentAppIdentity } = useAuth();
  const navigate = useNavigate();
  const effectiveView = getEffectiveView(session);
  const isOwner = effectiveView === 'CompanyOwner';
  const ownerWorkspaceCompanyId = useMemo(
    () => resolveCompanyOwnerCompanyId({ currentAppIdentity, session }),
    [currentAppIdentity, session],
  );
  const dispatchCompanyId = ownerWorkspaceCompanyId;
  const isDriver = effectiveView === 'Driver';
  const driverIdentity = useMemo(
    () => resolveDriverIdentity({ currentAppIdentity, session }),
    [currentAppIdentity, session],
  );
  const { data: companies = [] } = useQuery({
    queryKey: ['companies-home-workspace-label'],
    queryFn: () => base44.entities.Company.list(),
    enabled: !!session,
  });

  const activeCompanyName =
    companies.find((company) => String(company.id) === String(dispatchCompanyId))?.name ||
    session?.company_name ||
    (typeof session?.company === 'object' ? session.company?.name : null) ||
    (!dispatchCompanyId && typeof session?.company === 'string' ? session.company : null);

  const workspaceDisplayLabel = getWorkspaceDisplayLabel(session, activeCompanyName);
  const homeHeading = getHomeGreeting(workspaceDisplayLabel || session?.code_type);


  // Shared notifications hook — same query key as bell + notifications page
  const { notifications, unreadCount, markReadAsync } = useOwnerNotifications(session);

  const { data: confirmations = [] } = useConfirmationsQuery(isOwner, ownerWorkspaceCompanyId);


  const { data: driverAssignments = [] } = useQuery({
    queryKey: ['driver-dispatch-assignments', driverIdentity],
    queryFn: () => listDriverDispatchesForDriver(driverIdentity),
    enabled: isDriver && !!driverIdentity,
  });
  const { data: protocolState = { activeProtocol: null, acknowledgment: null } } = useQuery({
    queryKey: driverProtocolAckQueryKey(driverIdentity),
    queryFn: () => getDriverProtocolState(driverIdentity),
    enabled: isDriver && !!driverIdentity,
  });
  const protocolAcknowledgment = protocolState?.acknowledgment || null;
  const activeProtocol = protocolState?.activeProtocol || null;

  const { data: dispatches = [] } = useQuery({
    queryKey: ['portal-dispatches', dispatchCompanyId],
    queryFn: () => base44.entities.Dispatch.filter({ company_id: dispatchCompanyId }, '-date', 200),
    enabled: !!dispatchCompanyId,
  });
  const { data: ownerCompany = null } = useQuery({
    queryKey: ['owner-company-notification-scope', ownerWorkspaceCompanyId],
    queryFn: async () => {
      if (!ownerWorkspaceCompanyId) return null;
      const companies = await base44.entities.Company.filter({ id: ownerWorkspaceCompanyId }, '-created_date', 1);
      return companies?.[0] || null;
    },
    enabled: isOwner && !!ownerWorkspaceCompanyId,
  });
  const { data: ownerAccessCodes = [] } = useQuery({
    queryKey: ['home-owner-access-codes', ownerWorkspaceCompanyId],
    queryFn: () => base44.entities.AccessCode.filter({
      code_type: 'CompanyOwner',
      company_id: ownerWorkspaceCompanyId,
      active_flag: true,
    }, '-created_date', 500),
    enabled: isOwner && !!ownerWorkspaceCompanyId,
  });
  const hasMultipleOwners = ownerAccessCodes.length > 1;
  const ownerScopeTrucks = Array.isArray(ownerCompany?.trucks) ? ownerCompany.trucks : [];
  const { data: ownerAvailabilityDefaults = [] } = useQuery({
    queryKey: ['home-owner-availability-defaults', ownerWorkspaceCompanyId],
    queryFn: () => base44.entities.CompanyAvailabilityDefault.filter({ company_id: ownerWorkspaceCompanyId }, '-created_date', 500),
    enabled: isOwner && !!ownerWorkspaceCompanyId,
  });
  const { data: ownerAvailabilityOverrides = [] } = useQuery({
    queryKey: ['home-owner-availability-overrides', ownerWorkspaceCompanyId],
    queryFn: () => base44.entities.CompanyAvailabilityOverride.filter({ company_id: ownerWorkspaceCompanyId }, '-created_date', 1000),
    enabled: isOwner && !!ownerWorkspaceCompanyId,
  });
  const { latestUnresolvedAvailabilityRequest } = useMemo(() => {
    const latestAvailabilityUpdateMs = getLatestAvailabilityUpdateMs({
      defaults: ownerAvailabilityDefaults,
      overrides: ownerAvailabilityOverrides,
    });
    const unresolved = notifications
      .filter((notification) => isAvailabilityRequestNotification(notification))
      .filter((notification) => isAvailabilityRequestUnresolved(notification, latestAvailabilityUpdateMs))
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));

    return {
      latestUnresolvedAvailabilityRequest: unresolved[0] || null,
    };
  }, [notifications, ownerAvailabilityDefaults, ownerAvailabilityOverrides]);

  const [dismissedAvailabilityPromptIds, setDismissedAvailabilityPromptIds] = useState([]);

  useEffect(() => {
    if (!session?.id) {
      setDismissedAvailabilityPromptIds([]);
      return;
    }

    const storageKey = `availability-request-prompt-dismissed:${session.id}`;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) {
        setDismissedAvailabilityPromptIds([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setDismissedAvailabilityPromptIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDismissedAvailabilityPromptIds([]);
    }
  }, [session?.id]);

  const activeAvailabilityRequestPrompt = useMemo(() => {
    if (!latestUnresolvedAvailabilityRequest) return null;
    if (dismissedAvailabilityPromptIds.includes(String(latestUnresolvedAvailabilityRequest.id))) return null;
    return latestUnresolvedAvailabilityRequest;
  }, [latestUnresolvedAvailabilityRequest, dismissedAvailabilityPromptIds]);

  const dismissAvailabilityPromptForNow = (notificationId) => {
    if (!session?.id || !notificationId) return;
    const id = String(notificationId);
    setDismissedAvailabilityPromptIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      const storageKey = `availability-request-prompt-dismissed:${session.id}`;
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // no-op
      }
      return next;
    });
  };

  const { data: allAnnouncements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => base44.entities.Announcement.filter({ active_flag: true }, 'priority', 50),
    enabled: !!session,
    refetchInterval: 60000,
  });

  const announcements = useMemo(() => {
    const companyAnnouncementScopeId = isOwner ? ownerWorkspaceCompanyId : null;
    return allAnnouncements.filter(a => {
      if (a.target_type === 'All') return true;
      if (a.target_type === 'Companies') return (a.target_company_ids || []).includes(companyAnnouncementScopeId);
      if (a.target_type === 'AccessCodes') return (a.target_access_code_ids || []).includes(session?.id);
      return false;
    }).sort((a, b) => (a.priority || 3) - (b.priority || 3));
  }, [allAnnouncements, isOwner, ownerWorkspaceCompanyId, session]);

  const driverAssignedTrucksByDispatch = useMemo(
    () => buildDriverAssignedTrucksByDispatch(driverAssignments),
    [driverAssignments]
  );

  const driverDispatchIds = useMemo(
    () => new Set(driverAssignedTrucksByDispatch.keys()),
    [driverAssignedTrucksByDispatch]
  );

  const getVisibleTrucksForDispatch = (dispatch) => {
    if (!dispatch?.id) return [];
    return getVisibleDispatchTrucks(session, dispatch, {
      driverAssignedTrucks: driverAssignedTrucksByDispatch.get(normalizeId(dispatch.id)) || [],
    });
  };
  const getVisibleTrucksForNotification = (notification, dispatch) =>
    getNotificationTruckBadges(notification, getVisibleTrucksForDispatch(dispatch));

  const filteredDispatches = useMemo(() => {
    return dispatches.filter((dispatch) => canUserSeeDispatch(session, dispatch, { driverDispatchIds, ownerCompanyId: dispatchCompanyId }));
  }, [dispatches, dispatchCompanyId, driverDispatchIds, session]);

  const todayDispatches = useMemo(() =>
    filteredDispatches
      .filter(d => getDispatchBucket(d) === 'today')
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
      .slice(0, 5),
    [filteredDispatches]
  );

  const upcomingDispatches = useMemo(() =>
    filteredDispatches
      .filter(d => getDispatchBucket(d) === 'upcoming')
      .sort((a, b) => parseISO(dateOnly(a.date)) - parseISO(dateOnly(b.date)))
      .slice(0, 5),
    [filteredDispatches]
  );

  // Build action items: unread dispatch-change notifications enriched with dispatch data
  const actionItemsSource = useMemo(() => {
    const dispatchMap = {};
    filteredDispatches.forEach((dispatch) => {dispatchMap[normalizeId(dispatch.id)] = dispatch;});

    return notifications
      .filter((notification) => {
        const effectiveReadFlag = typeof notification?.effectiveReadFlag === 'boolean'
          ? notification.effectiveReadFlag
          : getNotificationEffectiveReadFlag({
            session,
            notification,
            dispatch: notification.related_dispatch_id ? dispatchMap[normalizeId(notification.related_dispatch_id)] : null,
            confirmations,
            ownerAllowedTrucks: ownerScopeTrucks,
          });
        if (effectiveReadFlag) return false;
        if (notification.notification_category === 'availability_request') return false;
        if (!notification.related_dispatch_id) return true;
        return Boolean(dispatchMap[normalizeId(notification.related_dispatch_id)]);
      })
      .map((notification) => ({
        notification,
        dispatch: notification.related_dispatch_id ? dispatchMap[normalizeId(notification.related_dispatch_id)] : null,
      }));
  }, [notifications, filteredDispatches, session?.code_type, confirmations, ownerScopeTrucks]);
  const actionItems = actionItemsSource.slice(0, 8);
  const actionNeededCount = actionItemsSource.length;
  const recentCompanyActivity = useMemo(() => {
    if (!isOwner) return [];
    const events = [];
    const dispatchById = new Map(filteredDispatches.map((dispatch) => [normalizeId(dispatch.id), dispatch]));

    const groupedConfirmations = [];
    const currentOwnerAccessCodeId = (
      isOwner &&
      String(session?.raw_code_type || '').toLowerCase() === 'companyowner' &&
      session?.id
    )
      ? String(session.id)
      : null;
    const currentOwnerNormalizedNames = new Set(
      [
        session?.label,
        session?.name,
        session?.profile_name,
      ]
        .map((value) => normalizeOwnerNameForComparison(value))
        .filter(Boolean)
    );
    const hasCurrentOwnerNameFallback = currentOwnerNormalizedNames.size > 0;
    const isSelfOwnerAction = (actorAccessCodeId) => {
      if (!currentOwnerAccessCodeId || !actorAccessCodeId) return false;
      return String(actorAccessCodeId) === currentOwnerAccessCodeId;
    };
    const isLegacySelfOwnerActionByName = ({ actorAccessCodeId, actorName, isOwnerSpecificAction }) => {
      // Safety-first legacy fallback: only apply to owner-specific activity rows,
      // only when id-based matching is unavailable for at least one side, and only
      // with exact normalized owner-name equality (no fuzzy / partial matching).
      if (!isOwnerSpecificAction) return false;
      if (!hasCurrentOwnerNameFallback) return false;
      if (currentOwnerAccessCodeId && actorAccessCodeId) return false;

      const normalizedActorName = normalizeOwnerNameForComparison(actorName);
      if (!normalizedActorName) return false;
      return currentOwnerNormalizedNames.has(normalizedActorName);
    };

    confirmations.forEach((confirmation) => {
      const dispatchId = normalizeId(confirmation?.dispatch_id);
      const dispatch = dispatchById.get(dispatchId);
      const { activity_timestamp, activity_timestamp_ms } = buildActivityTimestamp(confirmation?.confirmed_at);
      const actor = String(confirmation?.confirmed_by_name || '').trim();
      const actorAccessCodeId = confirmation?.access_code_id || confirmation?.confirmed_by_access_code_id || null;
      const confirmationType = String(confirmation?.confirmation_type || '').trim();
      const truckNumber = String(confirmation?.truck_number || '').trim();
      if (!dispatch || !dispatchId || !activity_timestamp_ms || !actor || !confirmationType || !truckNumber) return;
      if (isSelfOwnerAction(actorAccessCodeId)) return;

      const key = `${dispatchId}::${confirmationType.toLowerCase()}::${actor.toLowerCase()}`;
      const existingGroup = groupedConfirmations.find((group) => (
        group.groupKey === key &&
        Math.abs(group.activity_timestamp_ms - activity_timestamp_ms) <= CONFIRMATION_GROUP_WINDOW_MS
      ));

      if (existingGroup) {
        existingGroup.trucks.add(truckNumber);
        if (activity_timestamp_ms > existingGroup.activity_timestamp_ms) {
          existingGroup.activity_timestamp_ms = activity_timestamp_ms;
          existingGroup.activity_timestamp = activity_timestamp;
        }
        return;
      }

      groupedConfirmations.push({
        groupKey: key,
        dispatchId,
        dispatch,
        actor,
        confirmationType,
        activity_timestamp,
        activity_timestamp_ms,
        trucks: new Set([truckNumber]),
      });
    });

    groupedConfirmations.forEach((group, index) => {
      const trucks = [...group.trucks].sort();
      events.push({
        id: `confirmation-group-${group.dispatchId}-${group.confirmationType}-${group.actor}-${index}`,
        dispatchId: group.dispatchId,
        activity_timestamp: group.activity_timestamp,
        activity_timestamp_ms: group.activity_timestamp_ms,
        actionText: `${group.actor} confirmed the ${confirmationActionLabel(group.confirmationType)}`,
        details: buildDispatchContextPieces(group.dispatch, { trucks, includeTrucks: true }),
      });
    });

    const ownerLogCandidates = [];
    filteredDispatches.forEach((dispatch) => {
      const dispatchId = normalizeId(dispatch.id);
      (dispatch?.admin_activity_log || []).forEach((entry, entryIndex) => {
        const action = String(entry?.action || '').toLowerCase();
        const actorType = String(entry?.actor_type || '').toLowerCase();
        if (!entry?.timestamp || (!action.startsWith('owner_') && actorType !== 'companyowner')) return;
        if (action === 'owner_viewed_driver_seen_acknowledgement') return;

        const actorName = String(entry?.actor_name || '').trim() || 'Company owner';
        const actorAccessCodeId = entry?.actor_id ? String(entry.actor_id) : null;
        const { activity_timestamp, activity_timestamp_ms } = buildActivityTimestamp(entry?.timestamp, entry?.created_date);
        if (!activity_timestamp_ms) return;
        if (isSelfOwnerAction(actorAccessCodeId)) return;
        if (isLegacySelfOwnerActionByName({
          actorAccessCodeId,
          actorName,
          isOwnerSpecificAction: action.startsWith('owner_') || actorType === 'companyowner',
        })) {
          return;
        }

        if (action === 'owner_assigned_driver' || action === 'owner_changed_driver' || action === 'owner_removed_driver') {
          const { assignee, truckNumber, verb } = parseDriverAssignmentFromMessage(entry?.message);
          if (!truckNumber) return;
          const actionVerb = action === 'owner_removed_driver' ? (verb === 'removed' ? 'removed' : 'unassigned') : 'assigned';
          ownerLogCandidates.push({
            id: `owner-assignment-${dispatchId}-${entry?.timestamp}-${entryIndex}`,
            dispatchId,
            activity_timestamp,
            activity_timestamp_ms,
            actorName,
            action,
            actionText: actionVerb === 'removed'
              ? `${actorName} removed ${assignee || 'a driver'} from Truck ${truckNumber}`
              : actionVerb === 'unassigned'
                ? `${actorName} unassigned ${assignee || 'a driver'} from Truck ${truckNumber}`
                : `${actorName} assigned ${assignee || 'a driver'} to Truck ${truckNumber}`,
            details: buildDispatchContextPieces(dispatch),
            dedupeClusterKey: `${dispatchId}:${actorName.toLowerCase()}:${action}:${truckNumber}:${activity_timestamp_ms}`,
          });
          return;
        }

        if (action === 'owner_selected_owner_assignment') {
          const selectedOwner = parseSelectedOwnerName(entry?.message);
          const truckNumber = parseTruckNumberFromMessage(entry?.message);
          if (!truckNumber) return;
          ownerLogCandidates.push({
            id: `owner-owner-assignment-${dispatchId}-${entry?.timestamp}-${entryIndex}`,
            dispatchId,
            activity_timestamp,
            activity_timestamp_ms,
            actorName,
            action,
            actionText: `${actorName} assigned ${selectedOwner || 'an owner'} to Truck ${truckNumber}`,
            details: buildDispatchContextPieces(dispatch),
            dedupeClusterKey: `${dispatchId}:${actorName.toLowerCase()}:${action}:${truckNumber}:${activity_timestamp_ms}`,
          });
          return;
        }

        if (action === 'owner_updated_truck_assignments' || action === 'owner_swapped_trucks' || action === 'owner_swap_received_truck') {
          const { fromTruck, toTruck, isSwap } = parseTruckEditFromMessage(entry?.message);
          const hasTruckPair = Boolean(fromTruck && toTruck);
          const normalizedPair = hasTruckPair ? [fromTruck, toTruck].sort((a, b) => a.localeCompare(b)).join(':') : '';
          ownerLogCandidates.push({
            id: `owner-truck-edit-${dispatchId}-${entry?.timestamp}-${entryIndex}`,
            dispatchId,
            activity_timestamp,
            activity_timestamp_ms,
            actorName,
            action,
            actionText: isSwap
              ? `${actorName} swapped Truck ${fromTruck} for ${toTruck}`
              : hasTruckPair
                ? `${actorName} changed Truck ${fromTruck} to ${toTruck}`
                : `${actorName} updated truck assignments on the dispatch`,
            details: buildDispatchContextPieces(dispatch),
            dedupeClusterKey: hasTruckPair
              ? `${dispatchId}:${actorName.toLowerCase()}:${normalizedPair}:${Math.round(activity_timestamp_ms / OWNER_ACTIVITY_SUPPRESSION_WINDOW_MS)}`
              : `${dispatchId}:${actorName.toLowerCase()}:generic_truck_update:${Math.round(activity_timestamp_ms / OWNER_ACTIVITY_SUPPRESSION_WINDOW_MS)}`,
            isGenericTruckUpdate: action === 'owner_updated_truck_assignments',
            isSwap,
            hasTruckPair,
          });
        }

      });
    });

    const specificClusterKeys = new Set(
      ownerLogCandidates
        .filter((event) => !event.isGenericTruckUpdate)
        .map((event) => event.dedupeClusterKey)
    );
    const seenTruckEditClusterKeys = new Set();
    ownerLogCandidates.forEach((event) => {
      if (event.isGenericTruckUpdate && event.hasTruckPair && specificClusterKeys.has(event.dedupeClusterKey)) return;
      if (event.isSwap || event.action === 'owner_swapped_trucks' || event.action === 'owner_swap_received_truck') {
        if (seenTruckEditClusterKeys.has(event.dedupeClusterKey)) return;
        seenTruckEditClusterKeys.add(event.dedupeClusterKey);
      }

      events.push({
        id: event.id,
        dispatchId: event.dispatchId,
        activity_timestamp: event.activity_timestamp,
        activity_timestamp_ms: event.activity_timestamp_ms,
        actionText: event.actionText,
        details: event.details,
      });
    });

    return events
      .filter((event) => event.activity_timestamp_ms > 0)
      .sort((a, b) => b.activity_timestamp_ms - a.activity_timestamp_ms)
      .slice(0, HOME_ACTIVITY_LIMIT);
  }, [isOwner, filteredDispatches, confirmations, session?.id, session?.raw_code_type]);

  const handleNotificationClick = async (n) => {
    if (!session) return;

    if (!isDriver && n.related_dispatch_id && isNotificationMarkedReadOnClick(n) && !n.read_flag) {
      try {
        await markReadAsync(n.id);
      } catch {
        return;
      }
    }

    if (n.related_dispatch_id) {
      const targetPath = buildDispatchOpenPath('Portal', {
        dispatchId: n.related_dispatch_id,
        notificationId: n.id,
        normalizeId,
      });
      navigate(createPageUrl(targetPath));
    } else {
      navigate(createPageUrl('Notifications'));
    }
  };
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900" data-tour="home-overview">{homeHeading}</h2>
      </div>

      {isOwner && activeAvailabilityRequestPrompt && (
        <AvailabilityRequestPrompt
          onGoToAvailability={() => {
            dismissAvailabilityPromptForNow(activeAvailabilityRequestPrompt.id);
            navigate(createPageUrl('Availability'));
          }}
          onDismiss={() => dismissAvailabilityPromptForNow(activeAvailabilityRequestPrompt.id)}
        />
      )}

      {isDriver && activeProtocol && !protocolAcknowledgment && (
        <Card className="rounded-2xl border-2 border-amber-300 bg-amber-50 shadow-sm">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Requires your attention</p>
              <p className="text-sm text-amber-800 mt-1">Please review the safety requirements and company policies.</p>
            </div>
            <Button
              onClick={() => navigate(createPageUrl('Protocols'))}
              className="bg-amber-700 hover:bg-amber-800 text-white"
            >
              <BookOpenText className="h-4 w-4 mr-2" />
              Review Protocols
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <section data-tour="announcement-center">
          <Card className={homeSectionCardClass}>
            <div className={`${homeSectionHeaderClass} bg-blue-700`}>
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-white" />
                <h3 className="text-sm font-semibold text-white">Announcement Center</h3>
              </div>
            </div>
            <CardContent className="bg-white p-0">
              <div className="divide-y divide-slate-100 bg-white">
                {announcements.map(a => (
                  <AnnouncementCard key={a.id} announcement={a} variant="plain" />
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Action Needed — always visible for CompanyOwner */}
      {isOwner && (
        <ActionNeededSection
          unreadCount={actionNeededCount || unreadCount}
          actionItems={actionItems}
          confirmations={confirmations}
          ownerAllowedTrucks={ownerScopeTrucks}
          getVisibleTrucksForNotification={getVisibleTrucksForNotification}
          onNotificationClick={handleNotificationClick}
        />
      )}

      {isOwner && hasMultipleOwners && (
        <section>
          <Card className={homeSectionCardClass}>
            <div className={`${homeSectionHeaderClass} bg-slate-700`}>
              <h3 className="text-sm font-semibold text-white">Recent Company Activity</h3>
            </div>
            <CardContent className="p-3">
              {recentCompanyActivity.length === 0 ? (
                <p className="text-sm text-slate-400">No recent company activity yet.</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
                  {recentCompanyActivity.map((activity) => {
                    const canOpenDispatch = Boolean(activity.dispatchId);
                    const compactDetails = activity.details.slice(0, 2);
                    return (
                      <button
                        key={activity.id}
                        type="button"
                        onClick={() => {
                          if (!canOpenDispatch) return;
                          navigate(createPageUrl(buildDispatchOpenPath('Portal', { dispatchId: activity.dispatchId, normalizeId })));
                        }}
                        className={`min-w-[13.25rem] max-w-[13.25rem] text-left rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-2.5 shadow-sm transition hover:border-slate-300 hover:shadow ${canOpenDispatch ? 'cursor-pointer snap-start' : 'cursor-default snap-start'}`}
                      >
                        <p className="text-sm font-semibold text-slate-800 leading-5 line-clamp-2">{activity.actionText}</p>
                        <div className="mt-1.5 space-y-0.5">
                          {compactDetails.map((detail) => (
                            <p key={detail} className="text-[11px] text-slate-600 leading-4 truncate">{detail}</p>
                          ))}
                        </div>
                        <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          {formatNotificationTime(activity.activity_timestamp, { withYear: true })}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Today's Dispatches */}
      <section data-tour="dispatch-preview">
        <Card className={homeSectionCardClass}>
          <div className={`${homeSectionHeaderClass} bg-green-700`}>
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-white" />
              <h3 className="text-sm font-semibold text-white">Today's Dispatches</h3>
              {todayDispatches.length > 0 && (
                <Badge className="bg-white text-green-700 text-xs px-1.5 py-0">{todayDispatches.length}</Badge>
              )}
            </div>
          </div>
          <CardContent className="p-1 space-y-2">
            {todayDispatches.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No dispatches today</p>
            ) : (
              todayDispatches.map(d => <MiniDispatchCard key={d.id} dispatch={d} companyName={d.company_name} truckNumbers={getVisibleTrucksForDispatch(d)} />)
            )}
          </CardContent>
        </Card>
      </section>

      {/* Upcoming Dispatches */}
      <section>
        <Card className={homeSectionCardClass}>
          <div className={`${homeSectionHeaderClass} bg-indigo-700`}>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-white" />
              <h3 className="text-sm font-semibold text-white">Upcoming Dispatches</h3>
              {upcomingDispatches.length > 0 && (
                <Badge className="bg-white text-indigo-700 text-xs px-1.5 py-0">{upcomingDispatches.length}</Badge>
              )}
            </div>
          </div>
          <CardContent className="p-1 space-y-2">
            {upcomingDispatches.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No upcoming dispatches</p>
            ) : (
              upcomingDispatches.map(d => <MiniDispatchCard key={d.id} dispatch={d} companyName={d.company_name} truckNumbers={getVisibleTrucksForDispatch(d)} />)
            )}
          </CardContent>
        </Card>
      </section>

      <Link to={createPageUrl('Portal')}>
        <Button className="w-full bg-slate-900 hover:bg-slate-800">
          View All Dispatches
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </Link>
    </div>
  );
}
