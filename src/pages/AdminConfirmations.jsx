import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildOpenConfirmationRows } from '@/components/notifications/openConfirmations';
import { statusBadgeColors } from '@/components/portal/statusConfig';
import { useAdminDispatchDrawer } from '@/components/portal/AdminDispatchDrawerContext';

const EASTERN_TIMEZONE = 'America/New_York';
const normalizeId = (value) => String(value ?? '').trim();

function parseUtcTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const parsedNumber = new Date(value);
    return Number.isNaN(parsedNumber.getTime()) ? null : parsedNumber;
  }

  if (typeof value !== 'string') return null;

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmedValue);
  const normalizedValue = hasTimezone
    ? trimmedValue
    : `${trimmedValue.replace(' ', 'T')}Z`;

  const parsed = new Date(normalizedValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatNotificationDateTime(value) {
  const parsed = parseUtcTimestamp(value);
  if (!parsed) return '—';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(parsed);
}

function formatPendingAge(value) {
  const parsed = parseUtcTimestamp(value);
  if (!parsed) return '—';
  return formatDistanceToNowStrict(parsed, { addSuffix: true });
}

function formatStandardDateTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return format(parsed, 'MMM d, yyyy h:mm a');
}

function formatDispatchDate(value) {
  if (!value) return '—';
  if (typeof value === 'string') {
    const dateOnlyMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return `${month}-${day}-${year}`;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, 'MM-dd-yyyy');
}

function MobileField({ label, value, mono = false }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-sm text-slate-700 break-words ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}

function OpenConfirmationMobileCard({ row, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 break-words">{row.companyName}</p>
        </div>
        <Badge className={`${statusBadgeColors[row.status] || 'bg-slate-100 text-slate-700 border-slate-200'} border shrink-0`}>
          {row.status || '—'}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <MobileField label="Date" value={formatDispatchDate(row.dispatchDate)} />
        <MobileField label="Truck" value={row.truckNumber} mono />
        <MobileField label="Client" value={row.clientName} />
        <MobileField label="Job Number" value={row.jobNumber} />
        <MobileField label="Reference" value={row.referenceTag} />
        <MobileField label="Notification" value={formatNotificationDateTime(row.createdAt)} />
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <MobileField label="Pending" value={formatPendingAge(row.createdAt)} />
      </div>
    </button>
  );
}

function HistoryMobileCard({ row, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold text-slate-900 break-words">{row.companyName}</p>
        <Badge className={`${statusBadgeColors[row.confirmationType] || 'bg-slate-100 text-slate-700 border-slate-200'} border shrink-0`}>
          {row.confirmationType || '—'}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <MobileField label="Date" value={formatDispatchDate(row.dispatchDate)} />
        <MobileField label="Truck" value={row.truckNumber} mono />
        <MobileField label="Client" value={row.clientName} />
        <MobileField label="Job Number" value={row.jobNumber} />
        <MobileField label="Reference" value={row.referenceTag} />
        <MobileField label="Confirmed By" value={row.confirmedBy} />
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <MobileField label="Confirmed At" value={formatStandardDateTime(row.confirmedAt)} />
      </div>
    </button>
  );
}

function DriverDispatchLogMobileCard({ row, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold text-slate-900 break-words">{row.driverName || 'Unknown Driver'}</p>
        <Badge variant="secondary" className="shrink-0">{row.eventType || '—'}</Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <MobileField label="Seen At" value={formatNotificationDateTime(row.seenAt)} />
        <MobileField label="Dispatch Date" value={formatDispatchDate(row.dispatchDate)} />
        <MobileField label="Company" value={row.companyName} />
        <MobileField label="Status Seen" value={row.dispatchStatus} />
        <MobileField label="Shift" value={row.shiftLabel} />
        <MobileField label="Truck" value={row.trucksDisplay} mono />
        <MobileField label="Client" value={row.clientName} />
        <MobileField label="Job Number" value={row.jobNumber} />
        <MobileField label="Tag / Ref" value={row.referenceTag} />
      </div>
    </button>
  );
}

export default function AdminConfirmations() {
  const [activeTab, setActiveTab] = useState('confirmations');
  const { openAdminDispatchDrawer } = useAdminDispatchDrawer();

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications-admin-confirmations'],
    queryFn: () => base44.entities.Notification.list('-created_date', 1000),
  });

  const { data: confirmations = [], isLoading: confirmationsLoading } = useQuery({
    queryKey: ['confirmations-admin-review'],
    queryFn: () => base44.entities.Confirmation.list('-confirmed_at', 1000),
  });

  const { data: dispatches = [], isLoading: dispatchesLoading } = useQuery({
    queryKey: ['dispatches-admin-confirmations'],
    queryFn: () => base44.entities.Dispatch.list('-date', 1000),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: accessCodes = [] } = useQuery({
    queryKey: ['access-codes'],
    queryFn: () => base44.entities.AccessCode.list(),
  });
  
  const { data: driverDispatchLogs = [], isLoading: driverDispatchLogsLoading } = useQuery({
    queryKey: ['driver-dispatch-log-admin'],
    queryFn: () => base44.entities.DriverDispatchLog.list('-seen_at', 1000),
  });

  const dispatchById = useMemo(
    () => new Map(dispatches.map((dispatch) => [normalizeId(dispatch.id), dispatch])),
    [dispatches]
  );

  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies]
  );

  const accessCodeById = useMemo(
    () => new Map(accessCodes.map((accessCode) => [accessCode.id, accessCode])),
    [accessCodes]
  );

  const validDispatchIds = useMemo(
    () => new Set(dispatches.map((dispatch) => normalizeId(dispatch.id))),
    [dispatches]
  );

  const filteredNotifications = useMemo(() => notifications.filter((notification) => {
    if (!notification.related_dispatch_id) return true;
    return validDispatchIds.has(normalizeId(notification.related_dispatch_id));
  }), [notifications, validDispatchIds]);

  const filteredConfirmations = useMemo(() => confirmations.filter((confirmation) =>
    validDispatchIds.has(normalizeId(confirmation.dispatch_id))
  ), [confirmations, validDispatchIds]);

  const openRows = useMemo(() => buildOpenConfirmationRows({
    notifications: filteredNotifications,
    confirmations: filteredConfirmations,
    dispatches,
    companies,
    accessCodes,
  }), [filteredNotifications, filteredConfirmations, dispatches, companies, accessCodes]);

  const historyRows = useMemo(() => filteredConfirmations
    .map((confirmation) => {
      const dispatch = dispatchById.get(normalizeId(confirmation.dispatch_id));
      if (!dispatch) return null;

      const accessCodeId = confirmation.access_code_id || confirmation.confirmed_by_access_code_id;
      const confirmer = accessCodeById.get(accessCodeId);

      return {
        id: confirmation.id,
        dispatchId: dispatch.id,
        companyName: companyById.get(dispatch.company_id)?.name || 'Unknown Company',
        dispatchDate: dispatch.date,
        truckNumber: confirmation.truck_number,
        clientName: dispatch.client_name || '',
        jobNumber: dispatch.job_number || '',
        referenceTag: dispatch.reference_tag || '',
        confirmationType: confirmation.confirmation_type,
        confirmedAt: confirmation.confirmed_at,
        confirmedBy: confirmer?.label || confirmer?.code || '—',
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.confirmedAt || 0).getTime() - new Date(a.confirmedAt || 0).getTime()),
  [filteredConfirmations, dispatchById, companyById, accessCodeById]);

  const isLoading = notificationsLoading || confirmationsLoading || dispatchesLoading;
  
  const driverDispatchLogRows = useMemo(() => (driverDispatchLogs || [])
    .map((entry) => ({
      id: entry.id,
      dispatchId: entry.dispatch_id,
      seenAt: entry.seen_at || entry.created_date || null,
      driverName: entry.driver_name_snapshot || 'Unknown Driver',
      companyName: entry.company_name_snapshot || companyById.get(entry.company_id)?.name || 'Unknown Company',
      dispatchDate: entry.dispatch_date_snapshot || null,
      dispatchStatus: entry.dispatch_status_snapshot || '—',
      shiftLabel: entry.shift_label_snapshot || '—',
      trucksDisplay: Array.isArray(entry.truck_numbers_snapshot) && entry.truck_numbers_snapshot.length
        ? entry.truck_numbers_snapshot.join(', ')
        : '—',
      clientName: entry.client_name_snapshot || '—',
      jobNumber: entry.job_number_snapshot || '—',
      referenceTag: entry.reference_tag_snapshot || '—',
      eventType: entry.event_type || 'driver_dispatch_seen',
    }))
    .sort((a, b) => new Date(b.seenAt || 0).getTime() - new Date(a.seenAt || 0).getTime()),
  [driverDispatchLogs, companyById]);

  const openDispatch = (dispatchId) => {
    if (!dispatchId) return;
    openAdminDispatchDrawer({ dispatchId });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Confirmations</h2>
        <p className="text-sm text-slate-500 mt-1">Review outstanding truck confirmations and recent confirmation history.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="confirmations">Confirmations</TabsTrigger>
          <TabsTrigger value="driver-dispatch-log">Driver Dispatch Log</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === 'confirmations' ? (
        <>
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Open Confirmations</h3>
                  <p className="text-xs text-slate-500">Outstanding truck confirmations derived from unresolved owner notifications.</p>
                </div>
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 self-start sm:self-auto">{openRows.length} open</Badge>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-700 rounded-full" />
                </div>
              ) : openRows.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No open confirmations.</p>
              ) : (
                <>
                  <div className="space-y-3 lg:hidden">
                    {openRows.map((row) => (
                      <OpenConfirmationMobileCard
                        key={row.id}
                        row={row}
                        onClick={() => openDispatch(row.dispatchId)}
                      />
                    ))}
                  </div>

                  <div className="hidden lg:block overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">Company</th>
                          <th className="text-left font-medium px-3 py-2">Dispatch Date</th>
                          <th className="text-left font-medium px-3 py-2">Type</th>
                          <th className="text-left font-medium px-3 py-2">Truck</th>
                          <th className="text-left font-medium px-3 py-2">Client</th>
                          <th className="text-left font-medium px-3 py-2">Job Number</th>
                          <th className="text-left font-medium px-3 py-2">Reference</th>
                          <th className="text-left font-medium px-3 py-2">Notification Time</th>
                          <th className="text-left font-medium px-3 py-2">Pending</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openRows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                            onClick={() => openDispatch(row.dispatchId)}
                          >
                            <td className="px-3 py-2">{row.companyName}</td>
                            <td className="px-3 py-2">{formatDispatchDate(row.dispatchDate)}</td>
                            <td className="px-3 py-2">
                              <Badge className={`${statusBadgeColors[row.status] || 'bg-slate-100 text-slate-700 border-slate-200'} border`}>
                                {row.status || '—'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 font-mono">{row.truckNumber}</td>
                            <td className="px-3 py-2">{row.clientName || '—'}</td>
                            <td className="px-3 py-2">{row.jobNumber || '—'}</td>
                            <td className="px-3 py-2">{row.referenceTag || '—'}</td>
                            <td className="px-3 py-2">{formatNotificationDateTime(row.createdAt)}</td>
                            <td className="px-3 py-2">{formatPendingAge(row.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Confirmation Log / History</h3>
                  <p className="text-xs text-slate-500">Completed confirmations from confirmation records.</p>
                </div>
                <Badge variant="secondary" className="self-start sm:self-auto">{historyRows.length} records</Badge>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-700 rounded-full" />
                </div>
              ) : historyRows.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No confirmation history found.</p>
              ) : (
                <>
                  <div className="space-y-3 lg:hidden">
                    {historyRows.map((row) => (
                      <HistoryMobileCard
                        key={row.id}
                        row={row}
                        onClick={() => openDispatch(row.dispatchId)}
                      />
                    ))}
                  </div>

                  <div className="hidden lg:block overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">Company</th>
                          <th className="text-left font-medium px-3 py-2">Dispatch Date</th>
                          <th className="text-left font-medium px-3 py-2">Truck</th>
                          <th className="text-left font-medium px-3 py-2">Client</th>
                          <th className="text-left font-medium px-3 py-2">Job Number</th>
                          <th className="text-left font-medium px-3 py-2">Reference</th>
                          <th className="text-left font-medium px-3 py-2">Type</th>
                          <th className="text-left font-medium px-3 py-2">Confirmed At</th>
                          <th className="text-left font-medium px-3 py-2">Confirmed By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                            onClick={() => openDispatch(row.dispatchId)}
                          >
                            <td className="px-3 py-2">{row.companyName}</td>
                            <td className="px-3 py-2">{formatDispatchDate(row.dispatchDate)}</td>
                            <td className="px-3 py-2 font-mono">{row.truckNumber || '—'}</td>
                            <td className="px-3 py-2">{row.clientName || '—'}</td>
                            <td className="px-3 py-2">{row.jobNumber || '—'}</td>
                            <td className="px-3 py-2">{row.referenceTag || '—'}</td>
                            <td className="px-3 py-2">
                              <Badge className={`${statusBadgeColors[row.confirmationType] || 'bg-slate-100 text-slate-700 border-slate-200'} border`}>
                                {row.confirmationType || '—'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">{row.confirmedAt ? format(new Date(row.confirmedAt), 'MMM d, yyyy h:mm a') : '—'}</td>
                            <td className="px-3 py-2">{row.confirmedBy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Driver Dispatch Log</h3>
                <p className="text-xs text-slate-500">Internal audit history for driver dispatch seen events.</p>
              </div>
              <Badge variant="secondary" className="self-start sm:self-auto">{driverDispatchLogRows.length} records</Badge>
            </div>

            {driverDispatchLogsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-700 rounded-full" />
              </div>
            ) : driverDispatchLogRows.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No driver dispatch seen records found.</p>
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {driverDispatchLogRows.map((row) => (
                    <DriverDispatchLogMobileCard
                      key={row.id}
                      row={row}
                      onClick={() => openDispatch(row.dispatchId)}
                    />
                  ))}
                </div>

                <div className="hidden lg:block overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Seen At</th>
                        <th className="text-left font-medium px-3 py-2">Driver</th>
                        <th className="text-left font-medium px-3 py-2">Company</th>
                        <th className="text-left font-medium px-3 py-2">Dispatch Date</th>
                        <th className="text-left font-medium px-3 py-2">Status Seen</th>
                        <th className="text-left font-medium px-3 py-2">Shift</th>
                        <th className="text-left font-medium px-3 py-2">Truck</th>
                        <th className="text-left font-medium px-3 py-2">Client</th>
                        <th className="text-left font-medium px-3 py-2">Job Number</th>
                        <th className="text-left font-medium px-3 py-2">Tag / Reference</th>
                        <th className="text-left font-medium px-3 py-2">Event Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverDispatchLogRows.map((row) => (
                        <tr
                          key={row.id}
                          className={`border-t border-slate-100 ${row.dispatchId ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                          onClick={() => openDispatch(row.dispatchId)}
                        >
                          <td className="px-3 py-2">{formatNotificationDateTime(row.seenAt)}</td>
                          <td className="px-3 py-2">{row.driverName || '—'}</td>
                          <td className="px-3 py-2">{row.companyName || '—'}</td>
                          <td className="px-3 py-2">{formatDispatchDate(row.dispatchDate)}</td>
                          <td className="px-3 py-2">{row.dispatchStatus || '—'}</td>
                          <td className="px-3 py-2">{row.shiftLabel || '—'}</td>
                          <td className="px-3 py-2 font-mono">{row.trucksDisplay}</td>
                          <td className="px-3 py-2">{row.clientName || '—'}</td>
                          <td className="px-3 py-2">{row.jobNumber || '—'}</td>
                          <td className="px-3 py-2">{row.referenceTag || '—'}</td>
                          <td className="px-3 py-2">{row.eventType || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
