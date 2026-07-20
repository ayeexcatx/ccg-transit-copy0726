import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, addWeeks, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isBefore, startOfDay } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/components/session/SessionContext';
import {
  createAvailabilityRequestNotifications,
  createOwnerAvailabilityUpdatedAdminNotification,
  getLatestAvailabilityUpdateMs,
  getLatestOutstandingAvailabilityRequest } from
'@/components/notifications/availabilityRequestNotifications';
import {
  VIEW_MODES,
  STATUS_AVAILABLE,
  STATUS_UNAVAILABLE,
  getOperationalShifts,
  getStatusClass,
  normalizeCount,
  resolveAvailabilityForCompanyShift,
  toDateKey } from
'./availabilityRules';

const WEEKDAY_SHORT_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function AvailabilityManager({ companyId, canSelectCompany = false }) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('week');
  const [activeDate, setActiveDate] = useState(new Date());
  const [overrideEditingDate, setOverrideEditingDate] = useState(null);
  const [dateOverrideForm, setDateOverrideForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [adminCompanyId, setAdminCompanyId] = useState('');
  const [requestFeedback, setRequestFeedback] = useState('');
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestCompanyIds, setRequestCompanyIds] = useState([]);
  const [requestAlsoSendSms, setRequestAlsoSendSms] = useState(false);
  const [pastDateAlertOpen, setPastDateAlertOpen] = useState(false);
  const [blockedPastDate, setBlockedPastDate] = useState(null);

  const selectedCompanyId = canSelectCompany ? adminCompanyId : companyId;
  const todayStart = startOfDay(new Date());
  const isPastDate = (date) => isBefore(startOfDay(date), todayStart);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
    enabled: canSelectCompany
  });
  const selectedCompany = useMemo(
    () => companies.find((company) => String(company.id) === String(selectedCompanyId)) || null,
    [companies, selectedCompanyId]
  );

  useEffect(() => {
    setRequestFeedback('');
  }, [selectedCompanyId]);

  const sortedCompanies = useMemo(() => [...companies].sort((a, b) =>
  String(a?.name || a?.id || '').localeCompare(String(b?.name || b?.id || ''), undefined, { sensitivity: 'base' })
  ), [companies]);

  const { data: defaults = [] } = useQuery({
    queryKey: ['company-availability-defaults', selectedCompanyId],
    queryFn: () => base44.entities.CompanyAvailabilityDefault.filter({ company_id: selectedCompanyId }, '-created_date', 200),
    enabled: !!selectedCompanyId
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ['company-availability-overrides', selectedCompanyId],
    queryFn: () => base44.entities.CompanyAvailabilityOverride.filter({ company_id: selectedCompanyId }, '-created_date', 500),
    enabled: !!selectedCompanyId
  });

  const canonicalOverrideMap = useMemo(() => {
    const map = new Map();

    overrides.forEach((override) => {
      const key = `${selectedCompanyId}-${override.date}-${override.shift}`;
      if (!map.has(key)) {
        map.set(key, override);
      }
    });

    return map;
  }, [overrides, selectedCompanyId]);

  const upsertOverrideMutation = useMutation({
    mutationFn: async (payload) => {
      const matches = await base44.entities.CompanyAvailabilityOverride.filter(
        { company_id: payload.company_id, date: payload.date, shift: payload.shift },
        '-created_date',
        20
      );
      const [canonical, ...duplicates] = matches || [];
      if (canonical?.id) {
        const updated = await base44.entities.CompanyAvailabilityOverride.update(canonical.id, payload);
        await Promise.all(
          duplicates
            .map((item) => item?.id)
            .filter(Boolean)
            .map((id) => base44.entities.CompanyAvailabilityOverride.delete(id))
        );
        return updated;
      }

      return base44.entities.CompanyAvailabilityOverride.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-availability-overrides', selectedCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['availability-summary-overrides'] });
    }
  });

  const clearOverrideMutation = useMutation({
    mutationFn: async ({ date, shift }) => {
      const matches = await base44.entities.CompanyAvailabilityOverride.filter(
        { company_id: selectedCompanyId, date, shift },
        '-created_date',
        20
      );
      await Promise.all(
        (matches || [])
          .map((item) => item?.id)
          .filter(Boolean)
          .map((id) => base44.entities.CompanyAvailabilityOverride.delete(id))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-availability-overrides', selectedCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['availability-summary-overrides'] });
    }
  });


  const requestAvailabilityMutation = useMutation({
    mutationFn: async ({ companyIds, sendSms }) => {
      const uniqueCompanyIds = [...new Set((companyIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
      if (!uniqueCompanyIds.length) throw new Error('Select at least one company.');
      const requestedByLabel = 'CCG Admin';
      const results = await Promise.allSettled(uniqueCompanyIds.map(async (companyId) => {
        const company = sortedCompanies.find((entry) => String(entry.id) === companyId);
        const result = await createAvailabilityRequestNotifications({
          companyId,
          companyName: company?.name,
          requestedByLabel,
          sendSms: sendSms === true
        });
        return {
          companyId,
          companyName: result.companyName || company?.name || companyId,
          ownerCount: result.ownerCount || 0
        };
      }));
      const successes = [];
      const failures = [];

      results.forEach((result, index) => {
        const companyId = uniqueCompanyIds[index];
        const company = sortedCompanies.find((entry) => String(entry.id) === companyId);
        const fallbackCompanyName = company?.name || companyId;

        if (result.status === 'fulfilled') {
          successes.push(result.value);
          return;
        }

        failures.push({
          companyId,
          companyName: fallbackCompanyName,
          reason: result.reason?.message || 'Request failed'
        });
      });

      return { successes, failures, targetedCount: uniqueCompanyIds.length };
    },
    onSuccess: ({ successes, failures, targetedCount }) => {
      const successfulResults = successes.filter((result) => result.ownerCount > 0);
      const noOwnerResults = successes.filter((result) => result.ownerCount <= 0);
      const successCount = successfulResults.length;
      const totalOwners = successfulResults.reduce((total, result) => total + (result.ownerCount || 0), 0);
      const failedCompanyIds = [...new Set([...noOwnerResults.map((result) => result.companyId), ...failures.map((result) => result.companyId)])];
      const failureCount = failedCompanyIds.length;

      if (!successCount) {
        setRequestFeedback('');
        if (failureCount) {
          setRequestCompanyIds(failedCompanyIds);
          toast.error(`0 companies requested successfully. ${failureCount} compan${failureCount === 1 ? 'y' : 'ies'} failed.`);
          return;
        }
        toast.error('No active company owner access code found for selected companies.');
        return;
      }

      const feedbackParts = [`${successCount} compan${successCount === 1 ? 'y' : 'ies'} requested successfully`];
      if (failureCount) feedbackParts.push(`${failureCount} failed`);
      setRequestFeedback(feedbackParts.join(' • ') + '.');

      if (failureCount) {
        toast.warning(`Availability requests sent to ${totalOwners} owner${totalOwners === 1 ? '' : 's'}. ${successCount}/${targetedCount} companies succeeded, ${failureCount} failed.`);
        setRequestCompanyIds(failedCompanyIds);
      } else {
        toast.success(`Availability request sent to ${totalOwners} owner${totalOwners === 1 ? '' : 's'} across ${successCount}/${targetedCount} selected compan${targetedCount === 1 ? 'y' : 'ies'}.`);
        setRequestModalOpen(false);
        setRequestCompanyIds([]);
        setRequestAlsoSendSms(false);
      }
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      setRequestFeedback('');
      toast.error(error?.message || 'Failed to send availability request.');
    }
  });

  const toggleRequestCompanyId = (companyId, checked) => {
    const normalizedId = String(companyId || '');
    setRequestCompanyIds((prev) => {
      if (checked) return [...new Set([...prev, normalizedId])];
      return prev.filter((id) => id !== normalizedId);
    });
  };

  const selectAllRequestCompanies = () => {
    setRequestCompanyIds(sortedCompanies.map((company) => String(company.id)));
  };

  const clearAllRequestCompanies = () => {
    setRequestCompanyIds([]);
  };

  const submitAvailabilityRequests = () => {
    requestAvailabilityMutation.mutate({
      companyIds: requestCompanyIds,
      sendSms: requestAlsoSendSms
    });
  };

  const maybeNotifyAdminAvailabilityUpdated = async () => {
    if (canSelectCompany || !selectedCompanyId || !session?.id) return;

    const latestAvailabilityUpdateMs = getLatestAvailabilityUpdateMs({ defaults, overrides });
    const sourceRequest = await getLatestOutstandingAvailabilityRequest({
      companyId: selectedCompanyId,
      ownerAccessCodeId: session.id,
      latestAvailabilityUpdateMs
    });

    if (!sourceRequest?.id) return;

    await createOwnerAvailabilityUpdatedAdminNotification({
      companyId: selectedCompanyId,
      companyName: selectedCompany?.name,
      ownerName: session?.label || session?.name || 'Company owner',
      sourceRequestNotificationId: sourceRequest.id
    });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const defaultMap = useMemo(() => {
    const map = new Map();
    defaults.forEach((d) => map.set(`${selectedCompanyId}-${d.weekday}-${d.shift}`, d));
    return map;
  }, [defaults, selectedCompanyId]);

  const overrideMap = canonicalOverrideMap;

  const resolveAvailability = (date, shift) => {
    if (!selectedCompanyId) return { status: STATUS_AVAILABLE, available_truck_count: null };
    return resolveAvailabilityForCompanyShift({
      companyId: selectedCompanyId,
      date,
      shift,
      defaultMap,
      overrideMap
    });
  };

  const getDateEditInitialState = (date) => {
    const operationalShifts = getOperationalShifts(date.getDay());
    const createShiftState = (shift) => {
      const availability = resolveAvailability(date, shift);
      return {
        status: availability.status || STATUS_AVAILABLE,
        count: availability.available_truck_count ? String(availability.available_truck_count) : '',
        operational: operationalShifts.includes(shift)
      };
    };

    return {
      Day: createShiftState('Day'),
      Night: createShiftState('Night')
    };
  };

  const openOverrideEditorForDate = (date) => {
    if (isPastDate(date)) {
      setBlockedPastDate(date);
      setPastDateAlertOpen(true);
      return;
    }

    setOverrideEditingDate(date);
    setDateOverrideForm(getDateEditInitialState(date));
    setFormError('');
  };

  const saveDateOverride = async () => {
    if (!overrideEditingDate || !selectedCompanyId || !dateOverrideForm) return;
    if (isPastDate(overrideEditingDate)) {
      setBlockedPastDate(overrideEditingDate);
      setPastDateAlertOpen(true);
      return;
    }

    for (const shift of ['Day', 'Night']) {
      const shiftState = dateOverrideForm[shift];
      if (!shiftState?.operational) continue;
      const count = shiftState.status === STATUS_AVAILABLE ? normalizeCount(shiftState.count) : null;
      if (shiftState.status === STATUS_AVAILABLE && count === null) {
        setFormError(`${shift} shift available truck count must be a whole number greater than 0.`);
        return;
      }
    }

    const savePromises = ['Day', 'Night'].map(async (shift) => {
      const shiftState = dateOverrideForm[shift];
      if (!shiftState?.operational) return;

      const count = shiftState.status === STATUS_AVAILABLE ? normalizeCount(shiftState.count) : null;
      await upsertOverrideMutation.mutateAsync({
        company_id: selectedCompanyId,
        status: shiftState.status,
        available_truck_count: shiftState.status === STATUS_UNAVAILABLE ? null : count,
        date: toDateKey(overrideEditingDate),
        shift
      });
    });

    await Promise.all(savePromises);
    await maybeNotifyAdminAvailabilityUpdated();
    setOverrideEditingDate(null);
    setDateOverrideForm(null);
  };

  const copyAvailabilityToRestOfWeek = async () => {
    if (!overrideEditingDate || !selectedCompanyId || !dateOverrideForm) return;
    if (!window.confirm('Copy this availability to the rest of this week?')) return;

    for (const shift of ['Day', 'Night']) {
      const shiftState = dateOverrideForm[shift];
      if (!shiftState?.operational) continue;
      const count = shiftState.status === STATUS_AVAILABLE ? normalizeCount(shiftState.count) : null;
      if (shiftState.status === STATUS_AVAILABLE && count === null) {
        setFormError(`${shift} shift available truck count must be a whole number greater than 0.`);
        return;
      }
    }

    const weekEnd = endOfWeek(overrideEditingDate, { weekStartsOn: 0 });
    const targetDates = eachDayOfInterval({
      start: addDays(overrideEditingDate, 1),
      end: weekEnd
    }).filter((date) => !isPastDate(date));

    const savePromises = targetDates.flatMap((date) =>
      ['Day', 'Night'].map(async (shift) => {
        const sourceShiftState = dateOverrideForm[shift];
        if (!sourceShiftState?.operational) return;
        if (!getOperationalShifts(date.getDay()).includes(shift)) return;

        const count = sourceShiftState.status === STATUS_AVAILABLE ? normalizeCount(sourceShiftState.count) : null;
        await upsertOverrideMutation.mutateAsync({
          company_id: selectedCompanyId,
          status: sourceShiftState.status,
          available_truck_count: sourceShiftState.status === STATUS_UNAVAILABLE ? null : count,
          date: toDateKey(date),
          shift
        });
      })
    );

    await Promise.all(savePromises);
    await maybeNotifyAdminAvailabilityUpdated();
    setOverrideEditingDate(null);
    setDateOverrideForm(null);
    setFormError('');
  };

  const clearDateOverrides = async (date) => {
    if (isPastDate(date)) {
      setBlockedPastDate(date);
      setPastDateAlertOpen(true);
      return;
    }

    await Promise.all(
      ['Day', 'Night'].map((shift) => clearOverrideMutation.mutateAsync({ date: toDateKey(date), shift }))
    );
    setOverrideEditingDate(null);
    setDateOverrideForm(null);
  };

  const updateOverrideShiftField = (shift, field, value) => {
    setDateOverrideForm((prev) => ({
      ...prev,
      [shift]: {
        ...prev[shift],
        [field]: value,
        ...(field === 'status' && value === STATUS_UNAVAILABLE ? { count: '' } : {})
      }
    }));
  };

  const getCompactShiftDisplay = (date, shift) => {
    if (!getOperationalShifts(date.getDay()).includes(shift)) {
      return { label: 'N/A', className: 'text-slate-400' };
    }

    const availability = resolveAvailability(date, shift);
    if (availability.status === STATUS_UNAVAILABLE) {
      return { label: 'None', className: getStatusClass(availability.status) };
    }

    if (availability.available_truck_count) {
      return { label: String(availability.available_truck_count), className: getStatusClass(availability.status) };
    }

    return { label: '—', className: getStatusClass(availability.status) };
  };

  const shiftActiveDate = (direction) => {
    if (viewMode === 'day') return setActiveDate((prev) => addDays(prev, direction));
    if (viewMode === 'week') return setActiveDate((prev) => addWeeks(prev, direction));
    return setActiveDate((prev) => addMonths(prev, direction));
  };

  const dateRangeLabel = useMemo(() => {
    if (viewMode === 'day') return format(activeDate, 'EEE, MMM d, yyyy');
    if (viewMode === 'week') {
      const start = startOfWeek(activeDate, { weekStartsOn: 0 });
      const end = endOfWeek(activeDate, { weekStartsOn: 0 });
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    return format(activeDate, 'MMMM yyyy');
  }, [activeDate, viewMode]);

  const visibleDates = useMemo(() => {
    if (viewMode === 'day') {
      return eachDayOfInterval({ start: addDays(activeDate, -1), end: addDays(activeDate, 1) });
    }

    if (viewMode === 'week') {
      const start = startOfWeek(activeDate, { weekStartsOn: 0 });
      const end = endOfWeek(activeDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    }

    const monthStart = startOfMonth(activeDate);
    const monthEnd = endOfMonth(activeDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [activeDate, viewMode]);

  const renderCompactCalendarSection = (dates, keyPrefix, outsideMonth = false) =>
  <div className="space-y-1" key={keyPrefix}>
      <div className={`grid gap-1 ${viewMode === 'day' ? 'grid-cols-[16px_repeat(3,minmax(0,1fr))]' : 'grid-cols-[16px_repeat(7,minmax(0,1fr))]'}`}>
        <div />
        {dates.map((date) =>
      <p key={`${keyPrefix}-head-${toDateKey(date)}`} className="text-[10px] text-center font-semibold text-slate-500">
            {WEEKDAY_SHORT_LABELS[date.getDay()]}
          </p>
      )}
      </div>
      <div className={`grid gap-1 ${viewMode === 'day' ? 'grid-cols-[16px_repeat(3,minmax(0,1fr))]' : 'grid-cols-[16px_repeat(7,minmax(0,1fr))]'}`}>
        <div />
        {dates.map((date) =>
      <p
        key={`${keyPrefix}-date-${toDateKey(date)}`}
        className={`text-[10px] text-center font-semibold ${outsideMonth && !isSameMonth(date, activeDate) ? 'text-slate-400' : 'text-slate-700'}`}>

            {format(date, 'd')}
          </p>
      )}
      </div>

      {['Day', 'Night'].map((shift) =>
    <div key={`${keyPrefix}-${shift}`} className={`grid gap-1 ${viewMode === 'day' ? 'grid-cols-[16px_repeat(3,minmax(0,1fr))]' : 'grid-cols-[16px_repeat(7,minmax(0,1fr))]'}`}>
          <p className="text-[10px] font-semibold text-slate-500 self-center">{shift === 'Day' ? 'D' : 'N'}</p>
          {dates.map((date) => {
        const shiftDisplay = getCompactShiftDisplay(date, shift);
        const faded = outsideMonth && !isSameMonth(date, activeDate);
        return (
          <button
            key={`${keyPrefix}-${shift}-${toDateKey(date)}`}
            type="button"
            onClick={() => openOverrideEditorForDate(date)}
            className={`rounded border p-1 text-[10px] font-semibold ${
            isPastDate(date) ?
            'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' :
            `${faded ? 'bg-slate-50/70 border-slate-200' : 'bg-white border-slate-300'} hover:bg-slate-50`}`}>

                <span className={shiftDisplay.className}>{shiftDisplay.label}</span>
              </button>);

      })}
        </div>
    )}
    </div>;


  const renderCompactCalendarView = () => {
    if (viewMode === 'day') return renderCompactCalendarSection(visibleDates, 'day');
    if (viewMode === 'week') return renderCompactCalendarSection(visibleDates, 'week');

    return (
      <div className="space-y-2">
        {Array.from({ length: Math.ceil(visibleDates.length / 7) }).map((_, weekIndex) => {
          const start = weekIndex * 7;
          const weekDates = visibleDates.slice(start, start + 7);
          return renderCompactCalendarSection(weekDates, `month-${weekIndex}`, true);
        })}
      </div>);

  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Calendar</h2>
          <p className="text-slate-500 text-sm font-medium text-left">Select how many trucks you have available for each shift.</p> 
          <p className="text-red-600 text-sm font-bold">The correct way to fill this out is to select the date, then enter the number of trucks you have available for that shift.</p>
          <p className="text-red-600 text-sm font-bold italic">Owner-operators: You must still enter 1 for each shift you are available.</p>
        </div>
        <div className="flex items-center gap-2">
          {VIEW_MODES.map((mode) =>
          <Button key={mode} variant={viewMode === mode ? 'default' : 'outline'} size="sm" onClick={() => setViewMode(mode)}>
              {mode[0].toUpperCase() + mode.slice(1)}
            </Button>
          )}
        </div>
      </div>
      {canSelectCompany &&
      <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Company</p>
              <Select value={selectedCompanyId || ''} onValueChange={setAdminCompanyId}>
                <SelectTrigger className="w-full md:w-[360px]">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {sortedCompanies.map((company) =>
                <SelectItem key={company.id} value={company.id}>{company.name || company.id}</SelectItem>
                )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
              onClick={() => setRequestModalOpen(true)}
              disabled={requestAvailabilityMutation.isPending || !sortedCompanies.length}>
              
                Request Availability
              </Button>
            </div>
            {requestFeedback &&
          <p className="text-xs text-emerald-700 text-right">{requestFeedback}</p>
          }
          </CardContent>
        </Card>
      }

      {!selectedCompanyId ?
      <Card><CardContent className="p-6 text-sm text-slate-500">Select a company to view availability.</CardContent></Card> :

      <>
          <Card data-tour="availability-controls">
            <CardContent className="p-3 space-y-3">
              <div className="text-center text-xs font-medium text-slate-600">{dateRangeLabel}</div>
              <div className="grid grid-cols-3 items-center">
                <div className="justify-self-start">
                  <Button size="icon" variant="outline" onClick={() => shiftActiveDate(-1)} aria-label="Previous period">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                <div className="justify-self-center">
                  <Button size="sm" variant="outline" onClick={() => setActiveDate(new Date())}>Today</Button>
                </div>
                <div className="justify-self-end">
                  <Button size="icon" variant="outline" onClick={() => shiftActiveDate(1)} aria-label="Next period">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">{renderCompactCalendarView()}</div>
            </CardContent>
          </Card>

        </>
      }

      <Dialog
        open={requestModalOpen}
        onOpenChange={(open) => {
          setRequestModalOpen(open);
          if (!open && !requestAvailabilityMutation.isPending) {
            setRequestCompanyIds([]);
            setRequestAlsoSendSms(false);
          }
        }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Availability</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-600">Select one or more companies.</p>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={selectAllRequestCompanies}>Select All</Button>
                <Button type="button" size="sm" variant="ghost" onClick={clearAllRequestCompanies}>Clear All</Button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto rounded border border-slate-200 bg-white">
              {sortedCompanies.map((company) => {
                const checked = requestCompanyIds.includes(String(company.id));
                return (
                  <label
                    key={`request-${company.id}`}
                    className={`flex cursor-pointer items-center gap-3 border-b px-3 py-2 transition-colors last:border-b-0 ${
                    checked ?
                    'border-blue-200 bg-blue-50/80' :
                    'border-slate-100 hover:bg-slate-50'}`}>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) => toggleRequestCompanyId(company.id, nextChecked === true)}
                    />
                    <span className="text-sm text-slate-700">{company.name || company.id}</span>
                  </label>);
              })}
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2">
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox checked={requestAlsoSendSms} onCheckedChange={(checked) => setRequestAlsoSendSms(checked === true)} />
                <div>
                  <span className="text-sm font-medium text-amber-900">Also send SMS</span>
                  <p className="text-xs text-amber-800/90">Send a text reminder along with in-app requests.</p>
                </div>
              </label>
            </div>
            <div className="flex justify-end border-t border-slate-200 pt-3">
              <Button
                type="button"
                onClick={submitAvailabilityRequests}
                disabled={!requestCompanyIds.length || requestAvailabilityMutation.isPending}>
                {requestAvailabilityMutation.isPending ? 'Sending…' : 'Send Requests'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pastDateAlertOpen}
        onOpenChange={setPastDateAlertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Date unavailable for editing</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            This date has already passed. Please select a future date to edit or update.
          </p>
          {blockedPastDate &&
          <p className="text-xs text-slate-500">{format(blockedPastDate, 'EEE, MMM d, yyyy')}</p>
          }
          <div className="flex justify-end">
            <Button onClick={() => setPastDateAlertOpen(false)}>OK</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!overrideEditingDate}
        onOpenChange={(open) => {
          if (!open) {
            setOverrideEditingDate(null);
            setDateOverrideForm(null);
            setFormError('');
          }
        }}>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Availability</DialogTitle>
          </DialogHeader>

          {overrideEditingDate && dateOverrideForm &&
          <div className="space-y-4">
              <p className="text-sm text-slate-600">{format(overrideEditingDate, 'EEE, MMM d, yyyy')}</p>

              {['Day', 'Night'].map((shift) => {
              const shiftState = dateOverrideForm[shift];
              return (
                <div key={shift} className="space-y-2 rounded border border-slate-200 p-3">
                    <div className={`-m-3 mb-2 rounded-t px-3 py-2 ${shift === 'Day' ? 'bg-amber-50/70 border-b border-amber-100' : 'bg-indigo-50/70 border-b border-indigo-100'}`}>
                      <p className={`text-sm font-semibold ${shift === 'Day' ? 'text-amber-900' : 'text-indigo-900'}`}>{shift} Shift</p>
                    </div>
                    {!shiftState.operational ?
                  <p className="text-xs text-slate-400">N/A (non-operational for this date)</p> :

                  <>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Status</p>
                          <Select
                        value={shiftState.status}
                        onValueChange={(value) => updateOverrideShiftField(shift, 'status', value)}>

                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={STATUS_AVAILABLE}>Available</SelectItem>
                              <SelectItem value={STATUS_UNAVAILABLE}>Unavailable</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {shiftState.status === STATUS_AVAILABLE &&
                    <div>
                            <p className="text-xs text-slate-500 mb-1">Number of trucks available</p>
                            <Input
                        type="number"
                        min="1"
                        value={shiftState.count}
                        onChange={(e) => updateOverrideShiftField(shift, 'count', e.target.value)}
                        placeholder="Enter the number of trucks you have available for this shift" />

                          </div>
                    }
                      </>
                  }
                  </div>);

            })}

              {formError && <p className="text-xs text-red-600">{formError}</p>}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => {setOverrideEditingDate(null);setDateOverrideForm(null);setFormError('');}}>Cancel</Button>
                <Button variant="outline" onClick={copyAvailabilityToRestOfWeek}>Copy to rest of this week</Button>
                <Button onClick={saveDateOverride}>Save</Button>
              </div>
            </div>
          }
        </DialogContent>
      </Dialog>

    </div>);

}
