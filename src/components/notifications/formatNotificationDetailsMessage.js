import { format, isValid, parseISO } from 'date-fns';
import { formatDispatchDateTimeLine } from '@/components/notifications/dispatchDateTimeFormat';

const STATUS_LINE_VALUES = new Set([
  'Scheduled',
  'Scheduled (details to follow)',
  'Dispatch',
  'Dispatched',
  'Amended',
  'Cancelled',
  'Canceled',
]);

const OWNER_STATUS_HEADLINES = {
  Scheduled: 'Your truck has been scheduled',
  Dispatch: 'You have received a new dispatch',
  Dispatched: 'You have received a new dispatch',
  Amended: 'Your dispatch has been amended',
  Cancelled: 'Your dispatch has been canceled',
  Canceled: 'Your dispatch has been canceled',
};

export function formatNotificationDetailsMessage(message) {
  if (typeof message !== 'string') return message;

  const [dispatchDate, ...rest] = message.split(' · ');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dispatchDate)) return message;

  const parsedDate = parseISO(dispatchDate);
  if (!isValid(parsedDate)) return message;

  return [format(parsedDate, 'EEEE MM-dd-yyyy'), ...rest].join(' · ');
}

function getNotificationStatus(notification) {
  const dedupStatus = String(notification?.dispatch_status_key || '').split(':')[1];
  if (OWNER_STATUS_HEADLINES[dedupStatus]) return dedupStatus;

  const titleStatus = String(notification?.title || '').match(/^Status:\s*(.+)$/i)?.[1]?.trim();
  if (OWNER_STATUS_HEADLINES[titleStatus]) return titleStatus;

  return null;
}

export function formatOwnerDispatchMessage(message) {
  if (typeof message !== 'string') return message;

  const [dateTimeLine, detailsLine] = message.split('\n');
  if (!detailsLine) return message;

  const detailParts = detailsLine
    .split(' • ')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !STATUS_LINE_VALUES.has(part));

  return [dateTimeLine, detailParts.join(' • ')].filter(Boolean).join('\n');
}

function formatDriverSeenMessage(message) {
  if (typeof message !== 'string') return message;

  const [dateTimeLine, detailsLine, ...restLines] = message.split('\n');
  if (!detailsLine) return message;

  const detailParts = detailsLine
    .split(' • ')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^Trucks?:\s*/i.test(part))
    .filter((part) => !/^\d+\s+trucks?\s+seen$/i.test(part));

  return [dateTimeLine, detailParts.join(' • '), ...restLines].filter(Boolean).join('\n');
}

export function getNotificationDisplay(notification, dispatch = null) {
  const isAdminHeadlineNotification = new Set([
    'admin_dispatch_all_confirmed',
    'owner_truck_reassignment',
  ]).has(notification?.notification_category);

  if (notification?.notification_category === 'dispatch_update_info') {
    const dateTimeLine = formatDispatchDateTimeLine(dispatch, 'AT');
    const messageParts = [dateTimeLine, notification?.message].filter(Boolean);

    return {
      title: 'Your dispatch has been updated',
      message: messageParts.join('\n'),
      isOwnerDispatchStatus: true,
    };
  }

  if (notification?.notification_category === 'driver_dispatch_seen') {
    return {
      title: notification?.title,
      message: formatDriverSeenMessage(notification?.message),
      isOwnerDispatchStatus: false,
    };
  }

  const status = getNotificationStatus(notification);
  if (!status) {
    return {
      title: notification?.title,
      message: formatNotificationDetailsMessage(notification?.message),
      isOwnerDispatchStatus: isAdminHeadlineNotification,
    };
  }

  return {
    title: OWNER_STATUS_HEADLINES[status],
    message: formatOwnerDispatchMessage(notification?.message),
    isOwnerDispatchStatus: true,
  };
}
