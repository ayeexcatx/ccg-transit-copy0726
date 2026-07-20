import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useSession } from '@/components/session/SessionContext';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BellRing, Shield, UserRound } from 'lucide-react';
import { buildCompanyProfileRequestPayload, formatPhoneNumber, getAdminSmsProductState, getCompanyOwnerSmsState, getDriverSmsState, hasUsSmsPhone, normalizeContactMethods, normalizeSmsPhone, PHONE_CONTACT_TYPES } from '@/lib/sms';
import { buildSmsConsentFields } from '@/lib/smsConsent';
import { sendSmsWelcomeIfNeeded } from '@/lib/smsIntro';
import DriverProfileSmsCard from '@/components/profile/DriverProfileSmsCard';
import { CompanyOwnerProfileOverview, CompanyOwnerSmsCard } from '@/components/profile/CompanyOwnerProfileSections';
import SmsConsentDisclosure from '@/components/profile/SmsConsentDisclosure';
import { getEffectiveView } from '@/components/session/workspaceUtils';
import { getSmsRules } from '@/lib/smsConfig';
import { resolveAdminDisplayName, resolveProfileName } from '@/lib/adminIdentity';
import { resolveCompanyOwnerCompanyId } from '@/services/currentAppIdentityService';

const CONTACT_TYPE_OPTIONS = ['Office', 'Cell', 'Email', 'Fax', 'Other'];

async function sendProfileSmsConfirmation(phone, message) {
  if (!phone) return;
  const smsRules = await getSmsRules();
  if (!smsRules.opt_out_confirmation_sms) return;
  try {
    await base44.functions.invoke('sendNotificationSms', { phone, message });
  } catch (error) {
    console.error('Failed sending profile SMS confirmation', error);
  }
}

async function syncDriverAccessCode(driver, nextOptIn = null, existingAccessCode = null) {
  if (!driver?.access_code_id) return;
  const state = getDriverSmsState(driver);
  const payload = {
    sms_enabled: state.effective,
    sms_phone: state.normalizedPhone || '',
  };

  if (nextOptIn === true) {
    Object.assign(payload, buildSmsConsentFields(existingAccessCode));
  }

  await base44.entities.AccessCode.update(driver.access_code_id, payload);
}

function ContactMethodEditor({ methods, setMethods, readOnly = false }) {
  const updateMethod = (index, key, nextValue) => {
    setMethods((prev) => prev.map((method, i) => {
      if (i !== index) return method;
      if (key === 'type') {
        const nextMethod = { ...method, type: nextValue };
        if (PHONE_CONTACT_TYPES.includes(nextValue)) {
          nextMethod.value = formatPhoneNumber(nextMethod.value);
        }
        return nextMethod;
      }
      if (key === 'value' && PHONE_CONTACT_TYPES.includes(method.type)) {
        return { ...method, value: formatPhoneNumber(nextValue) };
      }
      return { ...method, [key]: nextValue };
    }));
  };

  return (
    <div className="space-y-2">
      {methods.map((method, index) => {
        const isPhoneType = PHONE_CONTACT_TYPES.includes(method.type);
        return (
          <div key={`contact-method-${index}`} className="rounded-lg border border-slate-200 p-3 bg-white space-y-2">
    <div className="flex items-center justify-between gap-3">
      <Input
        className="w-44 shrink-0"
        value={method.name || ''}
        readOnly={readOnly}
        placeholder="Contact name"
        onChange={(e) => updateMethod(index, 'name', e.target.value)}
      />
              <Select value={method.type} disabled={readOnly} onValueChange={(value) => updateMethod(index, 'type', value)}>
                <SelectTrigger className="w-32 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>{CONTACT_TYPE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={method.value} readOnly={readOnly} placeholder={isPhoneType ? '(555) 123-4567' : 'Enter value'} onChange={(e) => updateMethod(index, 'value', e.target.value)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdminProfile({ session }) {
  const { user, checkAppState } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', sms_phone: '', sms_enabled: false });

  const { data: accessCodes = [] } = useQuery({
    queryKey: ['admin-profile', session?.shared_admin_access_code_id],
    queryFn: () => base44.entities.AccessCode.filter({ id: session.shared_admin_access_code_id }, '-created_date', 1),
    enabled: !!session?.shared_admin_access_code_id,
  });

  const adminAccessCode = accessCodes[0] || null;
  const profileName = resolveProfileName(user);
  const adminName = session?.admin_display_name || resolveAdminDisplayName(user);
  const adminPhone = adminAccessCode?.sms_phone || '';
  const adminSmsState = getAdminSmsProductState(adminAccessCode);
  const adminSmsOptedIn = adminSmsState.optedIn;
  const adminConsentRecorded = adminAccessCode?.sms_consent_given === true
    || Boolean(adminAccessCode?.sms_consent_at)
    || Boolean(adminAccessCode?.sms_consent_method);
  const hasSmsChanges = normalizeSmsPhone(form.sms_phone) !== normalizeSmsPhone(adminPhone)
    || form.sms_enabled !== adminSmsOptedIn;
  const hasNameChanges = form.name.trim() !== profileName;
  const hasProfileChanges = hasNameChanges || hasSmsChanges;

  useEffect(() => {
    setForm({
      name: profileName,
      sms_phone: formatPhoneNumber(adminPhone),
      sms_enabled: adminSmsOptedIn,
    });
  }, [adminAccessCode, adminPhone, adminSmsOptedIn, adminConsentRecorded, profileName]);

  const closeEditModal = (nextOpen) => {
    if (nextOpen) {
      setEditOpen(true);
      return;
    }

    if (hasProfileChanges && !window.confirm('Discard your unsaved admin profile changes?')) {
      return;
    }

    setEditOpen(false);
    setForm({
      name: profileName,
      sms_phone: formatPhoneNumber(adminPhone),
      sms_enabled: adminSmsOptedIn,
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedName = form.name.trim();
      const nameChanged = trimmedName !== profileName;
      const normalizedSmsPhone = normalizeSmsPhone(form.sms_phone);
      if (form.sms_enabled && !hasUsSmsPhone(normalizedSmsPhone)) {
        throw new Error('Enter a valid US 10-digit SMS phone number (example: (555) 123-4567).');
      }
      if (!nameChanged && !hasSmsChanges) {
        return null;
      }

      if (nameChanged) {
        if (!user?.id) {
          throw new Error('Unable to update admin name because authenticated user details are unavailable.');
        }
        const namePayload = { app_display_name: trimmedName || null };
        await base44.entities.User.update(user.id, namePayload);
      }

      if (hasSmsChanges) {
        if (!adminAccessCode?.id) {
          throw new Error('Admin SMS settings are unavailable because no active shared admin config was found.');
        }
        const payload = {
          sms_phone: normalizedSmsPhone,
          sms_enabled: form.sms_enabled,
        };
        if (form.sms_enabled) {
          Object.assign(payload, buildSmsConsentFields(adminAccessCode));
        }
        await base44.entities.AccessCode.update(adminAccessCode.id, payload);
      }

      return true;
    },
    onSuccess: async () => {
      await checkAppState();
      queryClient.invalidateQueries({ queryKey: ['admin-profile', session?.shared_admin_access_code_id] });
      queryClient.invalidateQueries({ queryKey: ['access-codes'] });
      setEditOpen(false);
      toast.success('Admin profile updated');
    },
    onError: (error) => {
      toast.error(error?.message || 'Unable to update admin profile');
    },
  });

  return (
    <>
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center"><Shield className="h-5 w-5 text-slate-600" /></div>
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Admin Profile</h2>
                <p className="text-sm text-slate-500">Your admin identity is tied to your authenticated user account.</p>
              </div>
            </div>
            <Button onClick={() => closeEditModal(true)} className="bg-slate-900 hover:bg-slate-800">Edit Profile</Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase text-slate-500">Admin name</p>
              <p className="mt-1 font-medium text-slate-900">{adminName}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase text-slate-500">Phone number</p>
              <p className="mt-1 text-sm text-slate-700">{adminPhone ? formatPhoneNumber(adminPhone) : 'No shared admin phone on this config.'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-slate-500" /><h3 className="text-lg font-semibold text-slate-900">Shared Admin Dispatch SMS</h3></div>
          <p className="text-sm text-slate-600">
            This phone is the shared admin dispatch SMS number. Enter the phone for the admin currently covering operations, and update it anytime coverage shifts.
          </p>
          <div className="space-y-2">
            <Label htmlFor="admin-sms-phone">Phone number for SMS</Label>
            <Input
              id="admin-sms-phone"
              value={form.sms_phone}
              placeholder="(555) 123-4567"
              onChange={(e) => setForm((prev) => ({ ...prev, sms_phone: formatPhoneNumber(e.target.value) }))}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4 gap-4">
            <div>
              <Label className="text-base">Receive SMS Notifications</Label>
              <p className="text-sm text-slate-500">This opt-in is saved on the shared admin config so dispatch coverage can be handed off by updating one shared number.</p>
            </div>
            <Switch
              checked={form.sms_enabled}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, sms_enabled: checked }))}
            />
          </div>
          <SmsConsentDisclosure />
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3 border"><p className="text-slate-500">Phone for future SMS</p><p className="font-medium text-slate-900">{form.sms_phone ? formatPhoneNumber(form.sms_phone) : 'No phone selected'}</p></div>
            <div className="rounded-lg bg-slate-50 p-3 border"><p className="text-slate-500">SMS opt-in saved</p><p className={`font-medium ${form.sms_enabled ? 'text-emerald-700' : 'text-slate-900'}`}>{form.sms_enabled ? 'Yes' : 'No'}</p></div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !hasProfileChanges} className="bg-red-600 text-white hover:bg-red-700">
              {mutation.isPending ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
          {!adminAccessCode && (
            <p className="text-sm text-amber-700">No active Admin access-code config was found. Name remains per-user, but shared admin SMS settings cannot be saved until an active Admin code exists.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={closeEditModal}>
        <DialogContent
          className="sm:max-w-lg"
          onInteractOutside={(event) => {
            if (hasProfileChanges) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (hasProfileChanges) event.preventDefault();
          }}
        >
          <DialogHeader className="pr-8">
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Admin name comes from your authenticated account. Shared dispatch SMS settings save to the shared admin config record.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="admin-name">Name</Label>
              <Input id="admin-name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-phone">Phone number</Label>
              <Input id="admin-phone" value={form.sms_phone} readOnly aria-readonly="true" placeholder="Managed in shared SMS settings on this page" />
              <p className="text-xs text-slate-500">Read-only in this modal. Edit shared admin SMS phone in the “Your SMS Notifications” section on the Profile page.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => closeEditModal(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !hasProfileChanges} className="bg-red-600 text-white hover:bg-red-700">
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DriverProfile({ session }) {
  const queryClient = useQueryClient();
  const { data: drivers = [] } = useQuery({
    queryKey: ['driver-profile', session?.driver_id],
    queryFn: () => base44.entities.Driver.filter({ id: session.driver_id }, '-created_date', 1),
    enabled: !!session?.driver_id,
  });
  const driver = drivers[0] || null;
  const { data: driverAccessCodes = [] } = useQuery({
    queryKey: ['driver-profile-access-code', driver?.access_code_id],
    queryFn: () => base44.entities.AccessCode.filter({ id: driver.access_code_id }, '-created_date', 1),
    enabled: !!driver?.access_code_id,
  });
  const driverAccessCode = driverAccessCodes[0] || null;
  const driverConsentRecorded = driverAccessCode?.sms_consent_given === true
    || Boolean(driverAccessCode?.sms_consent_at)
    || Boolean(driverAccessCode?.sms_consent_method);
  const smsState = getDriverSmsState(driver);
  const [optedIn, setOptedIn] = useState(false);

  useEffect(() => {
    setOptedIn(smsState.driverOptedIn);
  }, [smsState.driverOptedIn]);

  const mutation = useMutation({
    mutationFn: async (nextOptIn) => {
      const updated = await base44.entities.Driver.update(driver.id, { driver_sms_opt_in: nextOptIn });
      await syncDriverAccessCode(updated, nextOptIn, driverAccessCode);

      if (nextOptIn) {
        await sendSmsWelcomeIfNeeded({
          accessCodeId: updated.access_code_id,
          consentGiven: driverConsentRecorded || nextOptIn,
        });
      } else {
        await sendProfileSmsConfirmation(
          normalizeSmsPhone(updated.phone),
          'CCG Transit: You are now opted out of SMS notifications.'
        );
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-profile', session?.driver_id] });
      queryClient.invalidateQueries({ queryKey: ['drivers', session?.company_id] });
      queryClient.invalidateQueries({ queryKey: ['drivers-all'] });
      queryClient.invalidateQueries({ queryKey: ['access-codes'] });
      toast.success('SMS preference updated');
    },
    onError: (error) => {
      toast.error(error?.message || 'Unable to update SMS preference');
    },
  });

  if (!driver) return <div className="text-sm text-slate-500">Driver profile not found.</div>;

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center"><UserRound className="h-5 w-5 text-slate-600" /></div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Profile</h2>
            <p className="text-sm text-slate-500">Your name and phone are view-only. You can manage only your own SMS consent here.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4"><p className="text-xs uppercase text-slate-500">Driver name</p><p className="mt-1 font-medium text-slate-900">{driver.driver_name}</p></div>
          <div className="rounded-lg border p-4"><p className="text-xs uppercase text-slate-500">Phone number</p><p className="mt-1 font-medium text-slate-900">{driver.phone || '—'}</p></div>
        </div>
        <DriverProfileSmsCard
          smsState={smsState}
          optedIn={optedIn}
          isPending={mutation.isPending}
          onToggle={(checked) => {
            setOptedIn(checked);
            mutation.mutate(checked);
          }}
        />
      </CardContent>
    </Card>
  );
}

function CompanyOwnerProfile({ session }) {
  const { currentAppIdentity } = useAuth();
  const ownerWorkspaceCompanyId = resolveCompanyOwnerCompanyId({ currentAppIdentity, session });
  const profileCompanyId = ownerWorkspaceCompanyId ?? null;
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    contact_methods: [{ name: '', type: 'Office', value: '' }]
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['owner-profile-company', profileCompanyId],
    queryFn: () => base44.entities.Company.filter({ id: profileCompanyId }, '-created_date', 1),
    enabled: !!profileCompanyId,
  });

  const { data: accessCodes = [] } = useQuery({
    queryKey: ['owner-profile-access-codes', profileCompanyId],
    queryFn: () => base44.entities.AccessCode.filter({ company_id: profileCompanyId, code_type: 'CompanyOwner' }, '-created_date', 200),
    enabled: !!profileCompanyId,
  });

  const company = companies[0] || null;
  const activeAccessCode = useMemo(() => {
    if (!Array.isArray(accessCodes) || accessCodes.length === 0) {
      return session || null;
    }

    const identityUserId = currentAppIdentity?.user_id ? String(currentAppIdentity.user_id) : '';
    const sessionUserId = session?.user_id ? String(session.user_id) : '';
    const linkedUserId = identityUserId || sessionUserId;
    const linkedCodeByUser = linkedUserId
      ? accessCodes.find((code) => {
        const usedByUserId = String(code?.used_by_user_id || '');
        const legacyUserId = String(code?.user_id || '');
        return usedByUserId === linkedUserId || legacyUserId === linkedUserId;
      })
      : null;
    if (linkedCodeByUser) return linkedCodeByUser;

    const sessionId = session?.id ? String(session.id) : '';
    const fallbackBySessionId = sessionId
      ? accessCodes.find((code) => String(code?.id || '') === sessionId)
      : null;
    if (fallbackBySessionId) return fallbackBySessionId;

    return session || null;
  }, [accessCodes, currentAppIdentity?.user_id, session]);
  const smsState = getCompanyOwnerSmsState({ accessCode: activeAccessCode, company });
  const ownerConsentRecorded = activeAccessCode?.sms_consent_given === true
    || Boolean(activeAccessCode?.sms_consent_at)
    || Boolean(activeAccessCode?.sms_consent_method);
  const hasPendingRequest = company?.pending_profile_change?.status === 'Pending';

  useEffect(() => {
    if (!company) return;
    setForm({
      name: company.name || '',
      address: company.address || '',
      additional_contact_name: company.additional_contact_name || '',
      contact_methods: normalizeContactMethods(company),
    });
  }, [company]);

  const profileRequestMutation = useMutation({
    mutationFn: async () => {
      const requestPayload = buildCompanyProfileRequestPayload({ form, currentCompany: company });
      const updatedCompany = await base44.entities.Company.update(company.id, {
        pending_profile_change: {
          ...requestPayload,
          requested_by_access_code_id: session.id,
        },
      });
      return updatedCompany;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-profile-company', profileCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['companies-workspace'] });
      queryClient.invalidateQueries({ queryKey: ['access-codes'] });
      setEditOpen(false);
      toast.success('Profile update request sent for admin approval');
    },
  });

  const smsMutation = useMutation({
    mutationFn: async (nextOptIn) => {
      const isRealRecord = activeAccessCode?.id && accessCodes.some((c) => c.id === activeAccessCode.id);
      if (!isRealRecord) {
        throw new Error('Owner SMS settings are unavailable because no linked CompanyOwner access code was found for your account.');
      }
      const ownerPhone = normalizeSmsPhone(activeAccessCode?.sms_phone || '');
      if (nextOptIn && !hasUsSmsPhone(ownerPhone)) {
        throw new Error('Enter a valid personal phone number below before enabling SMS.');
      }
      const payload = {
        sms_enabled: nextOptIn,
        sms_phone: ownerPhone || '',
      };
      if (nextOptIn) {
        Object.assign(payload, buildSmsConsentFields(activeAccessCode));
      }
      const updatedAccessCode = await base44.entities.AccessCode.update(activeAccessCode.id, payload);

      if (nextOptIn) {
        await sendSmsWelcomeIfNeeded({
          accessCodeId: updatedAccessCode.id,
          consentGiven: ownerConsentRecorded || nextOptIn,
        });
      } else {
        await sendProfileSmsConfirmation(
          normalizeSmsPhone(activeAccessCode?.sms_phone || ''),
          'CCG Transit: You are now opted out of SMS notifications.'
        );
      }

      return updatedAccessCode;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-profile-access-codes', profileCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['access-codes'] });
      toast.success('Owner SMS preference updated');
    },
    onError: (error) => {
      toast.error(error?.message || 'Unable to update owner SMS preference');
    },
  });

  const contactSummary = useMemo(() => {
    const methods = normalizeContactMethods(company).filter((method) => method?.value);
    return methods.length > 0 ? methods : [];
  }, [company]);
  const ownerDisplayName = useMemo(
    () => (
      (typeof activeAccessCode?.label === 'string' && activeAccessCode.label.trim())
      || (typeof activeAccessCode?.name === 'string' && activeAccessCode.name.trim())
      || (typeof session?.label === 'string' && session.label.trim())
      || (typeof session?.name === 'string' && session.name.trim())
      || ''
    ),
    [activeAccessCode, session],
  );

  if (!company) return <div className="text-sm text-slate-500">Company profile not found.</div>;

  return (
    <div className="space-y-6">
      <CompanyOwnerProfileOverview
        company={company}
        ownerDisplayName={ownerDisplayName}
        contactSummary={contactSummary}
        hasPendingRequest={hasPendingRequest}
        onOpenEdit={() => setEditOpen(true)}
      />

      <CompanyOwnerSmsCard
        smsState={smsState}
        smsPending={smsMutation.isPending}
        ownerProfile={activeAccessCode}
        onUpdateOwnerProfile={async (updates) => {
          const isRealRecord = activeAccessCode?.id && accessCodes.some((c) => c.id === activeAccessCode.id);
          if (!isRealRecord) {
            toast.error('Unable to save: no linked access code record found for your account.');
            return;
          }
          await base44.entities.AccessCode.update(activeAccessCode.id, updates);
          queryClient.invalidateQueries({ queryKey: ['owner-profile-access-codes', profileCompanyId] });
          queryClient.invalidateQueries({ queryKey: ['access-codes'] });
          toast.success('Personal owner profile updated');
        }}
        onToggle={(checked) => smsMutation.mutate(checked)}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pr-8">
            <DialogTitle>Edit Company Profile</DialogTitle>
            <DialogDescription>Submit profile changes for admin approval. Live company data will not change until the request is reviewed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Company name</Label><Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} /></div>
            <div><Label>Address</Label><Textarea rows={3} value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} /></div>
            <div>
              <Label>Contact info</Label>
              <p className="text-xs text-slate-500 mb-2">Shared business contacts for company profile purposes.</p>
              <ContactMethodEditor methods={form.contact_methods} setMethods={(updater) => setForm((prev) => ({ ...prev, contact_methods: typeof updater === 'function' ? updater(prev.contact_methods) : updater }))} />
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setForm((prev) => ({ ...prev, contact_methods: [...prev.contact_methods, { name: '', type: 'Office', value: '' }] }))}>Add Contact</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => profileRequestMutation.mutate()} disabled={profileRequestMutation.isPending} className="bg-red-600 text-white hover:bg-red-700">
              {profileRequestMutation.isPending ? 'Submitting...' : 'Submit Changes for Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default function Profile() {
  const { session } = useSession();
  const effectiveView = getEffectiveView(session);
  const isAdmin = effectiveView === 'Admin';
  const isOwner = effectiveView === 'CompanyOwner';
  const isDriver = effectiveView === 'Driver';

  if (!(isAdmin || isOwner || isDriver)) {
    return <div className="text-sm text-slate-500">Profile is not available for this login type.</div>;
  }

  return (
    <div className="space-y-6">
      {isAdmin && <AdminProfile session={session} />}
      {isOwner && <CompanyOwnerProfile session={session} />}
      {isDriver && <DriverProfile session={session} />}
    </div>
  );
}
