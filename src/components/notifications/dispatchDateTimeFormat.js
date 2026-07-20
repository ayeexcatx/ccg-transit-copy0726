import { format, isValid, parseISO } from 'date-fns';

export function formatStartTimeToAmPm(startTime) {
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

  const hour24 = Number(hhMmMatch[1]);
  const minute = hhMmMatch[2];
  if (!Number.isFinite(hour24) || hour24 < 0 || hour24 > 23) return '';

  const period = hour24 >= 12 ? 'PM' : 'AM';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${minute} ${period}`;
}

export function formatDispatchDateTimeLine(dispatch, atToken = 'at', startTimeOverride = null) {
  const parsedDate = dispatch?.date ? parseISO(dispatch.date) : null;
  if (!parsedDate || !isValid(parsedDate)) return '';

  const dateText = format(parsedDate, 'EEE MM-dd-yyyy').toUpperCase();
  const timeText = formatStartTimeToAmPm(startTimeOverride ?? dispatch?.start_time);

  if (!timeText) return dateText;
  return `${dateText} ${atToken} ${timeText}`;
}
