import { base44 } from '@/api/base44Client';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

function buildApprovedCompanyPayload(pendingProfileChange) {
  const payload = { pending_profile_change: null };

  if (hasOwn(pendingProfileChange, 'requested_name')) payload.name = pendingProfileChange.requested_name;
  if (hasOwn(pendingProfileChange, 'requested_address')) payload.address = pendingProfileChange.requested_address;
  if (hasOwn(pendingProfileChange, 'requested_additional_contact_name')) payload.additional_contact_name = pendingProfileChange.requested_additional_contact_name;
  if (hasOwn(pendingProfileChange, 'requested_contact_methods')) payload.contact_methods = pendingProfileChange.requested_contact_methods;
  if (hasOwn(pendingProfileChange, 'requested_contact_info')) payload.contact_info = pendingProfileChange.requested_contact_info;

  return payload;
}

async function getCompanyById(companyId) {
  const companies = await base44.entities.Company.filter({ id: companyId }, '-created_date', 1);
  return companies[0] || null;
}

export async function reviewCompanyProfileChangeRequest({ companyId, action }) {
  if (!companyId) throw new Error('Company record not found.');

  const company = await getCompanyById(companyId);
  if (!company) throw new Error('Company record not found.');

  const pendingProfileChange = company.pending_profile_change;
  if (!pendingProfileChange || pendingProfileChange.status !== 'Pending') {
    throw new Error('No pending profile change request was found.');
  }

  if (action === 'approve') {
    const payload = buildApprovedCompanyPayload(pendingProfileChange);
    return base44.entities.Company.update(company.id, payload);
  }

  if (action === 'reject') {
    return base44.entities.Company.update(company.id, {
      pending_profile_change: null,
    });
  }

  throw new Error('Invalid profile review action.');
}
