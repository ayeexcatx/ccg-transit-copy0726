import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

type SignalWireInboundPayload = {
  MessageSid?: string;
  SmsSid?: string;
  AccountSid?: string;
  MessagingServiceSid?: string;
  From?: string;
  To?: string;
  Body?: string;
  [key: string]: unknown;
};

const STOP_KEYWORDS = new Set(['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT']);
const HELP_KEYWORDS = new Set(['HELP', 'SUPPORT']);
const START_KEYWORDS = new Set(['START', 'YES', 'SUBSCRIBE']);

const MESSAGES = {
  stop: 'CCG Transit: You have been unsubscribed from SMS notifications and will no longer receive text messages. To re-enable, log into the app & update your Profile.',
  help: 'CCG Transit: You are receiving CCG related text notifications. For help, contact alex@ccgnj.com. Reply STOP to opt out.',
  resubscribeBlocked: 'CCG Transit: To re-enable SMS notifications, please log into the app and enable SMS in your Profile settings.',
};

function normalizePhoneForMatch(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  return digits;
}

function pickPayloadValue(payload: SignalWireInboundPayload, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function normalizeKeyword(value: string): string {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return '';
  return text.split(/\s+/)[0] || '';
}

function parseInboundPayload(req: Request, contentType: string): Promise<SignalWireInboundPayload> {
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return req.formData().then((form) => Object.fromEntries(form.entries()) as SignalWireInboundPayload);
  }

  if (contentType.includes('application/json')) {
    return req.json();
  }

  return req.formData().then((form) => Object.fromEntries(form.entries()) as SignalWireInboundPayload);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildCxmlResponse(message?: string | null): string {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(trimmed)}</Message></Response>`;
}

function xmlResponse(message?: string | null): Response {
  return new Response(buildCxmlResponse(message), {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

async function createInboundLog(base44: ReturnType<typeof createClientFromRequest>, payload: Record<string, unknown>) {
  try {
    await base44.asServiceRole.entities.General.create(payload);
    return true;
  } catch (error) {
    console.error('signalwireSmsInboundWebhook: failed to create sms_inbound_log', error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  try {
    const contentType = req.headers.get('content-type') || '';
    const payload = await parseInboundPayload(req, contentType);

    const from = pickPayloadValue(payload, ['From', 'from']);
    const to = pickPayloadValue(payload, ['To', 'to']);
    const body = pickPayloadValue(payload, ['Body', 'body']);
    const keyword = normalizeKeyword(body);

    const providerMessageId = pickPayloadValue(payload, ['MessageSid', 'SmsSid', 'message_sid', 'sms_sid']) || null;

    const base44 = createClientFromRequest(req);

    const normalizedFrom = normalizePhoneForMatch(from);
    console.log('signalwireSmsInboundWebhook inbound received', {
      from,
      to,
      body,
      keyword,
      normalizedFrom,
      providerMessageId,
    });

    const candidates = await base44.asServiceRole.entities.AccessCode.filter({
      sms_phone: from,
    }, '-created_date', 5);

    let accessCode = candidates?.[0] || null;

    if (!accessCode && normalizedFrom) {
      const plusOne = `+${normalizedFrom}`;
      const altCandidates = await base44.asServiceRole.entities.AccessCode.filter({ sms_phone: plusOne }, '-created_date', 5);
      accessCode = altCandidates?.[0] || null;
    }

    if (!accessCode && normalizedFrom) {
      const local10 = normalizedFrom.length === 11 && normalizedFrom.startsWith('1') ? normalizedFrom.slice(1) : normalizedFrom;
      const hyphenCandidates = await base44.asServiceRole.entities.AccessCode.filter({ sms_phone: local10 }, '-created_date', 5);
      accessCode = hyphenCandidates?.[0] || null;
    }

    if (!accessCode && normalizedFrom) {
      const normalizedCandidates = await base44.asServiceRole.entities.AccessCode.filter({}, '-created_date', 500);
      accessCode = (normalizedCandidates || []).find((candidate: any) =>
        normalizePhoneForMatch(String(candidate?.sms_phone || '')) === normalizedFrom
      ) || null;
    }

    console.log('signalwireSmsInboundWebhook access code lookup', {
      from,
      normalizedFrom,
      accessCodeFound: Boolean(accessCode),
      accessCodeId: accessCode?.id || null,
      accessCodeType: accessCode?.code_type || null,
      accessCodeSmsPhone: accessCode?.sms_phone || null,
    });

    let action = 'ignored';
    let status: 'queued' | 'sent' | 'failed' | 'skipped' = 'skipped';
    let responseMessage: string | null = null;

    if (!accessCode) {
      action = 'unknown_sender';
    } else if (STOP_KEYWORDS.has(keyword)) {
      await base44.asServiceRole.entities.AccessCode.update(accessCode.id, {
        sms_enabled: false,
        sms_opted_out_at: new Date().toISOString(),
      });

      action = 'opt_out';
      responseMessage = MESSAGES.stop;
    } else if (HELP_KEYWORDS.has(keyword)) {
      action = 'help';
      responseMessage = MESSAGES.help;
    } else if (START_KEYWORDS.has(keyword)) {
      action = 'resubscribe_blocked';
      responseMessage = MESSAGES.resubscribeBlocked;
    } else {
      action = 'unsupported_keyword';
    }
    console.log('signalwireSmsInboundWebhook action resolved', {
      action,
      keyword,
      hasResponseMessage: Boolean(responseMessage),
      willSetStatus: responseMessage ? 'sent' : 'skipped',
    });

    if (responseMessage) {
      status = 'sent';
    }

    const logCreated = await createInboundLog(base44, {
      record_type: 'sms_inbound_log',
      status,
      recipient_access_code_id: accessCode?.id || null,
      recipient_type: accessCode?.code_type || null,
      recipient_name: accessCode?.label || accessCode?.code || null,
      phone: from || null,
      message: body || null,
      inbound_keyword: keyword || null,
      skip_reason: action,
      provider: 'signalwire',
      provider_message_id: providerMessageId,
      provider_status_payload: JSON.stringify({
        inbound: payload,
        action,
        to,
        responseMessage,
        responseDelivery: responseMessage ? 'cxml_inline' : 'none',
      }),
      sent_at: responseMessage ? new Date().toISOString() : null,
      error_message: null,
    });
    console.log('signalwireSmsInboundWebhook inbound log result', {
      created: logCreated,
      action,
      status,
      recipientAccessCodeId: accessCode?.id || null,
    });

    if (!responseMessage) {
      return xmlResponse();
    }

    return xmlResponse(responseMessage);
  } catch (error) {
    console.error('signalwireSmsInboundWebhook error', error);

    return xmlResponse();
  }
});
