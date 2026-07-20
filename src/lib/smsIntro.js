import { base44 } from '@/api/base44Client';
import { normalizeUsSmsPhone } from '@/lib/smsPhone';
import { getSmsRules } from '@/lib/smsConfig';

const SMS_PROVIDER = 'signalwire';

export const SMS_WELCOME_MESSAGE = 'CCG Transit: You are now subscribed to receive text notifications. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out. Reply HELP for help. For questions, email Support at: alex@ccgnj.com';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function createWelcomeSmsLog({
  accessCodeId,
  phone,
  status,
  skipReason = null,
  errorMessage = null,
  providerMessageId = null,
  sentAt = null,
}) {
  try {
    await base44.entities.General.create({
      record_type: 'sms_log',
      notification_id: null,
      dispatch_id: null,
      recipient_access_code_id: accessCodeId || null,
      recipient_type: 'AccessCode',
      recipient_name: null,
      phone: phone || null,
      message: SMS_WELCOME_MESSAGE,
      status,
      skip_reason: skipReason,
      error_message: errorMessage,
      provider: SMS_PROVIDER,
      provider_message_id: providerMessageId,
      sent_at: sentAt,
    });
  } catch (error) {
    console.error('Failed to log welcome SMS event', error);
  }
}

async function hasWelcomeSmsAlreadySent(accessCodeId) {
  if (!accessCodeId) return false;

  const existingLogs = await base44.entities.General.filter({
    record_type: 'sms_log',
    recipient_access_code_id: accessCodeId,
  }, '-created_date', 25);

  const sentStatuses = new Set(['sent', 'delivered']);
  const normalizedWelcomeMessage = normalizeText(SMS_WELCOME_MESSAGE);
  const hasSuccessfulWelcomeLog = (existingLogs || []).some((log) => {
    const normalizedStatus = String(log?.status || '').trim().toLowerCase();
    if (!sentStatuses.has(normalizedStatus)) return false;

    const normalizedMessage = normalizeText(log?.message);
    const isWelcomeMessage = normalizedMessage === normalizedWelcomeMessage;
    const hasProviderMessageId = Boolean(normalizeText(log?.provider_message_id));
    const legacyIntroSkipMarker = normalizeText(log?.skip_reason) === 'intro_sms_sent';

    return isWelcomeMessage || hasProviderMessageId || legacyIntroSkipMarker;
  });

  return hasSuccessfulWelcomeLog;
}

async function markWelcomeSent(accessCodeId, phone, providerMessageId = null, sentAt = null) {
  await base44.entities.AccessCode.update(accessCodeId, {
    sms_intro_sent_at: sentAt || new Date().toISOString(),
  });

  await createWelcomeSmsLog({
    accessCodeId,
    phone,
    status: 'sent',
    skipReason: null,
    providerMessageId,
    sentAt: sentAt || new Date().toISOString(),
  });
}

async function logWelcomeSkip({ accessCodeId, phone, skipReason }) {
  if (!accessCodeId || !skipReason) return;
  await createWelcomeSmsLog({
    accessCodeId,
    phone,
    status: 'skipped',
    skipReason,
  });
}

async function logWelcomeSmsFailure({ accessCodeId, phone, errorMessage }) {
  await createWelcomeSmsLog({
    accessCodeId,
    phone,
    status: 'failed',
    skipReason: 'intro_sms_send_failed',
    errorMessage: errorMessage || null,
  });
}


async function updateIntroSentTimestampIfMissing(accessCode, sentAt) {
  if (accessCode?.sms_intro_sent_at) return;
  try {
    await base44.entities.AccessCode.update(accessCode.id, {
      sms_intro_sent_at: sentAt || new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to backfill sms_intro_sent_at after existing intro log', error);
  }
}

export async function sendSmsWelcomeIfNeeded({ accessCodeId, consentGiven }) {
  if (!accessCodeId || consentGiven !== true) return;

  const records = await base44.entities.AccessCode.filter({ id: accessCodeId }, '-created_date', 1);
  const accessCode = records?.[0] || null;

  if (!accessCode) return;
  if (accessCode.sms_intro_sent_at) {
    await logWelcomeSkip({ accessCodeId: accessCode.id, phone: accessCode.sms_phone, skipReason: 'intro_already_sent' });
    return;
  }
  if (accessCode.sms_enabled !== true) {
    await logWelcomeSkip({ accessCodeId: accessCode.id, phone: accessCode.sms_phone, skipReason: 'intro_sms_disabled' });
    return;
  }

  const phone = normalizeUsSmsPhone(accessCode.sms_phone);
  if (!phone) {
    await logWelcomeSkip({ accessCodeId: accessCode.id, phone: null, skipReason: 'intro_missing_phone' });
    return;
  }
  const smsRules = await getSmsRules();
  if (!smsRules.welcome_sms) {
    await logWelcomeSkip({ accessCodeId: accessCode.id, phone, skipReason: 'intro_rule_disabled' });
    return;
  }

  const alreadySentByLog = await hasWelcomeSmsAlreadySent(accessCode.id);
  if (alreadySentByLog) {
    await updateIntroSentTimestampIfMissing(accessCode, new Date().toISOString());
    await logWelcomeSkip({ accessCodeId: accessCode.id, phone, skipReason: 'intro_already_sent' });
    return;
  }

  try {
    const response = await base44.functions.invoke('sendNotificationSms', {
      phone,
      message: SMS_WELCOME_MESSAGE,
    });

    const responseData = response?.data || response || {};
    const sentAt = responseData?.sentAt || new Date().toISOString();
    await markWelcomeSent(accessCode.id, phone, responseData?.providerMessageId || null, sentAt);
  } catch (error) {
    console.error('Failed sending welcome SMS', error);
    await logWelcomeSmsFailure({
      accessCodeId: accessCode.id,
      phone,
      errorMessage: error?.message || String(error),
    });
  }
}
