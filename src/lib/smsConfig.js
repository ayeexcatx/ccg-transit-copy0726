import { base44 } from '@/api/base44Client';

const SMS_RULES_KEY = 'sms_rules_v1';
const SMS_TEMPLATE_SETTINGS_KEY = 'sms_template_settings_v1';
const SMS_BROADCAST_KEY_PREFIX = 'sms_broadcast_';

export const DEFAULT_SMS_RULES = {
  driver_dispatch_assigned: true,
  driver_dispatch_updated: true,
  driver_dispatch_amended: true,
  driver_dispatch_cancelled: true,
  driver_dispatch_removed: true,
  owner_dispatch_status_change: true,
  owner_dispatch_info_update: true,
  admin_notifications: true,
  welcome_sms: true,
  opt_out_confirmation_sms: true,
  informational_broadcast_sms: true,
};

const DEFAULT_TEMPLATE_SETTINGS = {
  support_footer: 'Support: alex@ccgnj.com',
};

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function getAppConfigRecord(key) {
  const records = await base44.entities.AppConfig.filter({ key }, '-created_date', 1);
  return records?.[0] || null;
}

export async function getSmsRules() {
  const record = await getAppConfigRecord(SMS_RULES_KEY);
  const parsed = parseJson(record?.value, {});
  return { ...DEFAULT_SMS_RULES, ...(parsed || {}) };
}

export async function saveSmsRules(nextRules) {
  const current = await getAppConfigRecord(SMS_RULES_KEY);
  const payload = {
    key: SMS_RULES_KEY,
    value: JSON.stringify({ ...DEFAULT_SMS_RULES, ...(nextRules || {}) }),
  };

  if (current?.id) return base44.entities.AppConfig.update(current.id, payload);
  return base44.entities.AppConfig.create(payload);
}

export async function getSmsTemplateSettings() {
  const record = await getAppConfigRecord(SMS_TEMPLATE_SETTINGS_KEY);
  const parsed = parseJson(record?.value, {});
  return { ...DEFAULT_TEMPLATE_SETTINGS, ...(parsed || {}) };
}

export async function saveSmsTemplateSettings(settings) {
  const current = await getAppConfigRecord(SMS_TEMPLATE_SETTINGS_KEY);
  const payload = {
    key: SMS_TEMPLATE_SETTINGS_KEY,
    value: JSON.stringify({ ...DEFAULT_TEMPLATE_SETTINGS, ...(settings || {}) }),
  };

  if (current?.id) return base44.entities.AppConfig.update(current.id, payload);
  return base44.entities.AppConfig.create(payload);
}

export function isDispatchNotificationType(notificationType) {
  const normalized = String(notificationType || '').toLowerCase();
  if (normalized.includes('amended')) return 'driver_dispatch_amended';
  if (normalized.includes('cancel')) return 'driver_dispatch_cancelled';
  if (normalized.includes('removed')) return 'driver_dispatch_removed';
  if (normalized.includes('assigned')) return 'driver_dispatch_assigned';
  if (normalized.includes('updated') || normalized.includes('update')) return 'driver_dispatch_updated';
  return null;
}

export function resolveSmsRuleKeyForNotification(notification = {}, recipient = null) {
  const codeType = recipient?.code_type;
  const dispatchRule = isDispatchNotificationType(notification?.notification_type);

  if (codeType === 'Driver') {
    return dispatchRule || 'driver_dispatch_updated';
  }

  if (codeType === 'CompanyOwner') {
    if (dispatchRule) return 'owner_dispatch_status_change';
    return 'owner_dispatch_info_update';
  }

  if (codeType === 'Admin') {
    return 'admin_notifications';
  }

  return null;
}

export function buildSmsBroadcastKey(id) {
  return `${SMS_BROADCAST_KEY_PREFIX}${id}`;
}

export async function listSmsBroadcasts() {
  const records = await base44.entities.AppConfig.list('-created_date', 500);
  return (records || [])
    .filter((record) => String(record?.key || '').startsWith(SMS_BROADCAST_KEY_PREFIX))
    .map((record) => {
      const parsed = parseJson(record.value, null);
      return parsed ? { id: record.id, key: record.key, ...parsed } : null;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0));
}

export async function saveSmsBroadcast(broadcast) {
  return base44.entities.AppConfig.create({
    key: buildSmsBroadcastKey(broadcast.broadcast_id),
    value: JSON.stringify(broadcast),
  });
}


export async function resolveEffectiveSharedAdminAccessCode() {
  const adminCodes = await base44.entities.AccessCode.filter({ code_type: 'Admin', active_flag: true }, '-created_date', 50);
  if (!adminCodes?.length) return null;

  // Shared-admin model: newest active Admin access-code record is the effective shared config.
  return adminCodes[0] || null;
}

