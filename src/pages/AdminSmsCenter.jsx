import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { normalizeSmsPhone } from '@/lib/sms';
import { normalizeUsSmsPhone } from '@/lib/smsPhone';
import { getDriverSmsState, getCompanyOwnerSmsState, getAdminSmsProductState } from '@/lib/sms';
import { DEFAULT_SMS_RULES, getSmsRules, listSmsBroadcasts, resolveEffectiveSharedAdminAccessCode, saveSmsBroadcast, saveSmsRules } from '@/lib/smsConfig';
import { SMS_WELCOME_MESSAGE } from '@/lib/smsIntro';
import { formatDispatchDateTimeLine } from '@/components/notifications/dispatchDateTimeFormat';
import { useSession } from '@/components/session/SessionContext';
import { getEffectiveView } from '@/components/session/workspaceUtils';

const SMS_PROVIDER = 'signalwire';

const RULE_META = [
  ['driver_dispatch_assigned', 'Driver dispatch assigned'],
  ['driver_dispatch_updated', 'Driver dispatch updated'],
  ['driver_dispatch_amended', 'Driver dispatch amended'],
  ['driver_dispatch_cancelled', 'Driver dispatch cancelled'],
  ['driver_dispatch_removed', 'Driver dispatch removed'],
  ['owner_dispatch_status_change', 'Company owner dispatch status changes'],
  ['owner_dispatch_info_update', 'Company owner informational updates'],
  ['admin_notifications', 'Admin notifications eligible for SMS'],
  ['welcome_sms', 'Welcome / intro SMS'],
  ['opt_out_confirmation_sms', 'Opt-out confirmation SMS'],
  ['informational_broadcast_sms', 'Informational / broadcast SMS'],
];

const TEMPLATE_GROUP_ORDER = ['Company Owner', 'Driver', 'Admin', 'General'];

function createTemplatePreview({
  group,
  title,
  body,
  editable = false,
  description = '',
}) {
  return { group, title, body, editable, description };
}

function sampleDispatchDateTimeLine() {
  return formatDispatchDateTimeLine({ date: '2026-04-14', start_time: '05:00:00' }, 'at') || 'TUE 04-14-2026 at 5:00 AM';
}

function sampleOwnerDispatchDateShiftLine() {
  return 'TUE 04-14-2026 DAY SHIFT';
}

function getTemplateCardClasses(templateTitle) {
  const title = String(templateTitle || '').toLowerCase();

  if (title.includes('scheduled dispatch sms')) return 'border-blue-300 bg-blue-50';
  if (title.includes('dispatch sms')) return 'border-emerald-300 bg-emerald-50';
  if (title.includes('dispatch assigned sms')) return 'border-emerald-300 bg-emerald-50';
  if (title.includes('all confirmed sms')) return 'border-emerald-300 bg-emerald-50';
  if (title.includes('assignment removed sms')) return 'border-rose-300 bg-rose-50';
  if (title.includes('amendment sms') || title.includes('amended sms') || title.includes('truck reassignment sms')) return 'border-amber-300 bg-amber-50';
  if (title.includes('cancellation sms') || title.includes('cancelled sms')) return 'border-red-300 bg-red-50';
  if (title.includes('optional informational update sms')) return 'border-orange-300 bg-orange-50';
  if (title.includes('broadcast / informational sms')) return 'border-slate-300 bg-slate-50';
  if (title.includes('availability updated sms')) return 'border-violet-300 bg-violet-50';
  return 'border-slate-300 bg-slate-50';
}

function getStatusClasses(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'sent' || normalized === 'delivered') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'skipped') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (normalized === 'failed') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function formatPayload(payload) {
  if (payload == null || payload === '') return '—';
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export default function AdminSmsCenter() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const effectiveView = getEffectiveView(session);
  const isAdmin = effectiveView === 'Admin';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [broadcastForm, setBroadcastForm] = useState({
    message: '',
    send_mode: 'now',
    scheduled_at: '',
    include_drivers: true,
    include_owners: true,
    include_admins: false,
  });

  const { data: smsRules = DEFAULT_SMS_RULES } = useQuery({ queryKey: ['sms-rules'], queryFn: getSmsRules, enabled: isAdmin });
  const { data: logs = [] } = useQuery({
    queryKey: ['sms-general-logs'],
    queryFn: () => base44.entities.General.filter({ record_type: 'sms_log' }, '-created_date', 500),
    enabled: isAdmin,
  });
  const { data: inbound = [] } = useQuery({
    queryKey: ['sms-inbound-logs'],
    queryFn: () => base44.entities.General.filter({ record_type: 'sms_inbound_log' }, '-created_date', 500),
    enabled: isAdmin,
  });
  const { data: broadcasts = [] } = useQuery({ queryKey: ['sms-broadcasts'], queryFn: listSmsBroadcasts, enabled: isAdmin });
  const { data: accessCodes = [] } = useQuery({ queryKey: ['sms-center-access-codes'], queryFn: () => base44.entities.AccessCode.list('-created_date', 500), enabled: isAdmin });
  const { data: drivers = [] } = useQuery({ queryKey: ['sms-center-drivers'], queryFn: () => base44.entities.Driver.list('-created_date', 500), enabled: isAdmin });
  const { data: companies = [] } = useQuery({ queryKey: ['sms-center-companies'], queryFn: () => base44.entities.Company.list('-created_date', 500), enabled: isAdmin });

  const rulesMutation = useMutation({
    mutationFn: saveSmsRules,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sms-rules'] });
      toast.success('SMS rules saved');
    },
    onError: (error) => toast.error(error?.message || 'Unable to save SMS rules'),
  });

  const companiesById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const driversById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);
  const accessCodesById = useMemo(() => new Map(accessCodes.map((code) => [code.id, code])), [accessCodes]);

  const resolveOutboundLogRecipient = useCallback((entry) => {
    if (!entry) return { role: '—', name: '—', company: '—' };

    const code = accessCodesById.get(entry.recipient_access_code_id);
    const resolvedType = String(code?.code_type || entry.recipient_type || '').toLowerCase();

    if (resolvedType === 'companyowner') {
      const company = companiesById.get(code?.company_id);
      return {
        role: 'Company Owner',
        name: code?.label || code?.code || entry.recipient_name || 'Company Owner',
        company: company?.company_name || company?.name || '—',
      };
    }

    if (resolvedType === 'driver') {
      const driver = driversById.get(code?.driver_id);
      const company = companiesById.get(driver?.company_id);
      const driverName = driver?.full_name || `${driver?.first_name || ''} ${driver?.last_name || ''}`.trim() || driver?.name;
      return {
        role: 'Driver',
        name: driverName || entry.recipient_name || code?.label || code?.code || 'Driver',
        company: company?.company_name || company?.name || '—',
      };
    }

    if (resolvedType === 'admin') {
      return {
        role: 'Admin',
        name: code?.label || code?.code || entry.recipient_name || 'Admin',
        company: '—',
      };
    }

    return {
      role: entry.recipient_type || '—',
      name: entry.recipient_name || code?.label || code?.code || '—',
      company: '—',
    };
  }, [accessCodesById, companiesById, driversById]);

  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      const resolved = resolveOutboundLogRecipient(entry);
      const statusOk = statusFilter === 'all' || String(entry.status || '').toLowerCase() === statusFilter;
      const roleOk = roleFilter === 'all' || String(resolved.role || '').toLowerCase() === roleFilter;
      const text = `${entry.phone || ''} ${resolved.name || ''} ${entry.dispatch_id || ''}`.toLowerCase();
      const searchOk = !search || text.includes(search.toLowerCase());
      const ts = new Date(entry.sent_at || entry.created_date || entry.created_at || 0).getTime();
      const startOk = !startDate || ts >= new Date(`${startDate}T00:00:00`).getTime();
      const endOk = !endDate || ts <= new Date(`${endDate}T23:59:59`).getTime();
      return statusOk && roleOk && searchOk && startOk && endOk;
    });
  }, [logs, statusFilter, roleFilter, search, startDate, endDate, resolveOutboundLogRecipient]);

  const knownSmsPhones = useMemo(() => {
    const phoneMap = new Map();
    const setPhone = (rawPhone, payload) => {
      if (!rawPhone) return;
      const candidates = [normalizeSmsPhone(rawPhone), normalizeUsSmsPhone(rawPhone), String(rawPhone).trim()].filter(Boolean);
      candidates.forEach((phone) => {
        const key = String(phone);
        if (!phoneMap.has(key) || phoneMap.get(key).role === 'Admin') {
          phoneMap.set(key, payload);
        }
      });
    };

    for (const code of accessCodes) {
      if (code.code_type === 'CompanyOwner') {
        const companyName = companiesById.get(code.company_id)?.company_name || companiesById.get(code.company_id)?.name || '—';
        setPhone(code.sms_phone, {
          role: 'Company Owner',
          name: code.label || code.code || 'Company Owner',
          company: companyName,
        });
      }
      if (code.code_type === 'Admin') {
        setPhone(code.sms_phone, {
          role: 'Admin',
          name: code.label || code.code || 'Admin',
          company: '—',
        });
      }
    }

    for (const driver of drivers) {
      const companyName = companiesById.get(driver.company_id)?.company_name || companiesById.get(driver.company_id)?.name || '—';
      const driverName = driver.full_name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || driver.name || 'Driver';
      setPhone(driver.sms_phone || driver.phone, {
        role: 'Driver',
        name: driverName,
        company: companyName,
      });
    }

    return phoneMap;
  }, [accessCodes, drivers, companiesById]);

  const templateCatalogByGroup = useMemo(() => {
    const dispatchLine = sampleDispatchDateTimeLine();
    const catalog = [
      createTemplatePreview({
        group: 'Company Owner',
        title: 'Scheduled dispatch SMS',
        body: [
          'CCG Transit: Scheduled',
          '(2) trucks have been scheduled for:',
          sampleOwnerDispatchDateShiftLine(),
          '',
          'Details to follow.',
          'Please open the app to view and confirm.',
        ].join('\n'),
        description: 'Status=Scheduled owner dispatch format generated by SMS formatter.',
      }),
      createTemplatePreview({
        group: 'Company Owner',
        title: 'Dispatch SMS',
        body: [
          'CCG Transit: Dispatch',
          'You have received a new dispatch for:',
          dispatchLine,
          '',
          'Please open the app to view and CONFIRM.',
        ].join('\n'),
        description: 'Status=Dispatch owner dispatch format.',
      }),
      createTemplatePreview({
        group: 'Company Owner',
        title: 'Amendment SMS',
        body: [
          'CCG Transit: Amendment',
          'Your dispatch has been amended to:',
          dispatchLine,
          '',
          'Please open the app to view and CONFIRM.',
        ].join('\n'),
        description: 'Status=Amended owner dispatch format.',
      }),
      createTemplatePreview({
        group: 'Company Owner',
        title: 'Cancellation SMS',
        body: [
          'CCG Transit: Cancellation',
          'Your dispatch has been cancelled:',
          dispatchLine,
          '',
          'Please open the app to view and CONFIRM.',
        ].join('\n'),
        description: 'Status=Cancelled owner dispatch format.',
      }),
      createTemplatePreview({
        group: 'Company Owner',
        title: 'Optional informational update SMS',
        body: [
          'CCG Transit: Update',
          'Your dispatch has been updated:',
          dispatchLine,
          '',
          'Please open the app to view and CONFIRM.',
        ].join('\n'),
        description: 'Informational update owner dispatch format.',
      }),

      createTemplatePreview({
        group: 'Driver',
        title: 'Driver dispatch assigned SMS',
        body: `CCG Transit: Dispatch Assigned.\n${dispatchLine}\n\nPlease open the app to view and confirm.`,
        description: 'Driver assignment notification SMS format.',
      }),
      createTemplatePreview({
        group: 'Driver',
        title: 'Driver dispatch amended SMS',
        body: `CCG Transit: Dispatch Amended.\n${dispatchLine}\n\nPlease open the app to view and confirm.`,
        description: 'Driver amended dispatch SMS format.',
      }),
      createTemplatePreview({
        group: 'Driver',
        title: 'Driver dispatch cancelled SMS',
        body: `CCG Transit: Dispatch Cancelled.\n${dispatchLine}\n\nPlease open the app to view and confirm.`,
        description: 'Driver cancelled dispatch SMS format.',
      }),
      createTemplatePreview({
        group: 'Driver',
        title: 'Driver dispatch assignment removed SMS',
        body: `CCG Transit: Dispatch Removed.\n${dispatchLine}\n\nPlease open the app to view and confirm.`,
        description: 'Driver removed-assignment SMS format.',
      }),
      createTemplatePreview({
        group: 'Driver',
        title: 'Driver optional informational update SMS',
        body: `CCG Transit: Dispatch Updated.\n${dispatchLine}\n\nPlease open the app to view and confirm.`,
        description: 'Driver non-status-change update SMS format (supported).',
      }),

      createTemplatePreview({
        group: 'Admin',
        title: 'Admin SMS (generic)',
        body: 'CCG Transit: Operations update available. Please open the app.',
        editable: true,
        description: 'Generic branded admin SMS format when notification is non-dispatch.',
      }),
      createTemplatePreview({
        group: 'Admin',
        title: 'Admin dispatch all confirmed SMS',
        body: `CCG Transit: Acme Hauling has confirmed the dispatch.\nTUE 04-14-2026 at 7:00 AM\nJOB-1042 | TRK-12, TRK-44\n\nPlease open the app to view and confirm.`,
        description: 'Admin-targeted dispatch-related notification SMS example.',
      }),
      createTemplatePreview({
        group: 'Admin',
        title: 'Admin owner availability updated SMS',
        body: 'CCG Transit: Availability Updated.\nCompany owner for Acme Hauling updated their availability.\n\nPlease open the app to view and confirm.',
        description: 'Admin availability update notification SMS example.',
      }),
      createTemplatePreview({
        group: 'Admin',
        title: 'Admin owner truck reassignment SMS',
        body: `CCG Transit: Acme Hauling changed their truck.\nDispatcher updated TRK-12 to TRK-44\nTUE 04-14-2026 DAY SHIFT\n\nPlease open the app to view and confirm.`,
        description: 'Admin owner-truck-change notification SMS example.',
      }),

      createTemplatePreview({
        group: 'General',
        title: 'Welcome SMS',
        body: SMS_WELCOME_MESSAGE,
        editable: true,
      }),
      createTemplatePreview({
        group: 'General',
        title: 'Opt-out confirmation SMS',
        body: 'CCG Transit: You are now opted out of SMS notifications.',
        editable: true,
      }),
      createTemplatePreview({
        group: 'General',
        title: 'Broadcast / informational SMS',
        body: 'CCG Transit: Service update for today. Please review in app.',
        editable: true,
      }),
    ];

    return TEMPLATE_GROUP_ORDER.map((group) => ({
      group,
      templates: catalog.filter((template) => template.group === group),
    })).filter((entry) => entry.templates.length > 0);
  }, []);

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const trimmedMessage = broadcastForm.message.trim();
      if (!trimmedMessage) throw new Error('Broadcast message is required.');
      const recipients = new Set();
      const sharedAdminAccessCode = broadcastForm.include_admins
        ? await resolveEffectiveSharedAdminAccessCode()
        : null;

      for (const code of accessCodes) {
        if (code.code_type === 'Driver' && !broadcastForm.include_drivers) continue;
        if (code.code_type === 'CompanyOwner' && !broadcastForm.include_owners) continue;
        if (code.code_type === 'Admin') continue;
        recipients.add(code.id);
      }

      if (broadcastForm.include_admins) {
        if (sharedAdminAccessCode?.id) {
          recipients.add(sharedAdminAccessCode.id);
        } else {
          await base44.entities.General.create({
            record_type: 'sms_log',
            status: 'skipped',
            recipient_access_code_id: null,
            recipient_type: 'Admin',
            recipient_name: 'Shared Admin',
            phone: null,
            message: trimmedMessage,
            skip_reason: 'shared_admin_config_not_found',
            provider: SMS_PROVIDER,
          });
        }
      }

      const broadcastId = `b_${Date.now()}`;
      const payload = {
        broadcast_id: broadcastId,
        message: trimmedMessage,
        include_drivers: broadcastForm.include_drivers,
        include_owners: broadcastForm.include_owners,
        include_admins: broadcastForm.include_admins,
        send_mode: broadcastForm.send_mode,
        scheduled_at: broadcastForm.send_mode === 'scheduled' ? broadcastForm.scheduled_at || null : null,
        status: broadcastForm.send_mode === 'scheduled' ? 'scheduled_pending_backend' : 'sending',
        recipient_count: recipients.size,
        created_at: new Date().toISOString(),
      };

      await saveSmsBroadcast(payload);

      if (broadcastForm.send_mode === 'scheduled') {
        return { scheduled: true };
      }

      const driversById = new Map(drivers.map((driver) => [driver.id, driver]));
      const companyById = new Map(companies.map((company) => [company.id, company]));

      for (const code of accessCodes) {
        if (!recipients.has(code.id)) continue;

        let smsPhone = '';
        let smsEnabled = false;
        let skipReason = null;

        if (code.code_type === 'Driver') {
          const driver = driversById.get(code.driver_id);
          const state = getDriverSmsState(driver);
          smsPhone = state.normalizedPhone;
          smsEnabled = state.effective;
          skipReason = !state.ownerEnabled ? 'owner_sms_disabled' : !state.driverOptedIn ? 'driver_not_opted_in' : !state.hasValidPhone ? 'missing_sms_phone' : null;
        } else if (code.code_type === 'CompanyOwner') {
          const company = companyById.get(code.company_id);
          const state = getCompanyOwnerSmsState({ accessCode: code, company });
          smsPhone = state.normalizedPhone;
          smsEnabled = state.effective;
          skipReason = state.optedOut ? 'sms_opted_out' : !state.optedIn ? 'owner_not_opted_in' : !state.hasValidPhone ? 'missing_sms_phone' : null;
        } else if (code.code_type === 'Admin') {
          const state = getAdminSmsProductState(code);
          smsPhone = normalizeUsSmsPhone(code.sms_phone);
          smsEnabled = state.optedIn && !state.optedOut && state.hasValidPhone;
          skipReason = state.optedOut ? 'sms_opted_out' : !state.optedIn ? 'sms_disabled' : !state.hasValidPhone ? 'missing_sms_phone' : null;
        }

        if (!smsEnabled || !smsPhone) {
          await base44.entities.General.create({
            record_type: 'sms_log',
            status: 'skipped',
            recipient_access_code_id: code.id,
            recipient_type: code.code_type,
            recipient_name: code.label || code.code,
            phone: smsPhone || null,
            message: trimmedMessage,
            skip_reason: skipReason || 'sms_disabled',
            provider: SMS_PROVIDER,
          });
          continue;
        }

        try {
          const response = await base44.functions.invoke('sendNotificationSms', { phone: smsPhone, message: `CCG Transit: ${trimmedMessage}` });
          const responseData = response?.data || response || {};
          await base44.entities.General.create({
            record_type: 'sms_log',
            status: responseData?.ok ? 'sent' : 'failed',
            recipient_access_code_id: code.id,
            recipient_type: code.code_type,
            recipient_name: code.label || code.code,
            phone: smsPhone,
            message: `CCG Transit: ${trimmedMessage}`,
            error_message: responseData?.ok ? null : responseData?.error || 'Broadcast send failed',
            provider: responseData?.provider || SMS_PROVIDER,
            provider_message_id: responseData?.providerMessageId || null,
            sent_at: responseData?.sentAt || null,
            skip_reason: null,
          });
        } catch (error) {
          await base44.entities.General.create({
            record_type: 'sms_log',
            status: 'failed',
            recipient_access_code_id: code.id,
            recipient_type: code.code_type,
            recipient_name: code.label || code.code,
            phone: smsPhone,
            message: `CCG Transit: ${trimmedMessage}`,
            provider: SMS_PROVIDER,
            error_message: error?.message || String(error),
          });
        }
      }

      return { scheduled: false };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['sms-broadcasts'] });
      await queryClient.invalidateQueries({ queryKey: ['sms-general-logs'] });
      setBroadcastForm({ message: '', send_mode: 'now', scheduled_at: '', include_drivers: true, include_owners: true, include_admins: false });
      toast.success(result?.scheduled ? 'Broadcast saved as scheduled pending backend processing.' : 'Broadcast send completed.');
    },
    onError: (error) => toast.error(error?.message || 'Unable to process broadcast'),
  });

  if (!isAdmin) return <div className="text-sm text-slate-500">Admin access required.</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">SMS Center</h2>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rules">Notification Rules</TabsTrigger>
          <TabsTrigger value="templates">Templates / Previews</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="inbound">Inbound / Replies</TabsTrigger>
          <TabsTrigger value="broadcasts">Broadcasts / Scheduled</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card><CardContent className="p-4 text-sm text-slate-600 space-y-2">
            <p>Shared admin SMS is active product-wide and controlled by app settings + shared admin profile toggle/phone.</p>
            <p>Dispatch SMS remains short format: brand prefix, short title, dispatch date/time, app-open CTA.</p>
            <p>This center surfaces logs from General records and stores configuration in AppConfig keys.</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card><CardHeader><CardTitle className="text-base">SMS Notification Rules</CardTitle></CardHeader><CardContent className="space-y-3">
            {RULE_META.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded border p-3">
                <Label>{label}</Label>
                <Switch checked={smsRules[key] !== false} onCheckedChange={(checked) => rulesMutation.mutate({ ...smsRules, [key]: checked })} />
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card><CardHeader><CardTitle className="text-base">Templates / Previews</CardTitle></CardHeader><CardContent className="space-y-4">
            <p className="text-xs text-slate-500">Full SMS template catalog derived from current notification/SMS formatting behavior. Dispatch dynamic fields (date/time/status/truck context) are shown as representative examples and remain system-generated.</p>
            <div className="space-y-4">
              {templateCatalogByGroup.map((section) => (
                <div key={section.group} className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">{section.group}</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {section.templates.map((template) => (
                      <div key={`${section.group}-${template.title}`} className={`rounded border p-3 ${getTemplateCardClasses(template.title)}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-sm">{template.title}</p>
                          <Badge variant="outline" className="text-[10px]">{template.group}</Badge>
                        </div>
                        {template.description && <p className="text-xs mt-1 text-slate-600">{template.description}</p>}
                        <pre className="whitespace-pre-wrap text-xs mt-2 text-slate-700">{template.body}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card><CardHeader><CardTitle className="text-base">SMS Logs</CardTitle></CardHeader><CardContent className="space-y-3">
            <div className="grid md:grid-cols-6 gap-2">
              <Input placeholder="Search phone / recipient / dispatch" value={search} onChange={(e) => setSearch(e.target.value)} className="md:col-span-2" />
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="sent">Sent</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="skipped">Skipped</SelectItem></SelectContent></Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem><SelectItem value="driver">Driver</SelectItem><SelectItem value="companyowner">Company Owner</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-3">
              {filteredLogs.length === 0 ? <p className="text-sm text-slate-500">No SMS logs found for current filters.</p> : filteredLogs.map((entry) => {
                const resolvedRecipient = resolveOutboundLogRecipient(entry);
                return (
                <div key={entry.id} className="rounded-lg border bg-white p-4 text-xs shadow-sm space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`uppercase ${getStatusClasses(entry.status)}`}>{entry.status || 'unknown'}</Badge>
                    <span className="text-slate-500">{format(new Date(entry.sent_at || entry.created_date || entry.created_at || Date.now()), 'PPp')}</span>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <p><span className="font-semibold text-slate-700">Recipient role:</span> {resolvedRecipient.role}</p>
                    <p><span className="font-semibold text-slate-700">Recipient name:</span> {resolvedRecipient.name}</p>
                    <p><span className="font-semibold text-slate-700">Phone:</span> {normalizeSmsPhone(entry.phone) || entry.phone || '—'}</p>
                    <p><span className="font-semibold text-slate-700">Company:</span> {resolvedRecipient.company}</p>
                    <p><span className="font-semibold text-slate-700">Dispatch ID:</span> {entry.dispatch_id || '—'}</p>
                    <p><span className="font-semibold text-slate-700">Provider:</span> {entry.provider || '—'}</p>
                    <p className="md:col-span-2"><span className="font-semibold text-slate-700">Provider message ID:</span> {entry.provider_message_id || '—'}</p>
                  </div>

                  <div className="rounded border bg-slate-50 p-3">
                    <p className="mb-1 font-semibold text-slate-700">Message</p>
                    <pre className="whitespace-pre-wrap break-words text-slate-700">{entry.message || 'No message body logged.'}</pre>
                  </div>

                  {entry.skip_reason && <div className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-700"><span className="font-semibold">Skip reason:</span> {entry.skip_reason}</div>}
                  {entry.error_message && <div className="rounded border border-red-200 bg-red-50 p-2 text-red-700"><span className="font-semibold">Error:</span> {entry.error_message}</div>}
                </div>
              )})}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="inbound">
          <Card><CardHeader><CardTitle className="text-base">Inbound / Replies / Opt-Outs</CardTitle></CardHeader><CardContent>
            {inbound.length === 0 ? (
              <p className="text-sm text-slate-500">No inbound SMS records yet. When provider callbacks/webhooks are wired, replies (STOP/HELP/etc.), opt-outs, and payload statuses will appear here.</p>
            ) : (
              <div className="space-y-3">{inbound.map((entry) => {
                const normalizedPhone = normalizeSmsPhone(entry.phone) || normalizeUsSmsPhone(entry.phone) || entry.phone || '';
                const matched = knownSmsPhones.get(String(normalizedPhone)) || knownSmsPhones.get(String(entry.phone || ''));
                return (
                <div key={entry.id} className="rounded-lg border bg-white p-4 text-xs shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{normalizeSmsPhone(entry.phone) || entry.phone || 'Unknown sender'}</p>
                    <span className="text-slate-500">{format(new Date(entry.created_date || entry.created_at || Date.now()), 'PPp')}</span>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <p><span className="font-semibold text-slate-700">Matched user:</span> {matched?.name || '—'}</p>
                    <p><span className="font-semibold text-slate-700">Matched role:</span> {matched?.role || '—'}</p>
                    <p className="md:col-span-2"><span className="font-semibold text-slate-700">Matched company:</span> {matched?.company || '—'}</p>
                    <p className="md:col-span-2"><span className="font-semibold text-slate-700">Inbound keyword:</span> {entry.inbound_keyword || '—'}</p>
                  </div>

                  <div className="rounded border bg-slate-50 p-3">
                    <p className="mb-1 font-semibold text-slate-700">Message</p>
                    <pre className="whitespace-pre-wrap break-words text-slate-700">{entry.message || 'No message body'}</pre>
                  </div>

                  <div className="rounded border border-slate-200 bg-slate-50/50 p-3 text-slate-500">
                    <p className="mb-1 font-semibold text-slate-600">Provider payload / technical details</p>
                    <pre className="whitespace-pre-wrap break-words">{formatPayload(entry.provider_status_payload || entry.payload || entry.raw_payload || '—')}</pre>
                  </div>
                </div>
              )})}</div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="broadcasts">
          <Card><CardHeader><CardTitle className="text-base">Broadcasts / Scheduled Messages</CardTitle></CardHeader><CardContent className="space-y-4">
            <Textarea rows={4} placeholder="General informational SMS message" value={broadcastForm.message} onChange={(e) => setBroadcastForm((prev) => ({ ...prev, message: e.target.value }))} />
            <div className="grid md:grid-cols-3 gap-3">
              <label className="flex items-center justify-between rounded border p-3 text-sm">Drivers <Switch checked={broadcastForm.include_drivers} onCheckedChange={(checked) => setBroadcastForm((prev) => ({ ...prev, include_drivers: checked }))} /></label>
              <label className="flex items-center justify-between rounded border p-3 text-sm">Company Owners <Switch checked={broadcastForm.include_owners} onCheckedChange={(checked) => setBroadcastForm((prev) => ({ ...prev, include_owners: checked }))} /></label>
              <label className="flex items-center justify-between rounded border p-3 text-sm">Admins <Switch checked={broadcastForm.include_admins} onCheckedChange={(checked) => setBroadcastForm((prev) => ({ ...prev, include_admins: checked }))} /></label>
            </div>
            <div className="grid md:grid-cols-3 gap-3 items-end">
              <div><Label>Send mode</Label><Select value={broadcastForm.send_mode} onValueChange={(value) => setBroadcastForm((prev) => ({ ...prev, send_mode: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="now">Send now</SelectItem><SelectItem value="scheduled">Schedule</SelectItem></SelectContent></Select></div>
              <div><Label>Scheduled date/time</Label><Input type="datetime-local" value={broadcastForm.scheduled_at} disabled={broadcastForm.send_mode !== 'scheduled'} onChange={(e) => setBroadcastForm((prev) => ({ ...prev, scheduled_at: e.target.value }))} /></div>
              <Button onClick={() => broadcastMutation.mutate()} disabled={broadcastMutation.isPending}>{broadcastMutation.isPending ? 'Processing...' : (broadcastForm.send_mode === 'scheduled' ? 'Save Scheduled' : 'Send Broadcast')}</Button>
            </div>
            <p className="text-xs text-slate-500">Scheduled items are persisted with scheduled status; background execution still requires backend scheduler wiring.</p>
            <div className="space-y-2">
              {broadcasts.length === 0 ? <p className="text-sm text-slate-500">No broadcasts created yet.</p> : broadcasts.map((b) => (
                <div key={b.key} className="rounded border p-3 text-xs">
                  <p className="font-medium">{b.status || 'unknown'} • recipients: {b.recipient_count || 0}</p>
                  <p>{b.message}</p>
                  <p className="text-slate-500">Mode: {b.send_mode} {b.scheduled_at ? `• scheduled: ${b.scheduled_at}` : ''}</p>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
