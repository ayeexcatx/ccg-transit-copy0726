import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BellRing, Building2 } from 'lucide-react';
import { formatPhoneNumber } from '@/lib/sms';
import SmsConsentDisclosure from '@/components/profile/SmsConsentDisclosure';

export function CompanyOwnerProfileOverview({
  company,
  ownerDisplayName,
  contactSummary,
  hasPendingRequest,
  onOpenEdit,
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center"><Building2 className="h-5 w-5 text-slate-600" /></div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Company Profile</h2>
              <p className="text-sm text-slate-500">Profile information is view-only here. Use Edit to submit changes for admin approval.</p>
            </div>
          </div>
          <Button onClick={onOpenEdit} className="bg-slate-900 hover:bg-slate-800">Edit</Button>
        </div>

        {hasPendingRequest && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Pending approval: your requested company profile update is awaiting admin review.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4 sm:col-span-2">
              <p className="text-xs uppercase text-slate-500">Company name</p>
              <p className="mt-1 font-medium text-slate-900">{company.name || '—'}</p>
            </div>
            <div className="rounded-lg border p-4 sm:col-span-2">
              <p className="text-xs uppercase text-slate-500">Owner name</p>
              <p className="mt-1 font-medium text-slate-900">{ownerDisplayName || '—'}</p>
            </div>
            <div className="rounded-lg border p-4 sm:col-span-2">
              <p className="text-xs uppercase text-slate-500">Address</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-900">{company.address || '—'}</p>
            </div>
            <div className="rounded-lg border p-4 sm:col-span-2">
              <p className="text-xs uppercase text-slate-500">Contact info</p>
              <div className="mt-2 space-y-1.5 text-sm text-slate-700">
                {contactSummary.length > 0
                  ? contactSummary.map((method, index) => (
                    <p key={`owner-contact-${index}`}>
                      <span className="font-medium text-slate-900">{method.name ? `${method.name} | ` : ''}{method.type}:</span> {method.value}
                    </p>
                  ))
                  : <p>—</p>}
              </div>
            </div>
            <div className="rounded-lg border p-4 sm:col-span-2">
              <p className="text-xs uppercase text-slate-500">Truck numbers</p>
              <div className="mt-2 flex flex-wrap gap-2">{(company.trucks || []).length ? company.trucks.map((truck) => <Badge key={truck} variant="outline" className="font-mono">{truck}</Badge>) : <span className="text-sm text-slate-500">No trucks listed.</span>}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CompanyOwnerSmsCard({
  smsState,
  smsPending,
  ownerProfile,
  onUpdateOwnerProfile,
  onToggle,
}) {
  const [draftName, setDraftName] = useState(ownerProfile?.label || ownerProfile?.name || '');
  const [draftPhone, setDraftPhone] = useState(formatPhoneNumber(ownerProfile?.sms_phone || ''));
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const ownerName = ownerProfile?.label || ownerProfile?.name || '';
  useEffect(() => {
    setDraftName(ownerName);
    setDraftPhone(formatPhoneNumber(ownerProfile?.sms_phone || ''));
    setProfileSaved(false);
  }, [ownerName, ownerProfile?.sms_phone]);

  const saveProfile = async () => {
    if (!onUpdateOwnerProfile) return;
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      await onUpdateOwnerProfile({ label: draftName, sms_phone: draftPhone });
      setProfileSaved(true);
    } finally {
      setSavingProfile(false);
    }
  };
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-slate-500" /><h3 className="text-lg font-semibold text-slate-900">Your SMS notifications</h3></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-slate-500">Name</Label>
            <Input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Your display name"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Phone for SMS</Label>
            <Input
              value={draftPhone}
              onChange={(event) => setDraftPhone(formatPhoneNumber(event.target.value))}
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
        {profileSaved && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Personal profile saved.
          </div>
        )}
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" disabled={savingProfile} onClick={saveProfile}>
            {savingProfile ? 'Saving…' : 'Save Personal Profile'}
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4 gap-4">
          <div>
            <Label className="text-base">Receive SMS notifications</Label>
            <p className="text-sm text-slate-500">SMS delivery for owners uses your personal profile phone number and opt-in.</p>
          </div>
          <Switch checked={smsState.optedIn} disabled={smsPending || !smsState.target.phone} onCheckedChange={onToggle} />
        </div>
        <SmsConsentDisclosure />
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3 border"><p className="text-slate-500">Personal profile</p><p className="font-medium text-slate-900">{ownerName || 'No name set'}</p></div>
          <div className="rounded-lg bg-slate-50 p-3 border"><p className="text-slate-500">Number used for SMS</p><p className="font-medium text-slate-900">{smsState.target.phone ? formatPhoneNumber(smsState.target.phone) : 'No phone selected'}</p></div>
          <div className="rounded-lg bg-slate-50 p-3 border"><p className="text-slate-500">SMS active</p><p className={`font-medium ${smsState.effective ? 'text-emerald-700' : 'text-slate-900'}`}>{smsState.effective ? 'Yes' : 'No'}</p></div>
        </div>
        {!smsState.target.phone && <p className="text-sm text-red-600">Enter a valid personal phone number before opting in.</p>}
      </CardContent>
    </Card>
  );
}
