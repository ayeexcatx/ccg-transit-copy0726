import { base44 } from '@/api/base44Client';
import { formatDispatchDateTimeLine } from '@/components/notifications/dispatchDateTimeFormat';
import { getAdminSmsProductState, getCompanyOwnerSmsState, getDriverSmsState } from '@/lib/sms';
import { getEffectiveTruckStartTime } from '@/lib/dispatchTruckOverrides';
import { normalizeUsSmsPhone } from '@/lib/smsPhone';
import { getSmsRules, resolveEffectiveSharedAdminAccessCode, resolveSmsRuleKeyForNotification } from '@/lib/smsConfig';
import { format, isValid, parseISO } from 'date-fns';

const SMS_PROVIDER = 'signalwire';
const SMS_BRAND_PREFIX = 'CCG Transit:';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function maskPhone(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;

  const lastFour = normalized.slice(-4);
  return `***${lastFour}`;
}

function stringifyError(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function buildStageErrorMessage(stage, error, context = {}) {
  const errorText = stringifyError(error);
  const suffix = Object.keys(context).length ? ` | context=${JSON.stringify(context)}` : '';
  return `stage=${stage} | error=${errorText}${suffix}`;
}

function normalizeHeadline(value) {
  const headline = normalizeText(value);
  if (!headline) return '';
  return /[.!?]$/.test(headline) ? headline : `${headline}.`;
}

function hasBrandPrefix(message) {
  return normalizeText(message).toLowerCase().startsWith(SMS_BRAND_PREFIX.toLowerCase());
}

function withSmsBranding(message) {
  const text = normalizeText(message);
  if (!text) return `${SMS_BRAND_PREFIX} Please open the app for updates.`;
  if (hasBrandPrefix(text)) return text;
  return `${SMS_BRAND_PREFIX} ${text}`;
}

function parseDispatchStatusFromKey(dispatchStatusKey) {
  const key = String(dispatchStatusKey || '').trim();
  if (!key) return '';

  const parts = key.split(':');
  return String(parts?.[1] || '').trim();
}

function resolveOwnerDispatchSmsStatus(notification) {
  const parsedStatus = parseDispatchStatusFromKey(notification?.dispatch_status_key);
  if (parsedStatus) return parsedStatus;

  const normalizedType = String(notification?.notification_type || '').trim().toLowerCase();
  if (normalizedType === 'informational') return 'Update';

  const normalizedCategory = String(notification?.notification_category || '').trim().toLowerCase();
  if (normalizedCategory === 'dispatch_update_info') return 'Update';

  const rawTitle = String(notification?.title || '').trim().toLowerCase();
  if (rawTitle.includes('scheduled')) return 'Scheduled';
  if (rawTitle.includes('dispatch')) return 'Dispatch';
  if (rawTitle.includes('amended') || rawTitle.includes('amendment')) return 'Amended';
  if (rawTitle.includes('cancelled') || rawTitle.includes('canceled') || rawTitle.includes('cancellation')) return 'Cancelled';
  if (rawTitle.includes('update')) return 'Update';

  return '';
}

function formatOwnerDispatchDateShiftLine(dispatch) {
  const parsedDate = dispatch?.date ? parseISO(dispatch.date) : null;
  if (!parsedDate || !isValid(parsedDate)) return '';

  const dateText = format(parsedDate, 'EEE MM-dd-yyyy').toUpperCase();
  const normalizedShift = String(dispatch?.shift_time || '').trim().toUpperCase();
  const shiftText = normalizedShift.includes('NIGHT') ? 'NIGHT SHIFT' : 'DAY SHIFT';

  return `${dateText} ${shiftText}`;
}

function formatOwnerDispatchDateTimeLine(dispatch) {
  const dateTimeLine = formatDispatchDateTimeLine(dispatch, 'at');
  return dateTimeLine.replace(/\s+at\s+/g, ' at ');
}

function buildCompanyOwnerDispatchSmsMessage(notification, dispatch) {
  const status = resolveOwnerDispatchSmsStatus(notification);
  const requiredTrucks = Array.isArray(notification?.required_trucks)
    ? notification.required_trucks.filter(Boolean)
    : [];
  const truckCount = requiredTrucks.length || (Array.isArray(dispatch?.trucks_assigned) ? dispatch.trucks_assigned.filter(Boolean).length : 0);

  if (status === 'Scheduled') {
    const displayTruckCount = truckCount > 0 ? truckCount : 1;
    const truckLine = displayTruckCount === 1
      ? '(1) truck has been scheduled for:'
      : `(${displayTruckCount}) trucks have been scheduled for:`;
    const dateShiftLine = formatOwnerDispatchDateShiftLine(dispatch) || 'Dispatch details are available in the app.';

    return [
      `${SMS_BRAND_PREFIX} Scheduled`,
      truckLine,
      dateShiftLine,
      '',
      'Details to follow.',
      'Please open the app to view and confirm.',
    ].join('\n');
  }

  if (status === 'Dispatch') {
    return [
      `${SMS_BRAND_PREFIX} Dispatch`,
      'You have received a new dispatch for:',
      formatOwnerDispatchDateTimeLine(dispatch) || 'Dispatch details are available in the app.',
      '',
      'Please open the app to view and CONFIRM.',
    ].join('\n');
  }

  if (status === 'Amended') {
    return [
      `${SMS_BRAND_PREFIX} Amendment`,
      'Your dispatch has been amended to:',
      formatOwnerDispatchDateTimeLine(dispatch) || 'Dispatch details are available in the app.',
      '',
      'Please open the app to view and CONFIRM.',
    ].join('\n');
  }

  if (status === 'Cancelled') {
    return [
      `${SMS_BRAND_PREFIX} Cancellation`,
      'Your dispatch has been cancelled:',
      formatOwnerDispatchDateTimeLine(dispatch) || 'Dispatch details are available in the app.',
      '',
      'Please open the app to view and CONFIRM.',
    ].join('\n');
  }

  if (status === 'Update') {
    return [
      `${SMS_BRAND_PREFIX} Update`,
      'Your dispatch has been updated:',
      formatOwnerDispatchDateTimeLine(dispatch) || 'Dispatch details are available in the app.',
      '',
      'Please open the app to view and CONFIRM.',
    ].join('\n');
  }

  return '';
}

async function resolveRelatedDispatch(notification) {
  const dispatchId = notification?.related_dispatch_id;
  if (!dispatchId) return null;

  try {
    const records = await base44.entities.Dispatch.filter({ id: dispatchId }, '-created_date', 1);
    return records?.[0] || null;
  } catch (error) {
    console.error('SMS debug: failed resolving dispatch for SMS format', {
      notificationId: notification?.id || null,
      dispatchId,
      error,
    });
    return null;
  }
}

function resolveDriverDispatchDateTimeLine(notification, dispatch) {
  if (!dispatch) return '';
  const normalizedTrucks = [...new Set((notification?.required_trucks || []).filter(Boolean))];
  const effectiveTimes = [...new Set(normalizedTrucks.map((truckNumber) => getEffectiveTruckStartTime(dispatch, truckNumber)).filter(Boolean))];
  const driverStartTime = effectiveTimes.length === 1 ? effectiveTimes[0] : null;
  return formatDispatchDateTimeLine(dispatch, 'at', driverStartTime);
}

async function buildSmsMessage(notification, recipient, options = {}) {
  const overrideMessage = normalizeText(options?.overrideMessage);
  if (overrideMessage) return overrideMessage;

  if (!notification?.related_dispatch_id) {
    return withSmsBranding(notification?.message || '');
  }

  const dispatch = await resolveRelatedDispatch(notification);

  if (recipient?.code_type === 'CompanyOwner') {
    const ownerDispatchMessage = buildCompanyOwnerDispatchSmsMessage(notification, dispatch);
    if (ownerDispatchMessage) return ownerDispatchMessage;
  }

  const headline = normalizeHeadline(notification?.title || 'Dispatch update');
  const dispatchDateTimeLine = resolveDriverDispatchDateTimeLine(notification, dispatch);
  const dispatchLine = dispatchDateTimeLine || 'Dispatch details are available in the app.';

  return `${SMS_BRAND_PREFIX} ${headline}\n${dispatchLine}\n\nPlease open the app to view and confirm.`;
}

async function createSmsLog({
  notification,
  recipient,
  phone,
  message,
  status,
  skipReason = null,
  errorMessage = null,
  provider = SMS_PROVIDER,
  providerMessageId = null,
  sentAt = null,
}) {
  try {
    await base44.entities.General.create({
      record_type: 'sms_log',
      notification_id: notification?.id || null,
      dispatch_id: notification?.related_dispatch_id || null,
      recipient_access_code_id: recipient?.id || notification?.recipient_access_code_id || notification?.recipient_id || null,
      recipient_type: notification?.recipient_type || null,
      recipient_name: recipient?.label || recipient?.name || recipient?.code || null,
      phone: phone || null,
      message: message || null,
      status,
      skip_reason: skipReason,
      error_message: errorMessage,
      provider,
      provider_message_id: providerMessageId,
      sent_at: sentAt,
    });

    console.log('SMS debug: General log create succeeded', {
      notificationId: notification?.id || null,
      status,
      skipReason: skipReason || null,
    });
  } catch (error) {
    console.error('SMS debug: General log create failed', {
      notificationId: notification?.id || null,
      status,
      skipReason: skipReason || null,
      error,
    });
  }
}


async function resolveSmsEligibility(recipient) {
  if (!recipient) {
    return { smsEnabled: false, smsPhone: '', skipReason: 'recipient_access_code_not_found' };
  }

  if (recipient.sms_opted_out_at) {
    return {
      smsEnabled: false,
      smsPhone: normalizeUsSmsPhone(recipient.sms_phone),
      skipReason: 'sms_opted_out',
    };
  }

  if (recipient.code_type === 'Driver') {
    const driverRecords = await base44.entities.Driver.filter({ id: recipient.driver_id }, '-created_date', 1);
    const driver = driverRecords?.[0] || null;
    const state = getDriverSmsState(driver);
    return {
      smsEnabled: state.effective,
      smsPhone: state.normalizedPhone || '',
      skipReason: !state.ownerEnabled ? 'owner_sms_disabled' : !state.driverOptedIn ? 'driver_not_opted_in' : !state.hasValidPhone ? 'missing_sms_phone' : null,
    };
  }

  if (recipient.code_type === 'CompanyOwner') {
    const state = getCompanyOwnerSmsState({ accessCode: recipient, company: null });
    return {
      smsEnabled: state.effective,
      smsPhone: state.normalizedPhone || '',
      skipReason: state.optedOut ? 'sms_opted_out' : !state.optedIn ? 'owner_not_opted_in' : !state.hasValidPhone ? 'missing_sms_phone' : null,
    };
  }

  if (recipient.code_type === 'Admin') {
    const adminState = getAdminSmsProductState(recipient);
    return {
      smsEnabled: adminState.optedIn && !adminState.optedOut && adminState.hasValidPhone,
      smsPhone: normalizeUsSmsPhone(recipient.sms_phone),
      skipReason: adminState.optedOut ? 'sms_opted_out' : !adminState.optedIn ? 'sms_disabled' : !adminState.hasValidPhone ? 'missing_sms_phone' : null,
    };
  }

  return {
    smsEnabled: false,
    smsPhone: '',
    skipReason: 'unsupported_access_code_type',
  };
}


async function evaluateRuleEligibility(notification, recipient) {
  const smsRules = await getSmsRules();
  const ruleKey = resolveSmsRuleKeyForNotification(notification, recipient);

  if (!ruleKey) {
    return { allowed: true, ruleKey: null };
  }

  return {
    allowed: smsRules[ruleKey] !== false,
    ruleKey,
  };
}

async function resolveRecipientAccessCode(notification) {
  if (notification?.recipient_type === 'Admin') {
    return resolveEffectiveSharedAdminAccessCode();
  }

  const recipientId = notification?.recipient_access_code_id || notification?.recipient_id;
  if (!recipientId) return null;

  const records = await base44.entities.AccessCode.filter({ id: recipientId }, '-created_date', 1);
  return records?.[0] || null;
}

export async function sendNotificationSmsIfEligible(notification, options = {}) {
  let stage = 'start';
  let recipient = null;
  let smsPhone = '';
  let smsMessage = '';

  try {
    if (!notification?.id) return;

    console.log('SMS debug: sendNotificationSmsIfEligible invoked', {
      notificationId: notification.id,
      recipientType: notification.recipient_type,
      recipientAccessCodeId: notification.recipient_access_code_id || null,
      recipientId: notification.recipient_id || null,
      title: notification.title || null,
    });

    if (!['AccessCode', 'Admin'].includes(notification.recipient_type)) {
      console.log('SMS debug exit: recipient not AccessCode', {
        notificationId: notification.id,
        recipientType: notification.recipient_type,
        recipientAccessCodeId: notification.recipient_access_code_id || null,
        recipientId: notification.recipient_id || null,
      });

      await createSmsLog({
        notification,
        recipient: null,
        phone: null,
        message: notification.message || null,
        status: 'skipped',
        skipReason: 'recipient_not_supported',
      });
      return;
    }

    stage = 'recipient_resolution';
    recipient = await resolveRecipientAccessCode(notification);
    if (!recipient) {
      console.log('SMS debug exit: recipient access code not found', {
        notificationId: notification.id,
        recipientAccessCodeId: notification.recipient_access_code_id || null,
        recipientId: notification.recipient_id || null,
      });

      await createSmsLog({
        notification,
        recipient: null,
        phone: null,
        message: notification.message || null,
        status: 'skipped',
        skipReason: notification.recipient_type === 'Admin'
          ? 'shared_admin_config_not_found:recipient_resolution'
          : 'recipient_access_code_not_found:recipient_resolution',
        errorMessage: buildStageErrorMessage('recipient_resolution', 'no_recipient', {
          notificationRecipientAccessCodeId: notification.recipient_access_code_id || null,
          notificationRecipientId: notification.recipient_id || null,
        }),
      });
      return;
    }

    stage = 'rule_eligibility';
    const { allowed, ruleKey } = await evaluateRuleEligibility(notification, recipient);
    if (!allowed) {
      await createSmsLog({
        notification,
        recipient,
        phone: null,
        message: notification.message || null,
        status: 'skipped',
        skipReason: `rule_disabled:${ruleKey}:rule_eligibility` ,
      });
      return;
    }

    let eligibility;
    try {
      stage = 'sms_eligibility_resolution';
      eligibility = await resolveSmsEligibility(recipient);
    } catch (error) {
      console.error('SMS debug exit: failed to resolve recipient SMS eligibility', {
        notificationId: notification.id,
        recipientAccessCodeId: recipient.id,
        recipientCodeType: recipient.code_type || null,
        error,
      });

      await createSmsLog({
        notification,
        recipient,
        phone: null,
        message: notification.message || null,
        status: 'skipped',
        skipReason: 'sms_eligibility_resolution_failed:sms_eligibility_resolution',
        errorMessage: buildStageErrorMessage('sms_eligibility_resolution', error, {
          notificationRecipientAccessCodeId: notification.recipient_access_code_id || null,
          notificationRecipientId: notification.recipient_id || null,
          resolvedRecipientId: recipient?.id || null,
          recipientCodeType: recipient?.code_type || null,
        }),
      });
      return;
    }
    const { smsEnabled, smsPhone: resolvedSmsPhone, skipReason } = eligibility;
    smsPhone = resolvedSmsPhone || '';

    if (!smsEnabled) {
      console.log('SMS debug exit: sms disabled', {
        notificationId: notification.id,
        recipientAccessCodeId: recipient.id,
      });

      await createSmsLog({
        notification,
        recipient,
        phone: maskPhone(smsPhone) || null,
        message: notification.message || null,
        status: 'skipped',
        skipReason: `${skipReason || 'sms_disabled'}:sms_eligibility_resolution`,
      });
      return;
    }

    if (!smsPhone) {
      console.log('SMS debug exit: missing sms phone', {
        notificationId: notification.id,
        recipientAccessCodeId: recipient.id,
      });

      await createSmsLog({
        notification,
        recipient,
        phone: null,
        message: notification.message || null,
        status: 'skipped',
        skipReason: 'missing_sms_phone:sms_eligibility_resolution',
      });
      return;
    }

    console.log('SMS debug: before invoking backend function', {
      notificationId: notification.id,
      recipientAccessCodeId: recipient.id,
      phoneMasked: maskPhone(smsPhone),
      relatedDispatchId: notification.related_dispatch_id || null,
    });

    stage = 'sms_message_building';
    smsMessage = await buildSmsMessage(notification, recipient, options);

    stage = 'backend_function_invoke';
    const response = await base44.functions.invoke('sendNotificationSms', {
      phone: smsPhone,
      message: smsMessage,
      notificationId: notification.id,
      dispatchId: notification.related_dispatch_id || null,
      recipientAccessCodeId: recipient.id,
    });

    const responseData = response?.data || response || {};

    console.log('SMS debug: after backend function response', {
      notificationId: notification.id,
      recipientAccessCodeId: recipient.id,
      responseData,
    });

    if (responseData?.ok) {
      await createSmsLog({
        notification,
        recipient,
        phone: smsPhone,
        message: smsMessage || null,
        status: 'sent',
        provider: responseData.provider || SMS_PROVIDER,
        providerMessageId: responseData.providerMessageId || null,
        sentAt: responseData.sentAt || new Date().toISOString(),
      });
      return;
    }

    const reason = responseData?.reason || null;
    const isProviderNotConfigured = reason === 'provider_not_configured';
    const errorMessage = responseData?.error || 'Unknown SignalWire provider error';

    await createSmsLog({
      notification,
      recipient,
      phone: maskPhone(smsPhone) || null,
      message: smsMessage || null,
      status: isProviderNotConfigured ? 'skipped' : 'failed',
      skipReason: isProviderNotConfigured ? 'provider_not_configured:backend_function_invoke' : null,
      errorMessage: buildStageErrorMessage('backend_function_invoke', errorMessage, {
        responseReason: reason || null,
      }),
      provider: responseData?.provider || SMS_PROVIDER,
      providerMessageId: responseData?.providerMessageId || null,
    });
  } catch (error) {
    console.error('SMS delivery attempt failed:', {
      stage,
      notificationId: notification?.id || null,
      notificationRecipientAccessCodeId: notification?.recipient_access_code_id || null,
      notificationRecipientId: notification?.recipient_id || null,
      resolvedRecipientId: recipient?.id || null,
      recipientCodeType: recipient?.code_type || null,
      maskedPhone: maskPhone(smsPhone),
      error,
    });

    await createSmsLog({
      notification,
      recipient: recipient || null,
      phone: maskPhone(smsPhone) || null,
      message: smsMessage || notification?.message || null,
      status: 'failed',
      errorMessage: buildStageErrorMessage(stage, error, {
        notificationRecipientAccessCodeId: notification?.recipient_access_code_id || null,
        notificationRecipientId: notification?.recipient_id || null,
        resolvedRecipientId: recipient?.id || null,
        recipientCodeType: recipient?.code_type || null,
      }),
    });
  }
}
