import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { useAdminDispatchDrawer } from '@/components/portal/AdminDispatchDrawerContext';
import NotificationBellItem from './NotificationBellItem';
import { useOwnerNotifications } from './useOwnerNotifications';
import { useAuth } from '@/lib/AuthContext';
import { getNotificationDisplay } from './formatNotificationDetailsMessage';
import { useConfirmationsQuery } from './useConfirmationsQuery';
import { getActiveCompanyId, getEffectiveView } from '@/components/session/workspaceUtils';
import {
  getNotificationEffectiveReadFlag,
  isNotificationMarkedReadOnClick,
} from './ownerActionStatus';
import {
  canUserSeeNotification,
  getDriverDispatchIdSet,
  getVisibleTrucksForDispatch as getVisibleDispatchTrucks,
  normalizeVisibilityId,
} from '@/lib/dispatchVisibility';
import { listDriverDispatchesForDriver } from '@/lib/driverDispatch';
import { resolveCompanyOwnerCompanyId, resolveDriverIdentity } from '@/services/currentAppIdentityService';
import { getNotificationTruckBadges } from './notificationTruckDisplay';
import { AVAILABILITY_REQUEST_NOTIFICATION_CATEGORY } from './availabilityRequestNotifications';

const normalizeId = (value) => normalizeVisibilityId(value);

export default function NotificationBell({ session }) {
  const { currentAppIdentity } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const { openAdminDispatchDrawer } = useAdminDispatchDrawer();
  const { notifications, unreadCount, markReadAsync } = useOwnerNotifications(session);
  const effectiveView = getEffectiveView(session);
  const activeCompanyId = getActiveCompanyId(session);
  const isDriver = effectiveView === 'Driver';
  const isOwner = effectiveView === 'CompanyOwner';
  const isAdmin = effectiveView === 'Admin';
  const ownerWorkspaceCompanyId = React.useMemo(
    () => resolveCompanyOwnerCompanyId({ currentAppIdentity, session }),
    [currentAppIdentity, session],
  );
  const notificationScopeCompanyId = isOwner ? ownerWorkspaceCompanyId : activeCompanyId;
  const driverIdentity = React.useMemo(
    () => resolveDriverIdentity({ currentAppIdentity, session }),
    [currentAppIdentity, session],
  );

  const { data: driverAssignments = [] } = useQuery({
    queryKey: ['driver-dispatch-assignments', driverIdentity],
    queryFn: () => listDriverDispatchesForDriver(driverIdentity),
    enabled: isDriver && !!driverIdentity,
  });

  const { data: dispatches = [] } = useQuery({
    queryKey: ['portal-dispatches', notificationScopeCompanyId],
    queryFn: () => base44.entities.Dispatch.filter({ company_id: notificationScopeCompanyId }, '-date', 200),
    enabled: !!notificationScopeCompanyId && !isAdmin,
  });

  const dispatchMap = Object.fromEntries(
    dispatches.map((dispatch) => [normalizeId(dispatch.id), dispatch])
  );

  const dispatchIds = new Set(dispatches.map((dispatch) => normalizeId(dispatch.id)));

  const driverDispatchIds = getDriverDispatchIdSet(driverAssignments);

  const filteredNotifications = notifications.filter((notification) =>
    canUserSeeNotification(session, notification, {
      visibleDispatchIds: dispatchIds,
      driverDispatchIds,
    })
  );

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
  const ownerScopeTrucks = Array.isArray(ownerCompany?.trucks) ? ownerCompany.trucks : [];

  const getVisibleTrucksForDispatch = (dispatch) => {
    if (!dispatch?.id) return [];
    return getVisibleDispatchTrucks(session, dispatch);
  };

  const shouldMarkReadOnClick = (notification) => {
    if (notification.read_flag) return false;
    if (isDriver) return true;
    return isNotificationMarkedReadOnClick(notification);
  };

  const handleNotificationClick = async (n) => {
    if (!session) return;

    if (shouldMarkReadOnClick(n) && !isDriver) {
      try {
        await markReadAsync(n.id);
      } catch {
        return;
      }
    }

    if (n.notification_category === AVAILABILITY_REQUEST_NOTIFICATION_CATEGORY && isOwner) {
      setOpen(false);
      navigate(createPageUrl('Availability'));
      return;
    }

    if (n.related_dispatch_id) {
      setOpen(false);
      if (isAdmin) {
        openAdminDispatchDrawer({ dispatchId: n.related_dispatch_id, notificationId: n.id });
        return;
      }

      const targetPath = `Portal?dispatchId=${encodeURIComponent(normalizeId(n.related_dispatch_id))}${n.id ? `&notificationId=${encodeURIComponent(normalizeId(n.id))}` : ''}`;
      setTimeout(() => navigate(createPageUrl(targetPath)), 0);
    } else {
      navigate(createPageUrl('Notifications'));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-11 w-11">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        showBackdrop
        onBackdropClick={() => setOpen(false)}
        className="w-[min(24rem,calc(100vw-1.5rem))] max-w-sm mx-3 p-0 rounded-2xl border border-slate-200/60 bg-white/80 shadow-[0_25px_60px_rgba(0,0,0,0.25)] backdrop-blur-lg supports-[backdrop-filter]:bg-white/65 transition-all duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        align="end"
        sideOffset={10}
      >
        <div className="px-4 py-3 border-b border-slate-200/60 bg-gradient-to-r from-white/70 via-slate-50/40 to-white/70 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold tracking-tight text-slate-800">Notifications</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-sm font-medium text-blue-600 hover:bg-blue-50/70 hover:text-blue-700 focus-visible:ring-blue-300"
              onClick={() => {
                setOpen(false);
                navigate(createPageUrl('Notifications'));
              }}
            >
              View all
            </Button>
          </div>
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="p-7 text-center text-sm text-slate-500">No notifications</div>
          ) : (
            filteredNotifications.slice(0, 5).map((n) => {
              const dispatch = n.related_dispatch_id
                ? dispatchMap[normalizeId(n.related_dispatch_id)] || null
                : null;
              const display = getNotificationDisplay(n, dispatch);

              const effectiveReadFlag = getNotificationEffectiveReadFlag({
                session,
                notification: n,
                dispatch,
                confirmations,
                ownerAllowedTrucks: ownerScopeTrucks,
              });

              return (
                <NotificationBellItem
                  key={n.id}
                  notification={n}
                  display={display}
                  effectiveReadFlag={effectiveReadFlag}
                  dispatch={dispatch}
                  confirmations={confirmations}
                  ownerAllowedTrucks={ownerScopeTrucks}
                  visibleTrucks={isOwner && dispatch
                    ? getNotificationTruckBadges(n, getVisibleTrucksForDispatch(dispatch))
                    : []}
                  onClick={() => handleNotificationClick(n)}
                />
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
