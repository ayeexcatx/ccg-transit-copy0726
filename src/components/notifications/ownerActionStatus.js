import {
  buildConfirmedTruckSetForStatus,
  deriveConfirmationCoverage,
  parseStatusFromDispatchStatusKey,
} from './confirmationStateHelpers';
import { getEffectiveView } from '@/components/session/workspaceUtils';

export const CLICK_TO_READ_NOTIFICATION_CATEGORIES = new Set([
  'dispatch_update_info',
  'driver_dispatch_seen',
  'availability_request',
  'owner_availability_updated',
]);
export const NON_ACTIONABLE_STATUS_CATEGORIES = new Set(['availability_request']);
export const NON_CONFIRMATION_NOTIFICATION_CATEGORIES = new Set([
  ...CLICK_TO_READ_NOTIFICATION_CATEGORIES,
  ...NON_ACTIONABLE_STATUS_CATEGORIES,
]);

function parseStatusFromDedupKey(notification) {
  return parseStatusFromDispatchStatusKey(notification?.dispatch_status_key);
}

export function isNotificationMarkedReadOnClick(notification) {
  return CLICK_TO_READ_NOTIFICATION_CATEGORIES.has(notification?.notification_category);
}

export function getNotificationEffectiveReadFlag({
  session,
  notification,
  dispatch = null,
  confirmations = [],
  ownerAllowedTrucks = [],
}) {
  if (getEffectiveView(session) !== 'CompanyOwner') {
    return Boolean(notification?.read_flag);
  }

  return getOwnerNotificationActionStatus({
    notification,
    dispatch,
    confirmations,
    ownerAllowedTrucks,
  }).effectiveReadFlag;
}

export function getOwnerNotificationRequiredTrucks({ notification, dispatch = null, ownerAllowedTrucks = [] }) {
  const fallbackRequired = Array.isArray(notification?.required_trucks)
    ? notification.required_trucks.filter(Boolean)
    : [];
  const allowedSet = ownerAllowedTrucks?.length ? new Set(ownerAllowedTrucks) : null;

  if (fallbackRequired.length) {
    return allowedSet
      ? fallbackRequired.filter((truck) => allowedSet.has(truck))
      : fallbackRequired;
  }

  if (!dispatch) return [];

  const dispatchTrucks = Array.isArray(dispatch?.trucks_assigned)
    ? dispatch.trucks_assigned.filter(Boolean)
    : [];

  if (!allowedSet) return dispatchTrucks;
  return dispatchTrucks.filter((truck) => allowedSet.has(truck));
}

export function getOwnerNotificationActionStatus({
  notification,
  dispatch = null,
  confirmations = [],
  ownerAllowedTrucks = [],
}) {
  const isOwnerNotification = notification?.recipient_type === 'AccessCode';
  const isConfirmationNotification = !NON_CONFIRMATION_NOTIFICATION_CATEGORIES.has(notification?.notification_category);
  const dispatchId = notification?.related_dispatch_id;
  const status = parseStatusFromDedupKey(notification);
  const currentDispatchStatus = String(dispatch?.status || '').trim();
  const isSupersededByCurrentStatus = Boolean(currentDispatchStatus && status && status !== currentDispatchStatus);

  if (!isOwnerNotification || !isConfirmationNotification || !dispatchId || !status) {
    return {
      isOwnerConfirmationNotification: false,
      status,
      requiredTrucks: [],
      confirmedTrucks: [],
      pendingTrucks: [],
      total: 0,
      done: 0,
      needsAction: !notification?.read_flag,
      effectiveReadFlag: Boolean(notification?.read_flag),
    };
  }

  if (isSupersededByCurrentStatus) {
    return {
      isOwnerConfirmationNotification: true,
      status,
      requiredTrucks: [],
      confirmedTrucks: [],
      pendingTrucks: [],
      total: 0,
      done: 0,
      needsAction: false,
      effectiveReadFlag: true,
    };
  }

  const requiredTrucks = getOwnerNotificationRequiredTrucks({ notification, dispatch, ownerAllowedTrucks });
  const confirmationSet = buildConfirmedTruckSetForStatus({
    confirmations,
    dispatchId,
    status,
  });
  const { confirmedTrucks, pendingTrucks, done, total, allConfirmed } = deriveConfirmationCoverage(requiredTrucks, confirmationSet);
  const hasActionableTruckScope = requiredTrucks.length > 0;
  const needsAction = hasActionableTruckScope ? !allConfirmed : !notification?.read_flag;

  return {
    isOwnerConfirmationNotification: true,
    status,
    requiredTrucks,
    confirmedTrucks,
    pendingTrucks,
    total,
    done,
    needsAction,
    effectiveReadFlag: !needsAction,
  };
}
