import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DeleteConfirmationDialog from '@/components/admin/DeleteConfirmationDialog';
import { Key, Plus, Pencil, Trash2, Building2, Shield, Copy, UserRound } from 'lucide-react';
import { getCompanyOwnerSmsState, getDriverSmsState, normalizeSmsPhone as normalizePhoneShared, formatPhoneNumber as formatPhoneShared } from '@/lib/sms';
import { validateAdminAccessCode } from '@/lib/adminAccessCodeValidation';
import { toast } from 'sonner';

function formatPhoneNumber(value) {
  return formatPhoneShared(value);
}

function normalizeSmsPhone(value) {
  return normalizePhoneShared(value);
}

function generateCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < len; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export default function AdminAccessCodes() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [accessCodePendingDelete, setAccessCodePendingDelete] = useState(null);
  const [deleteAdminCode, setDeleteAdminCode] = useState('');
  const [deleteAdminCodeError, setDeleteAdminCodeError] = useState('');
  const [form, setForm] = useState({
    code: '',
    label: '',
    active_flag: true,
    code_type: 'CompanyOwner',
    company_id: '',
    driver_id: '',
    sms_enabled: false,
    sms_phone: '',
    available_views: [],
    linked_company_ids: [],
  });

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['access-codes'],
    queryFn: () => base44.entities.AccessCode.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-all'],
    queryFn: () => base44.entities.Driver.list('-created_date', 500),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) {
        const updated = await base44.entities.AccessCode.update(editing.id, data);
        if (data.code_type === 'Driver' && data.driver_id) {
          await base44.entities.Driver.update(data.driver_id, {
            access_code_id: updated.id,
            access_code_status: 'Created',
          });
        }
        return updated;
      }

      const created = await base44.entities.AccessCode.create(data);
      if (data.code_type === 'Driver' && data.driver_id) {
        await base44.entities.Driver.update(data.driver_id, {
          access_code_id: created.id,
          access_code_status: 'Created',
        });
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-codes'] });
      queryClient.invalidateQueries({ queryKey: ['drivers-all'] });
      queryClient.invalidateQueries({ queryKey: ['drivers-all-nav'] });
      setOpen(false);
      setEditing(null);
    },
  });


  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AccessCode.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-codes'] }),
  });

  const driversForCompany = useMemo(
    () => drivers.filter((d) => d.company_id === form.company_id),
    [drivers, form.company_id],
  );

  const pendingDrivers = useMemo(
    () => drivers.filter((d) => d.access_code_status === 'Pending'),
    [drivers],
  );

  const openNew = (type) => {
    setEditing(null);
    setForm({
      code: generateCode(),
      label: '',
      active_flag: true,
      code_type: type || 'CompanyOwner',
      company_id: '',
      driver_id: '',
      sms_enabled: false,
      sms_phone: '',
      available_views: type === 'Admin' ? ['Admin'] : [],
      linked_company_ids: [],
    });
    setOpen(true);
  };

  const openPendingDriverCodeDialog = (driver) => {
    setEditing(null);
    setForm({
      code: generateCode(),
      label: driver.driver_name || '',
      active_flag: true,
      code_type: 'Driver',
      company_id: driver.company_id || '',
      driver_id: driver.id || '',
      sms_enabled: driver.sms_enabled === true,
      sms_phone: formatPhoneNumber(driver.phone || ''),
      available_views: [],
      linked_company_ids: [],
    });
    setOpen(true);
  };

  const openEdit = (code) => {
    setEditing(code);
    setForm({
      code: code.code,
      label: code.label || '',
      active_flag: code.active_flag !== false,
      code_type: code.code_type,
      company_id: code.company_id || '',
      driver_id: code.driver_id || '',
      sms_enabled: code.sms_enabled === true,
      sms_phone: formatPhoneNumber(code.sms_phone || ''),
      available_views: code.available_views || (code.code_type === 'Admin' ? ['Admin'] : []),
      linked_company_ids: code.linked_company_ids || [],
    });
    setOpen(true);
  };

  const toggleView = (view) => {
    const has = form.available_views.includes(view);
    const nextViews = has
      ? form.available_views.filter((v) => v !== view)
      : [...form.available_views, view];

    setForm({
      ...form,
      available_views: nextViews,
      linked_company_ids: nextViews.includes('CompanyOwner') ? form.linked_company_ids : [],
    });
  };

  const toggleLinkedCompany = (companyId) => {
    const has = form.linked_company_ids.includes(companyId);
    setForm({
      ...form,
      linked_company_ids: has
        ? form.linked_company_ids.filter((id) => id !== companyId)
        : [...form.linked_company_ids, companyId],
    });
  };

  const handleSave = () => {
    if (!form.code.trim()) return;

    const smsPhone = normalizeSmsPhone(form.sms_phone);

    if (form.code_type === 'Driver') {
      if (!form.company_id || !form.driver_id) return;
      const driver = drivers.find((d) => d.id === form.driver_id);
      const driverSmsState = getDriverSmsState(driver);
      const driverCompany = companies.find((c) => c.id === form.company_id);
      saveMutation.mutate({
        code: form.code,
        label: form.label || driver?.driver_name || '',
        active_flag: form.active_flag,
        code_type: 'Driver',
        company_id: form.company_id,
        company_name: driverCompany?.name || '',
        driver_id: form.driver_id,
        allowed_trucks: [],
        sms_enabled: driverSmsState.effective,
        sms_phone: driverSmsState.normalizedPhone || '',
        available_views: [],
        linked_company_ids: [],
      });
      return;
    }

    if (form.code_type === 'Admin') {
      const normalizedViews = Array.from(new Set(['Admin', ...(form.available_views || [])]));
      const requiresLinkedCompanies = normalizedViews.includes('CompanyOwner');
      const linkedCompanyIds = form.linked_company_ids || [];

      if (requiresLinkedCompanies && linkedCompanyIds.length === 0) {
        toast.error('Select at least one linked company when Company Owner workspace is enabled');
        return;
      }

      const payload = {
        ...form,
        sms_phone: smsPhone,
        available_views: normalizedViews,
        linked_company_ids: linkedCompanyIds,
      };
      saveMutation.mutate(payload);
      return;
    }

    if (form.code_type === 'CompanyOwner') {
      const company = companies.find((companyRecord) => companyRecord.id === form.company_id);
      const ownerSmsState = getCompanyOwnerSmsState({ accessCode: editing || form, company });
      saveMutation.mutate({
        ...form,
        company_name: company?.name || '',
        sms_enabled: ownerSmsState.effective,
        sms_phone: ownerSmsState.normalizedPhone || '',
        available_views: [],
        linked_company_ids: [],
      });
      return;
    }

    toast.error('Unsupported access code type. Use Admin, Company Owner, or Driver.');
    return;
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied');
  };

  const codeTypeIcons = { CompanyOwner: Building2, Admin: Shield, Driver: UserRound };

  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies],
  );

  const driverById = useMemo(
    () => new Map(drivers.map((driver) => [driver.id, driver])),
    [drivers],
  );

  const sortByLabelThenCode = (a, b) => {
    const aKey = (a.label || a.code || '').toLowerCase();
    const bKey = (b.label || b.code || '').toLowerCase();
    if (aKey !== bKey) return aKey.localeCompare(bKey);
    return (a.code || '').toLowerCase().localeCompare((b.code || '').toLowerCase());
  };

  const sortDriversByNameLabelCode = (a, b) => {
    const aDriverName = driverById.get(a.driver_id)?.driver_name || '';
    const bDriverName = driverById.get(b.driver_id)?.driver_name || '';
    const aKey = (aDriverName || a.label || a.code || '').toLowerCase();
    const bKey = (bDriverName || b.label || b.code || '').toLowerCase();
    if (aKey !== bKey) return aKey.localeCompare(bKey);
    return (a.code || '').toLowerCase().localeCompare((b.code || '').toLowerCase());
  };

  const groupedCodes = useMemo(() => {
    const standardCodeTypes = new Set(['Admin', 'CompanyOwner', 'Driver']);

    const adminCodes = codes
      .filter((code) => code.code_type === 'Admin')
      .sort(sortByLabelThenCode);

    const legacyCodes = codes
      .filter((code) => !standardCodeTypes.has(code.code_type))
      .sort(sortByLabelThenCode);

    const companyCodeMap = new Map();

    codes
      .filter((code) => code.code_type === 'CompanyOwner' || code.code_type === 'Driver')
      .forEach((code) => {
        const companyId = code.company_id || 'unknown-company';
        const companyName = companyById.get(code.company_id)?.name || code.company_name || 'Unknown Company';

        if (!companyCodeMap.has(companyId)) {
          companyCodeMap.set(companyId, {
            companyId,
            companyName,
            ownerCodes: [],
            driverCodes: [],
          });
        }

        const section = companyCodeMap.get(companyId);
        if (code.code_type === 'CompanyOwner') section.ownerCodes.push(code);
        if (code.code_type === 'Driver') section.driverCodes.push(code);
      });

    const companySections = Array.from(companyCodeMap.values())
      .map((section) => ({
        ...section,
        ownerCodes: section.ownerCodes.sort(sortByLabelThenCode),
        driverCodes: section.driverCodes.sort(sortDriversByNameLabelCode),
      }))
      .sort((a, b) => a.companyName.localeCompare(b.companyName));

    return { adminCodes, companySections, legacyCodes };
  }, [codes, companyById, driverById]);

  const renderCodeCard = (c) => {
    const Icon = codeTypeIcons[c.code_type] || Key;
    const comp = companyById.get(c.company_id);
    const driver = driverById.get(c.driver_id);

    return (
      <Card key={c.id} className={`transition-shadow hover:shadow-sm ${c.active_flag === false ? 'opacity-50' : ''}`}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-slate-900 tracking-wide">{c.code}</span>
                  <button onClick={() => copyCode(c.code)} className="text-slate-400 hover:text-slate-600">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <Badge variant={c.active_flag !== false ? 'default' : 'secondary'} className="text-xs">
                    {c.active_flag !== false ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant={c.used_by_user_id ? 'secondary' : 'outline'} className="text-xs">
                    {c.used_by_user_id ? 'Used' : 'Unused'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{c.code_type}</Badge>
                </div>
                {c.label && <p className="text-sm text-slate-600 mt-0.5">Name: {c.label}</p>}
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                  {comp && <span>Company: {comp.name}</span>}
                  {driver && <span>Driver: {driver.driver_name || driver.id}</span>}
                  {c.used_at && <span>Claimed: {new Date(c.used_at).toLocaleString()}</span>}
                  {c.code_type === 'Admin' && (c.allowed_trucks || []).length > 0 && (
                    <span>Trucks: {c.allowed_trucks.join(', ')}</span>
                  )}
                  {c.code_type === 'Admin' && (c.available_views || []).length > 0 && (
                    <span>Views: {(c.available_views || []).join(', ')}</span>
                  )}
                  {c.code_type === 'Admin' && (c.linked_company_ids || []).length > 0 && (
                    <span>Linked companies: {(c.linked_company_ids || []).length}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="h-8 w-8">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setAccessCodePendingDelete(c)} className="h-8 w-8 text-red-500 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const confirmDeleteAccessCode = () => {
    if (!accessCodePendingDelete) return;

    const validation = validateAdminAccessCode(deleteAdminCode, codes);
    if (!validation.isValid) {
      setDeleteAdminCodeError(validation.error);
      return;
    }

    deleteMutation.mutate(accessCodePendingDelete.id, {
      onSuccess: () => {
        setAccessCodePendingDelete(null);
        setDeleteAdminCode('');
        setDeleteAdminCodeError('');
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Access Codes</h2>
          <p className="text-sm text-slate-500">{codes.length} codes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => openNew('CompanyOwner')} className="text-xs">
            <Building2 className="h-3.5 w-3.5 mr-1" />Owner Code
          </Button>
          <Button variant="outline" onClick={() => openNew('Driver')} className="text-xs">
            <UserRound className="h-3.5 w-3.5 mr-1" />Driver Code
          </Button>
          <Button onClick={() => openNew('Admin')} className="bg-slate-900 hover:bg-slate-800 text-xs">
            <Shield className="h-3.5 w-3.5 mr-1" />Admin Code
          </Button>
        </div>
      </div>

      {pendingDrivers.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Pending Driver Access Code Requests</h3>
              <p className="text-xs text-amber-700">Create a Driver code for requested drivers.</p>
            </div>
            <div className="space-y-2">
              {pendingDrivers.map((driver) => {
                const company = companies.find((c) => c.id === driver.company_id);
                return (
                  <div key={driver.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-lg border p-3 gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm min-w-0 flex-1">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">Driver</p>
                        <p className="font-medium text-slate-900 truncate">{driver.driver_name || 'Unnamed driver'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">Company</p>
                        <p className="text-slate-700 truncate">{company?.name || 'Unknown company'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">Phone</p>
                        <p className="text-slate-700 truncate">{driver.phone || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">Current Status</p>
                        <Badge variant="outline">{driver.access_code_status || 'Not Requested'}</Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="text-xs"
                      disabled={saveMutation.isPending}
                      onClick={() => openPendingDriverCodeDialog(driver)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />Create Code
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-700 rounded-full" />
        </div>
      ) : codes.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">No access codes yet</div>
      ) : (
        <div className="space-y-4">
          <details open className="group rounded-lg border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3 select-none">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Admin</h3>
                </div>
                <Badge variant="outline" className="text-xs">{groupedCodes.adminCodes.length}</Badge>
              </div>
            </summary>
            <div className="px-3 pb-3 grid gap-3">
              {groupedCodes.adminCodes.length === 0 ? (
                <div className="px-2 py-3 text-xs text-slate-500">No Admin codes</div>
              ) : (
                groupedCodes.adminCodes.map((code) => renderCodeCard(code))
              )}
            </div>
          </details>

          {groupedCodes.companySections.map((section) => (
            <details key={section.companyId} className="group rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-4 py-3 select-none">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-600" />
                    <h3 className="text-sm font-semibold text-slate-900">{section.companyName}</h3>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">Owners: {section.ownerCodes.length}</Badge>
                    <Badge variant="outline" className="text-xs">Drivers: {section.driverCodes.length}</Badge>
                    <Badge variant="outline" className="text-xs">Total: {section.ownerCodes.length + section.driverCodes.length}</Badge>
                  </div>
                </div>
              </summary>

              <div className="px-3 pb-3 space-y-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-1">Owner Codes</h4>
                  {section.ownerCodes.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-slate-500">No Owner codes</div>
                  ) : (
                    <div className="grid gap-3">
                      {section.ownerCodes.map((code) => renderCodeCard(code))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-1">Driver Codes</h4>
                  {section.driverCodes.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-slate-500">No Driver codes</div>
                  ) : (
                    <div className="grid gap-3">
                      {section.driverCodes.map((code) => renderCodeCard(code))}
                    </div>
                  )}
                </div>
              </div>
            </details>
          ))}

          {groupedCodes.legacyCodes.length > 0 && (
            <details open className="group rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-4 py-3 select-none">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-slate-600" />
                    <h3 className="text-sm font-semibold text-slate-900">Other / Legacy Codes</h3>
                  </div>
                  <Badge variant="outline" className="text-xs">{groupedCodes.legacyCodes.length}</Badge>
                </div>
              </summary>
              <div className="px-3 pb-3 grid gap-3">
                {groupedCodes.legacyCodes.map((code) => renderCodeCard(code))}
              </div>
            </details>
          )}
        </div>
      )}


      <DeleteConfirmationDialog
        open={!!accessCodePendingDelete}
        onOpenChange={(openState) => {
          if (openState) return;
          setAccessCodePendingDelete(null);
          setDeleteAdminCode('');
          setDeleteAdminCodeError('');
        }}
        title="Delete Access Code?"
        description="This action permanently deletes this access code. Enter an active admin access code to continue."
        onConfirm={confirmDeleteAccessCode}
        isDeleting={deleteMutation.isPending}
        requireAdminAccessCode
        adminAccessCode={deleteAdminCode}
        onAdminAccessCodeChange={(value) => {
          setDeleteAdminCode(value);
          setDeleteAdminCodeError('');
        }}
        adminAccessCodeError={deleteAdminCodeError}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Access Code' : `New ${form.code_type} Code`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code *</Label>
              <div className="flex gap-2">
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="font-mono tracking-wide" />
                <Button type="button" variant="outline" onClick={() => setForm({ ...form, code: generateCode() })}>
                  Generate
                </Button>
              </div>
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g., Owner ABC, Driver Jane Doe" />
            </div>
            <div>
              <Label>Code Type</Label>
              <Select
                value={form.code_type}
                onValueChange={(v) => setForm({ ...form, code_type: v, company_id: '', driver_id: '', available_views: v === 'Admin' ? ['Admin'] : [], linked_company_ids: [] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CompanyOwner">Company Owner</SelectItem>
                  <SelectItem value="Driver">Driver</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>


            {form.code_type === 'Admin' && (
              <div className="space-y-3">
                <div>
                  <Label>Available Workspaces</Label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {['Admin', 'CompanyOwner'].map((view) => (
                      <button
                        key={view}
                        onClick={() => toggleView(view)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                          form.available_views.includes(view)
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {view === 'CompanyOwner' ? 'Company Owner' : view}
                      </button>
                    ))}
                  </div>
                </div>

                {form.available_views.includes('CompanyOwner') && (
                  <div>
                    <Label>Linked Companies</Label>
                    <div className="flex gap-2 flex-wrap mt-1">
                      {companies.map((company) => (
                        <button
                          key={company.id}
                          onClick={() => toggleLinkedCompany(company.id)}
                          className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                            form.linked_company_ids.includes(company.id)
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          {company.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.code_type !== 'Admin' && (
              <>
                <div>
                  <Label>Company *</Label>
                  <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v, driver_id: '' })}>
                    <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.code_type === 'Driver' && form.company_id && (
                  <div>
                    <Label>Driver *</Label>
                    <Select
                      value={form.driver_id}
                      onValueChange={(v) => {
                        const selectedDriver = drivers.find((d) => d.id === v);
                        setForm({
                          ...form,
                          driver_id: v,
                          label: form.label || selectedDriver?.driver_name || '',
                        });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                      <SelectContent>
                        {driversForCompany.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>{driver.driver_name || driver.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              SMS opt-in, consent capture, and compliance details now live in Profile and company/driver pages to keep Access Codes focused on code management.
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.active_flag} onCheckedChange={(v) => setForm({ ...form, active_flag: v })} />
            </div>

            <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full bg-slate-900 hover:bg-slate-800">
              {saveMutation.isPending ? 'Saving...' : 'Save Code'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
