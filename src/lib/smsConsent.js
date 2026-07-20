export const SMS_CONSENT_METHOD_APP_SETTINGS = 'app_settings';

export function buildSmsConsentFields(existingConsent = null) {
  return {
    sms_consent_given: true,
    sms_consent_at: existingConsent?.sms_consent_at || new Date().toISOString(),
    sms_consent_method: SMS_CONSENT_METHOD_APP_SETTINGS,
  };
}
