import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import { getOwnerNotificationActionStatus } from './ownerActionStatus';

/**
 * Shows "Pending confirmations: X/Y trucks" for owner notifications,
 * or nothing for resolved / non-owner notifications.
 *
 * If dispatch is provided, prefers live dispatch trucks intersected with ownerAllowedTrucks.
 */
export default function NotificationStatusBadge({
  notification,
  confirmations = [],
  dispatch = null,
  ownerAllowedTrucks = [],
}) {
  const { total, done, isOwnerConfirmationNotification, needsAction } = getOwnerNotificationActionStatus({
    notification,
    dispatch,
    confirmations,
    ownerAllowedTrucks,
  });

  if (!isOwnerConfirmationNotification || total === 0) return null;

  const isResolved = !needsAction;

  if (isResolved) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
        <CheckCircle2 className="h-3 w-3" />All confirmed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
      <Clock className="h-3 w-3" />
      Pending confirmations: {done}/{total} trucks
    </span>
  );
}
