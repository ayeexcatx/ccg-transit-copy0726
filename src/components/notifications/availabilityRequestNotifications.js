import { base44 } from '@/api/base44Client';
import { sendNotificationSmsIfEligible } from '@/components/notifications/notificationSmsDelivery';

export const AVAILABILITY_REQUEST_NOTIFICATION_CATEGORY = 'availability_request';
export const AVAILABILITY_REQUEST_NOTIFICATION_TYPE = 'owner_availability_request';
export const OWNER_AVAILABILITY_UPDATED_NOTIFICATION_CATEGORY = 'owner_availability_updated';
export const OWNER_AVAILABILITY_UPDATED_NOTIFICATION_TYPE = 'owner_availability_updated_after_request';
export const AVAILABILITY_REQUEST_SMS_MESSAGE = [
  'CCG Transit:',
  'Your availability has been requested.',
  'Please visit the app and go to the calendar section and update your availability.',
  'Thank you.',
].join('\n');

const toTimestampMs = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

export function isAvailabilityRequestNotification(notification) {
  return notification?.notification_category === AVAILABILITY_REQUEST_NOTIFICATION_CATEGORY;
}

export function getAvailabilityRequestCreatedAtMs(notification) {
  return toTimestampMs(notification?.created_date);
}

export function getLatestAvailabilityUpdateMs({ defaults = [], overrides = [] } = {}) {
  const allRows = [...(Array.isArray(defaults) ? defaults : []), ...(Array.isArray(overrides) ? overrides : [])];
  return allRows.reduce((latest, row) => {
    const rowTs = Math.max(toTimestampMs(row?.updated_date), toTimestampMs(row?.created_date));
    return rowTs > latest ? rowTs : latest;
  }, 0);
}

export function isAvailabilityRequestUnresolved(notification, latestAvailabilityUpdateMs = 0) {
  if (!isAvailabilityRequestNotification(notification)) return false;
  const requestedAt = getAvailabilityRequestCreatedAtMs(notification);
  return requestedAt > latestAvailabilityUpdateMs;
}

export async function createAvailabilityRequestNotifications({
  companyId,
  companyName,
  requestedByLabel,
  sendSms = false,
}) {
  if (!companyId) return { created: [], ownerCount: 0 };

  const ownerCodes = await base44.entities.AccessCode.filter({
    company_id: companyId,
    active_flag: true,
    code_type: 'CompanyOwner',
  }, '-created_date', 200);

  const eligibleOwnerCodes = (ownerCodes || []).filter((code) => code?.id && code?.code_type === 'CompanyOwner' && code?.active_flag !== false);
  if (!eligibleOwnerCodes.length) return { created: [], ownerCount: 0 };

  const title = 'Availability Requested';
  const actorLine = requestedByLabel ? `Requested by ${requestedByLabel}.` : 'Requested by CCG admin.';
  const message = [
    'CCG requested your availability.',
    'Please update your availability.',
    actorLine,
  ].join(' ');

  const created = await Promise.all(eligibleOwnerCodes.map((ownerCode) =>
    base44.entities.Notification.create({
      recipient_type: 'AccessCode',
      recipient_access_code_id: ownerCode.id,
      recipient_id: ownerCode.id,
      recipient_company_id: companyId,
      title,
      message,
      read_flag: false,
      notification_category: AVAILABILITY_REQUEST_NOTIFICATION_CATEGORY,
      notification_type: AVAILABILITY_REQUEST_NOTIFICATION_TYPE,
    })
  ));

  if (sendSms && created.length) {
    await Promise.all(created.map((notification) =>
      sendNotificationSmsIfEligible(notification, {
        overrideMessage: AVAILABILITY_REQUEST_SMS_MESSAGE,
      })
    ));
  }

  return {
    created,
    ownerCount: eligibleOwnerCodes.length,
    companyName: companyName || null,
  };
}

export async function getLatestOutstandingAvailabilityRequest({
  companyId,
  ownerAccessCodeId,
  latestAvailabilityUpdateMs = 0,
}) {
  if (!companyId || !ownerAccessCodeId) return null;

  const ownerNotifications = await base44.entities.Notification.filter({
    recipient_type: 'AccessCode',
    recipient_company_id: companyId,
    recipient_access_code_id: ownerAccessCodeId,
    notification_category: AVAILABILITY_REQUEST_NOTIFICATION_CATEGORY,
  }, '-created_date', 200);

  const unresolved = (ownerNotifications || [])
    .filter((notification) => isAvailabilityRequestUnresolved(notification, latestAvailabilityUpdateMs))
    .sort((a, b) => getAvailabilityRequestCreatedAtMs(b) - getAvailabilityRequestCreatedAtMs(a));

  return unresolved[0] || null;
}

export async function createOwnerAvailabilityUpdatedAdminNotification({
  companyId,
  companyName,
  ownerName,
  sourceRequestNotificationId,
}) {
  if (!companyId || !sourceRequestNotificationId) return null;

  const normalizedRequestId = String(sourceRequestNotificationId);
  const existing = await base44.entities.Notification.filter({
    recipient_type: 'Admin',
    notification_category: OWNER_AVAILABILITY_UPDATED_NOTIFICATION_CATEGORY,
    source_request_notification_id: normalizedRequestId,
  }, '-created_date', 1);

  if (existing?.length) return existing[0];

  const safeOwnerName = ownerName || 'Company owner';
  const safeCompanyName = companyName || 'company';

  return base44.entities.Notification.create({
    recipient_type: 'Admin',
    title: 'Availability Updated',
    message: `${safeOwnerName} for ${safeCompanyName} updated their availability.`,
    read_flag: false,
    notification_category: OWNER_AVAILABILITY_UPDATED_NOTIFICATION_CATEGORY,
    notification_type: OWNER_AVAILABILITY_UPDATED_NOTIFICATION_TYPE,
    recipient_company_id: companyId,
    source_request_notification_id: normalizedRequestId,
  });
}
