export function normalizeTimeValue(value) {
  if (!value) return '';
  const raw = String(value).trim();

  const amPmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])$/);
  if (amPmMatch) {
    let hour = Number.parseInt(amPmMatch[1], 10);
    const minute = Number.parseInt(amPmMatch[2], 10);
    const period = amPmMatch[3].toUpperCase();
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 1 || hour > 12 || minute < 0 || minute > 59) {
      return raw;
    }

    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return raw;
  const hh = Number.parseInt(m[1], 10);
  const mm = Number.parseInt(m[2], 10);
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return raw;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function formatTime24h(value) {
  return normalizeTimeValue(value);
}

export function hasCompleteTimeLog(entry) {
  return Boolean(entry?.start_time && entry?.end_time);
}

function toMinutes(value) {
  const normalized = normalizeTimeValue(value);
  const m = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number.parseInt(m[1], 10) * 60 + Number.parseInt(m[2], 10);
}

export function calculateWorkedHours(startTime, endTime) {
  const startMin = toMinutes(startTime);
  const endMin = toMinutes(endTime);
  if (startMin == null || endMin == null) return null;
  let durationMinutes = endMin - startMin;
  if (durationMinutes < 0) durationMinutes += 24 * 60;
  return durationMinutes / 60;
}

export function formatWorkedHours(hours) {
  if (hours == null || Number.isNaN(hours)) return '';
  return Number(hours.toFixed(2)).toString();
}

export function getTimeEntryCompositeKey(dispatchId, truckNumber) {
  if (!dispatchId || !truckNumber) return '';
  return `${dispatchId}::${truckNumber}`;
}

export function getTimeEntryTimestampMs(entry) {
  const value = entry?.last_updated_at || entry?.updated_date || entry?.created_date || 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function pickPreferredTimeEntry(left, right) {
  if (!left) return right;
  if (!right) return left;

  const leftTime = getTimeEntryTimestampMs(left);
  const rightTime = getTimeEntryTimestampMs(right);
  if (rightTime !== leftTime) {
    return rightTime > leftTime ? right : left;
  }

  const leftCreated = new Date(left?.created_date || 0).getTime();
  const rightCreated = new Date(right?.created_date || 0).getTime();
  if (rightCreated !== leftCreated) {
    return rightCreated > leftCreated ? right : left;
  }

  return String(right?.id || '') > String(left?.id || '') ? right : left;
}

export function dedupeTimeEntries(entries = []) {
  const byKey = new Map();

  entries.forEach((entry) => {
    const key = getTimeEntryCompositeKey(entry?.dispatch_id, entry?.truck_number);
    if (!key) return;
    const current = byKey.get(key);
    byKey.set(key, pickPreferredTimeEntry(current, entry));
  });

  return [...byKey.values()];
}

export function areAllAssignedTrucksTimeComplete(dispatch, dispatchTimeEntries = []) {
  const assigned = dispatch?.trucks_assigned || [];
  if (assigned.length === 0) return false;

  return assigned.every((truck) => {
    const entry = dispatchTimeEntries.find((te) => te.truck_number === truck);
    return hasCompleteTimeLog(entry);
  });
}
