import { getAdminSmsProductState, getCompanyOwnerEffectiveSmsState, getDriverEffectiveSmsState } from '@/lib/smsDerivedState';
import { hasUsSmsPhone, normalizeUsSmsPhone } from '@/lib/smsPhone';

export const PHONE_CONTACT_TYPES = ['Office', 'Cell', 'Fax'];

export function formatPhoneNumber(value) {
  const rawDigits = String(value || '').replace(/\D/g, '');
  const digits = rawDigits.length === 11 && rawDigits.startsWith('1')
    ? rawDigits.slice(1)
    : rawDigits.slice(0, 10);

  if (!digits) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function normalizeSmsPhone(value) {
  return normalizeUsSmsPhone(value);
}

export function normalizeContactMethods(company) {
  const fallbackContactName = company?.additional_contact_name || '';
  if (Array.isArray(company?.contact_methods) && company.contact_methods.length > 0) {
    return company.contact_methods.map((method) => ({
      name: method?.name || fallbackContactName || '',
      type: method?.type || 'Other',
      value: method?.value || '',
    }));
  }

  if (company?.contact_info) return [{ name: fallbackContactName, type: 'Other', value: company.contact_info }];
  return [{ name: '', type: 'Office', value: '' }];
}

export function getCompanySmsContact(company) {
  const methods = normalizeContactMethods(company);
  const selectedIndex = Number.isInteger(company?.sms_contact_method_index)
    ? company.sms_contact_method_index
    : -1;

  const selectedMethod = methods[selectedIndex] || null;
  if (selectedMethod && PHONE_CONTACT_TYPES.includes(selectedMethod.type) && hasUsSmsPhone(normalizeSmsPhone(selectedMethod.value))) {
    return {
      index: selectedIndex,
      method: selectedMethod,
      phone: normalizeSmsPhone(selectedMethod.value),
    };
  }

  const fallbackIndex = methods.findIndex((method) =>
    PHONE_CONTACT_TYPES.includes(method?.type) && hasUsSmsPhone(normalizeSmsPhone(method?.value))
  );

  if (fallbackIndex >= 0) {
    return {
      index: fallbackIndex,
      method: methods[fallbackIndex],
      phone: normalizeSmsPhone(methods[fallbackIndex].value),
    };
  }

  return {
    index: selectedIndex >= 0 ? selectedIndex : null,
    method: methods[selectedIndex] || null,
    phone: '',
  };
}

export function getDriverSmsState(driver) {
  const normalizedPhone = normalizeSmsPhone(driver?.phone || '');
  const state = getDriverEffectiveSmsState({ driver, normalizedPhone });

  return {
    ...state,
    normalizedPhone,
  };
}

export function getCompanyOwnerSmsState({ accessCode, company }) {
  void company;
  const normalizedPhone = normalizeSmsPhone(accessCode?.sms_phone || '');
  const target = {
    method: null,
    phone: normalizedPhone,
  };
  const state = getCompanyOwnerEffectiveSmsState({ accessCode, normalizedPhone });

  return {
    ...state,
    normalizedPhone,
    target,
  };
}

export { getAdminSmsProductState, hasUsSmsPhone };

export function buildCompanyProfileRequestPayload({ form, currentCompany }) {
  const cleanedContactMethods = (form.contact_methods || [])
    .map((method) => ({
      name: (method?.name || '').trim(),
      type: method?.type || 'Other',
      value: (method?.value || '').trim(),
    }))
    .filter((method) => method.value);
  const firstNamedContact =
    cleanedContactMethods.find((method) => String(method.name || '').trim())?.name?.trim() || '';

  return {
    requested_name: form.name.trim(),
    requested_address: form.address.trim(),
    requested_additional_contact_name: (form.additional_contact_name || '').trim(),
    requested_contact_methods: cleanedContactMethods,
    requested_contact_info: cleanedContactMethods.map((method) => `${method.name ? `${method.name} | ` : ''}${method.type}: ${method.value}`).join(' • '),
    current_name: currentCompany?.name || '',
    current_address: currentCompany?.address || '',
    current_additional_contact_name: currentCompany?.additional_contact_name || '',
    current_contact_methods: normalizeContactMethods(currentCompany),
    current_contact_info: currentCompany?.contact_info || '',
    current_additional_contact_name: currentCompany?.additional_contact_name || '',
    requested_additional_contact_name:
      firstNamedContact || currentCompany?.additional_contact_name || '',
    status: 'Pending',
    requested_at: new Date().toISOString(),
  };
}
