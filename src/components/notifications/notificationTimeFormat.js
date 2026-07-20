const APP_NOTIFICATION_TIMEZONE = 'America/New_York';

function parseNotificationTimestamp(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // Base44 notification created_date values are persisted in UTC but often come
  // back as a naive ISO-like string (no timezone suffix). Parse those as UTC.
  const hasExplicitTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  const normalized = hasExplicitTimezone ? raw : `${raw}Z`;
  const parsedDate = new Date(normalized);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function formatNotificationTime(value, { withYear = false } = {}) {
  if (!value) return '—';

  const parsedDate = parseNotificationTimestamp(value);
  if (!parsedDate) return '—';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: APP_NOTIFICATION_TIMEZONE,
  }).format(parsedDate);
}
