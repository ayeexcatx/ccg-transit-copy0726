import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/components/session/SessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Menu, Plus, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatPhoneNumber, getDriverSmsState } from '@/lib/sms';
import DriverCard from '@/components/drivers/DriverCard';
import DriverGuidanceTabs from '@/components/drivers/DriverGuidanceTabs';
import { getActiveCompanyId, getEffectiveView } from '@/components/session/workspaceUtils';

const defaultForm = {
  driver_name: '',
  phone: '',
  owner_sms_enabled: false,
  notes: '',
  status: 'Active'
};

function generateCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < len; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

async function syncDriverAccessCode(driver) {
  if (!driver?.access_code_id) return;
  const smsState = getDriverSmsState(driver);
  await base44.entities.AccessCode.update(driver.access_code_id, {
    sms_enabled: smsState.effective,
    sms_phone: smsState.normalizedPhone || ''
  });
}

export default function Drivers() {
  const { session } = useSession();
  const effectiveView = getEffectiveView(session);
  const activeCompanyId = getActiveCompanyId(session);
  const isOwner = effectiveView === 'CompanyOwner';
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [driverToDelete, setDriverToDelete] = useState(null);
  const [helpLanguage, setHelpLanguage] = useState('en');
  const appShareMessage =
  'Hi there,\n\nI am sharing with you the link to install the new CCG Transit app. Please click on the link below and follow the instructions to install it on your device.\n\nI will be sharing an access code with you, which you will need the first time you log in.\n\nhttps://app.ccgnj.com';

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['drivers', activeCompanyId],
    queryFn: () => base44.entities.Driver.filter({ company_id: activeCompanyId }, '-created_date', 200),
    enabled: !!activeCompanyId
  });

  const { data: accessCodes = [] } = useQuery({
    queryKey: ['driver-access-codes', activeCompanyId],
    queryFn: () => base44.entities.AccessCode.filter({ company_id: activeCompanyId, code_type: 'Driver' }, '-created_date', 500),
    enabled: !!activeCompanyId
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list()
  });

  const sortedDrivers = useMemo(
    () => [...drivers].sort((a, b) => (a.driver_name || '').localeCompare(b.driver_name || '')),
    [drivers]
  );

  const accessCodeById = useMemo(() => {
    return accessCodes.reduce((lookup, code) => {
      if (code?.id) lookup[code.id] = code;
      return lookup;
    }, {});
  }, [accessCodes]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['drivers', activeCompanyId] });
    queryClient.invalidateQueries({ queryKey: ['driver-access-codes', activeCompanyId] });
    queryClient.invalidateQueries({ queryKey: ['drivers-all'] });
    queryClient.invalidateQueries({ queryKey: ['access-codes'] });
  };

  const refreshDriverPageData = async () => {
    await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['drivers', activeCompanyId] }),
    queryClient.invalidateQueries({ queryKey: ['driver-access-codes', activeCompanyId] }),
    queryClient.refetchQueries({ queryKey: ['drivers', activeCompanyId], exact: true }),
    queryClient.refetchQueries({ queryKey: ['driver-access-codes', activeCompanyId], exact: true })]
    );
  };

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const saved = editing ?
      await base44.entities.Driver.update(editing.id, payload) :
      await base44.entities.Driver.create({
        ...payload,
        company_id: activeCompanyId,
        access_code_status: 'Not Requested',
        driver_sms_opt_in: false
      });
      await syncDriverAccessCode(saved);
      return saved;
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setEditing(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Driver.delete(id),
    onSuccess: () => {
      invalidate();
      setDriverToDelete(null);
    }
  });

  const createAccessCodeMutation = useMutation({
    mutationFn: async (driver) => {
      const driverSmsState = getDriverSmsState(driver);
      const company = companies.find((companyRecord) => companyRecord.id === driver.company_id);
      const created = await base44.entities.AccessCode.create({
        code: generateCode(),
        label: driver.driver_name || '',
        active_flag: true,
        code_type: 'Driver',
        company_id: driver.company_id || '',
        company_name: company?.name || '',
        driver_id: driver.id,
        allowed_trucks: [],
        sms_enabled: driverSmsState.effective,
        sms_phone: driverSmsState.normalizedPhone || '',
        available_views: [],
        linked_company_ids: []
      });

      await base44.entities.Driver.update(driver.id, {
        access_code_id: created.id,
        access_code_status: 'Created'
      });
    },
    onSuccess: async () => {
      await refreshDriverPageData();
    }
  });

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setErrors({});
    setOpen(true);
  };

  const openEdit = (driver) => {
    setEditing(driver);
    setForm({
      driver_name: driver.driver_name || '',
      phone: formatPhoneNumber(driver.phone || ''),
      owner_sms_enabled: driver.owner_sms_enabled === true,
      notes: driver.notes || '',
      status: driver.status || 'Active'
    });
    setErrors({});
    setOpen(true);
  };

  const handleSave = () => {
    const nextErrors = {};
    if (!form.driver_name.trim()) nextErrors.driver_name = 'Driver name is required.';
    if (!form.phone.trim()) nextErrors.phone = 'Phone number is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    saveMutation.mutate({
      driver_name: form.driver_name.trim(),
      phone: form.phone.trim(),
      owner_sms_enabled: form.owner_sms_enabled === true,
      notes: form.notes,
      status: form.status,
      active_flag: form.status === 'Active'
    });
  };

  const handleShareAppLink = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          text: appShareMessage
        });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    await navigator.clipboard.writeText(appShareMessage);
    toast.success('Invitation message copied');
  };

  if (!isOwner) {
    return <div className="text-sm text-slate-500">Driver management is only available to company owners.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="space-y-3 sm:space-y-2">
          <h2 className="text-2xl font-semibold text-slate-900">Drivers</h2>
          <p className="text-sm text-slate-500">Manage driver records and SMS permissions.</p>
          <p className="text-slate-600 text-sm text-left max-w-2xl">After you add a driver, you must click on Create Access Code. This will create a unique code to be given to your driver, which they will use after they sign up and log into the app.

          </p>
          <div className="space-y-2 pt-1">
            <p className="text-slate-950 text-sm font-medium">To share the app with your drivers, use the link below:</p>
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleShareAppLink}>
                <Share2 className="h-4 w-4 mr-1" />Share App Link
              </Button>
              <a
                href="https://app.ccgnj.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-sm text-blue-600 hover:underline sm:text-left">
                
                or go to app.ccgnj.com
              </a>
            </div>
          </div>
        </div>
        <div className="pt-1 sm:pt-0">
          <Button onClick={openCreate} className="w-full bg-slate-900 hover:bg-slate-800 sm:w-auto">
            <Plus className="h-4 w-4 mr-1" />Add Driver
          </Button>
        </div>
      </div>

      {isLoading ?
      <div className="flex justify-center py-12"><div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-700 rounded-full" /></div> :
      sortedDrivers.length === 0 ?
      <div className="text-center py-12 text-sm text-slate-500">No drivers added yet.</div> :

      <div className="grid gap-3">
          {sortedDrivers.map((driver) => {
          const accessCodeStatus = driver.access_code_status || 'Not Requested';
          const hasCreatedCode = accessCodeStatus === 'Created' && !!driver.access_code_id;
          const driverAccessCode = driver.access_code_id ? accessCodeById[driver.access_code_id] : null;

          return (
            <DriverCard
              key={driver.id}
              driver={driver}
              driverAccessCode={driverAccessCode}
              onEdit={() => openEdit(driver)}
              onDelete={() => setDriverToDelete(driver)}
              onRequestCode={() => createAccessCodeMutation.mutate(driver)}
              requestDisabled={createAccessCodeMutation.isPending || hasCreatedCode} />);


        })}
        </div>
      }

      <DriverGuidanceTabs helpLanguage={helpLanguage} onLanguageChange={setHelpLanguage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md pr-10">
          <DialogHeader className="pr-6"><DialogTitle>{editing ? 'Edit Driver' : 'Add Driver'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Driver Name *</Label>
              <Input value={form.driver_name} onChange={(e) => setForm((prev) => ({ ...prev, driver_name: e.target.value }))} placeholder="Driver name" />
              {errors.driver_name && <p className="mt-1 text-xs text-red-600">{errors.driver_name}</p>}
            </div>
            <div>
              <Label>Phone Number *</Label>
              <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: formatPhoneNumber(e.target.value) }))} placeholder="Phone number" />
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
            </div>
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Do you want this driver to receive SMS notifications?</Label>
                  <p className="text-xs text-slate-500">This is the company owner approval layer.</p>
                </div>
                <Switch checked={form.owner_sms_enabled === true} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, owner_sms_enabled: checked }))} />
              </div>
              {form.owner_sms_enabled ?
              <p className="pr-6 text-xs leading-5 text-red-600">Please have your driver opt in to SMS notifications by clicking the menu button <Menu className="mx-0.5 inline h-3.5 w-3.5 align-text-bottom" />, going to Profile, and opting in to SMS notifications.</p> :

              <p className="text-xs text-slate-500">This driver will not receive notifications on their phone. They will only see pending notifications when they open the app.</p>
              }
              <div className="rounded-lg bg-slate-50 border border-dashed p-3 opacity-70">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Driver personal SMS opt-in</Label>
                    <p className="text-xs text-slate-500">View only — drivers manage this themselves from Profile.</p>
                  </div>
                  <Switch checked={getDriverSmsState(editing).driverOptedIn} disabled />
                </div>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-slate-500">Inactive drivers remain in records but are not treated as active.</p>
              </div>
              <Switch checked={form.status === 'Active'} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, status: checked ? 'Active' : 'Inactive' }))} />
            </div>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full bg-slate-900 hover:bg-slate-800">{saveMutation.isPending ? 'Saving...' : 'Save Driver'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!driverToDelete} onOpenChange={(openState) => !openState && setDriverToDelete(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Driver</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this driver?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => driverToDelete && deleteMutation.mutate(driverToDelete.id)} disabled={deleteMutation.isPending}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

}