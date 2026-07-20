import React, { useState, useEffect, useMemo } from 'react'; 
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Copy, Plus, Trash2 } from 'lucide-react';

const UPDATE_MESSAGE_MAX_LENGTH = 100;

export default function DispatchForm({ dispatch, dispatches = [], companies, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    company_id: '', date: '', shift_time: 'Day Shift', client_name: '', job_number: '', reference_tag: '',
    start_time: '', start_location: '', instructions: 'Deliver material to / from',
    notes: '', toll_status: '', trucks_assigned: [],
    status: 'Scheduled', additional_assignments: [],
    amendment_history: [], canceled_reason: '', truck_overrides: []
  });
  const [useStaggeredOverrides, setUseStaggeredOverrides] = useState(false);
  const [showUpdateNotifyChoice, setShowUpdateNotifyChoice] = useState(false);
  const [showUpdateMessagePrompt, setShowUpdateMessagePrompt] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [pendingFinalForm, setPendingFinalForm] = useState(null);
  const [showCopyPicker, setShowCopyPicker] = useState(false);
  const [showRequiredFieldsDialog, setShowRequiredFieldsDialog] = useState(false);
  const [requiredFieldsMessage, setRequiredFieldsMessage] = useState('');
  const [copySearch, setCopySearch] = useState('');
  const [copySourceSummary, setCopySourceSummary] = useState('');
  const [copyTargetAssignmentIndex, setCopyTargetAssignmentIndex] = useState(null);

  useEffect(() => {
    if (dispatch) {
      setForm({
        company_id: dispatch.company_id || '',
        date: dispatch.date || '',
        shift_time: dispatch.shift_time || 'Day Shift',
        client_name: dispatch.client_name || '',
        job_number: dispatch.job_number || '',
        reference_tag: dispatch.reference_tag || '',
        start_time: dispatch.start_time || '',
        start_location: dispatch.start_location || '',
        instructions: dispatch.instructions || 'Deliver material to / from',
        notes: dispatch.notes || '',
        toll_status: dispatch.toll_status || '',
        trucks_assigned: dispatch.trucks_assigned || [],
        status: dispatch.status || 'Scheduled',
        additional_assignments: dispatch.additional_assignments || [],
        amendment_history: dispatch.amendment_history || [],
        canceled_reason: dispatch.canceled_reason || '',
        truck_overrides: Array.isArray(dispatch.truck_overrides) ? dispatch.truck_overrides : []
      });
      setUseStaggeredOverrides(Array.isArray(dispatch.truck_overrides) && dispatch.truck_overrides.length > 0);
    }
  }, [dispatch]);

  const getLatestReferenceTagForJob = (jobNumber, skipDispatchId = dispatch?.id) => {
    const normalizedJob = String(jobNumber || '').trim().toLowerCase();
    if (!normalizedJob) return '';

    const sortedDispatches = [...(dispatches || [])].sort((a, b) => {
      const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateCompare !== 0) return dateCompare;
      return String(b.created_date || '').localeCompare(String(a.created_date || ''));
    });

    for (const candidate of sortedDispatches) {
      if (!candidate || (skipDispatchId && candidate.id === skipDispatchId)) continue;

      if (String(candidate.job_number || '').trim().toLowerCase() === normalizedJob) {
        const tag = String(candidate.reference_tag || '').trim();
        if (tag) return tag;
      }

      const additionalAssignments = Array.isArray(candidate.additional_assignments) ? candidate.additional_assignments : [];
      for (const assignment of additionalAssignments) {
        if (String(assignment?.job_number || '').trim().toLowerCase() !== normalizedJob) continue;
        const tag = String(assignment?.reference_tag || '').trim();
        if (tag) return tag;
      }
    }

    return '';
  };

  const activeCompaniesSorted = useMemo(() => {
    const rawCompanyNames = (companies || []).map((c) => c?.name);
    const sortedCompanies = [...(companies || [])]
      .filter((c) => c.status === 'active')
      .sort((a, b) => String(a?.name || '').trim().localeCompare(String(b?.name || '').trim(), undefined, { sensitivity: 'base' }));

    console.log('Raw companies (incoming order):', rawCompanyNames);
    console.log('Sorted companies (active + sorted):', sortedCompanies.map((c) => c?.name));

    return sortedCompanies;
  }, [companies]);

  const selectedCompany = companies.find((c) => c.id === form.company_id);
  const availableTrucks = selectedCompany?.trucks || [];
  const unavailableTrucks = useMemo(() => {
    if (!form.company_id || !form.date || !form.shift_time) return new Set();

    const blockedStatuses = new Set(['scheduled', 'dispatch', 'amended']);

    return (dispatches || []).reduce((set, candidate) => {
      if (!candidate || !Array.isArray(candidate.trucks_assigned)) return set;
      if (dispatch?.id && candidate.id === dispatch.id) return set;
      if (candidate.archived_flag) return set;
      if (!blockedStatuses.has(String(candidate.status || '').toLowerCase())) return set;
      if (candidate.company_id !== form.company_id) return set;
      if (candidate.date !== form.date) return set;
      if (candidate.shift_time !== form.shift_time) return set;

      candidate.trucks_assigned.forEach((truckNumber) => set.add(truckNumber));
      return set;
    }, new Set());
  }, [dispatch?.id, dispatches, form.company_id, form.date, form.shift_time]);

  const companyMap = {};
  companies.forEach((c) => {companyMap[c.id] = c.name;});

  const isConfirmed = form.status === 'Scheduled';
  const normalizedStatus = String(form.status || '').toLowerCase();
  const isCanceled = normalizedStatus === 'cancelled' || normalizedStatus === 'canceled';
  const isAmended = normalizedStatus === 'amended';
  const showStatusReasonField = isCanceled || isAmended;
  const isAmendedOrCanceledStatus = (statusValue) => {
    const normalized = String(statusValue || '').toLowerCase();
    return normalized === 'amended' || normalized === 'cancelled' || normalized === 'canceled';
  };

  const normalizeAdditionalAssignments = (assignments) => {
    if (!Array.isArray(assignments)) return [];
    return assignments.map((assignment) => ({
      job_number: assignment?.job_number || '',
      start_time: assignment?.start_time || '',
      start_location: assignment?.start_location || '',
      instructions: assignment?.instructions || '',
      notes: assignment?.notes || '',
      toll_status: assignment?.toll_status || '',
      reference_tag: assignment?.reference_tag || ''
    }));
  };

  const formatPickerDate = (dateValue) => {
    const value = String(dateValue || '').trim();
    if (!value) return 'No date';
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) return value;
    return `${month}-${day}-${year}`;
  };

  const copyEligibleDispatches = (dispatches || [])
  .filter((candidate) => candidate?.id && candidate.id !== dispatch?.id)
  .filter((candidate) => String(candidate?.status || '').toLowerCase() !== 'scheduled')
  .sort((a, b) => {
    const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
    if (dateCompare !== 0) return dateCompare;
    return String(b.created_date || '').localeCompare(String(a.created_date || ''));
  })
  .filter((candidate, index, arr) => {
    const dedupeKey = [candidate.job_number, candidate.reference_tag, candidate.start_location, candidate.instructions]
    .map((field) => String(field || '').trim().toLowerCase())
    .join('||');

    return index === arr.findIndex((other) => {
      const otherKey = [other.job_number, other.reference_tag, other.start_location, other.instructions]
      .map((field) => String(field || '').trim().toLowerCase())
      .join('||');
      return dedupeKey === otherKey;
    });
  })
  .filter((candidate) => {
    const term = copySearch.trim().toLowerCase();
    if (!term) return true;
    const searchable = [
    candidate.date,
    companyMap[candidate.company_id],
    candidate.client_name,
    candidate.job_number,
    candidate.reference_tag,
    candidate.start_location,
    candidate.instructions,
    candidate.status]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
    return searchable.includes(term);
  });

  const copyDetailsFromDispatch = (sourceDispatch) => {
    if (!sourceDispatch) return;

    if (typeof copyTargetAssignmentIndex === 'number') {
      setForm((prev) => {
        const assignments = [...(prev.additional_assignments || [])];
        const current = assignments[copyTargetAssignmentIndex] || {};
        assignments[copyTargetAssignmentIndex] = {
          ...current,
          job_number: sourceDispatch.job_number || '',
          reference_tag: sourceDispatch.reference_tag || '',
          start_time: sourceDispatch.start_time || '',
          start_location: sourceDispatch.start_location || '',
          instructions: sourceDispatch.instructions || 'Deliver material to / from',
          notes: sourceDispatch.notes || '',
          toll_status: sourceDispatch.toll_status || ''
        };
        return {
          ...prev,
          additional_assignments: assignments
        };
      });
      setShowCopyPicker(false);
      setCopyTargetAssignmentIndex(null);
      return;
    }

    setForm((prev) => ({
      ...prev,
      client_name: sourceDispatch.client_name || '',
      job_number: sourceDispatch.job_number || '',
      reference_tag: sourceDispatch.reference_tag || '',
      start_time: sourceDispatch.start_time || '',
      start_location: sourceDispatch.start_location || '',
      instructions: sourceDispatch.instructions || 'Deliver material to / from',
      notes: sourceDispatch.notes || '',
      toll_status: sourceDispatch.toll_status || '',
      additional_assignments: normalizeAdditionalAssignments(sourceDispatch.additional_assignments)
    }));

    const sourceCompany = companyMap[sourceDispatch.company_id] || 'Unknown company';
    const summaryBits = [sourceDispatch.date, sourceCompany, sourceDispatch.client_name, sourceDispatch.job_number ? `#${sourceDispatch.job_number}` : null]
    .filter(Boolean);
    setCopySourceSummary(summaryBits.join(' • '));
    setShowCopyPicker(false);
    setCopyTargetAssignmentIndex(null);
  };

  const toggleTruck = (t) => {
    if (unavailableTrucks.has(t)) return;
    setForm((prev) => {
      const nextTrucks = prev.trucks_assigned.includes(t)
        ? prev.trucks_assigned.filter((x) => x !== t)
        : [...prev.trucks_assigned, t];

      const nextOverrideSet = new Set(nextTrucks);
      const nextOverrides = (prev.truck_overrides || []).filter((entry) => nextOverrideSet.has(String(entry?.truck_number || '').trim()));

      return {
        ...prev,
        trucks_assigned: nextTrucks,
        truck_overrides: nextOverrides
      };
    });
  };

  const upsertTruckOverrideField = (truckNumber, field, value) => {
    setForm((prev) => {
      const overrides = Array.isArray(prev.truck_overrides) ? [...prev.truck_overrides] : [];
      const index = overrides.findIndex((entry) => String(entry?.truck_number || '').trim() === truckNumber);
      const current = index >= 0 ? overrides[index] : { truck_number: truckNumber, start_time: '', start_location: '', instructions: '', notes: '' };
      const next = { ...current, [field]: value };

      if (index >= 0) {
        overrides[index] = next;
      } else {
        overrides.push(next);
      }

      return {
        ...prev,
        truck_overrides: overrides
      };
    });
  };

  const getTruckOverride = (truckNumber) => (form.truck_overrides || [])
  .find((entry) => String(entry?.truck_number || '').trim() === truckNumber) || null;

  const addAssignment = () => {
    setForm((prev) => ({
      ...prev,
      additional_assignments: [...prev.additional_assignments, { job_number: '', reference_tag: '', start_time: '', start_location: '', instructions: '', notes: '', toll_status: '' }]
    }));
  };

  const handlePrimaryJobNumberChange = (value) => {
    const suggestedReference = getLatestReferenceTagForJob(value);
    setForm((prev) => ({
      ...prev,
      job_number: value,
      reference_tag: suggestedReference
    }));
  };

  const handlePrimaryReferenceTagChange = (value) => {
    setForm((prev) => ({ ...prev, reference_tag: value }));
  };

  const updateAssignment = (idx, field, val) => {
    const arr = [...form.additional_assignments];

    if (field === 'job_number') {
      const suggestedReference = getLatestReferenceTagForJob(val);
      arr[idx] = { ...arr[idx], job_number: val, reference_tag: suggestedReference };
    } else if (field === 'reference_tag') {
      arr[idx] = { ...arr[idx], reference_tag: val };
    } else {
      arr[idx] = { ...arr[idx], [field]: val };
    }

    setForm({ ...form, additional_assignments: arr });
  };

  const removeAssignment = (idx) => {
    setForm({ ...form, additional_assignments: form.additional_assignments.filter((_, i) => i !== idx) });
  };

  const hasValue = (value) => String(value || '').trim().length > 0;

  const validateRequiredFields = () => {
    const missingFields = [];

    if (!hasValue(form.company_id)) missingFields.push('Company');
    if (!hasValue(form.date)) missingFields.push('Date');
    if (!hasValue(form.shift_time)) missingFields.push('Shift');
    if ((form.trucks_assigned || []).length === 0) missingFields.push('Trucks Assigned');

    if (!isConfirmed) {
      if (!hasValue(form.client_name)) missingFields.push('Client Name');
      if (!hasValue(form.job_number)) missingFields.push('Job Number');
      if (!hasValue(form.start_time)) missingFields.push('Start Time');
      if (!hasValue(form.start_location)) missingFields.push('Start Location');
      if (!hasValue(form.instructions)) missingFields.push('Instructions');
      if (!hasValue(form.toll_status)) missingFields.push('Toll Status');

      for (const [index, assignment] of (form.additional_assignments || []).entries()) {
        const assignmentNumber = index + 2;
        if (!hasValue(assignment?.job_number)) missingFields.push(`Assignment ${assignmentNumber}: Job Number`);
        if (!hasValue(assignment?.start_time)) missingFields.push(`Assignment ${assignmentNumber}: Start Time`);
        if (!hasValue(assignment?.start_location)) missingFields.push(`Assignment ${assignmentNumber}: Start Location`);
        if (!hasValue(assignment?.instructions)) missingFields.push(`Assignment ${assignmentNumber}: Instructions`);
        if (!hasValue(assignment?.toll_status)) missingFields.push(`Assignment ${assignmentNumber}: Toll Status`);
      }
    }

    if (isCanceled && !hasValue(form.canceled_reason)) missingFields.push('Cancellation Reason');
    if (isAmended && !hasValue(form.canceled_reason)) missingFields.push('Amendment Reason');

    return missingFields;
  };

  const finalizeSubmit = async (finalForm, customUpdateMessage = '') =>
  onSave(finalForm, { customUpdateMessage });

  const closeUpdateModals = () => {
    setShowUpdateNotifyChoice(false);
    setShowUpdateMessagePrompt(false);
    setPendingFinalForm(null);
    setUpdateMessage('');
  };

  const handleSubmit = async () => {
    const missingFields = validateRequiredFields();
    if (missingFields.length > 0) {
      setRequiredFieldsMessage(`Please complete the required fields: ${missingFields.join(', ')}`);
      setShowRequiredFieldsDialog(true);
      return;
    }

    if (form.trucks_assigned.some((truckNumber) => unavailableTrucks.has(truckNumber))) {
      alert('One or more selected trucks are already assigned for this company, date, and shift.');
      return;
    }

    // Track amendments
    let finalForm = { ...form };
    if (dispatch && form.status === 'Amended' && dispatch.status !== 'Amended') {
      const changes = [];
      if (dispatch.start_location !== form.start_location) changes.push('location');
      if (dispatch.start_time !== form.start_time) changes.push('time');
      if (dispatch.instructions !== form.instructions) changes.push('instructions');
      if (JSON.stringify(dispatch.trucks_assigned) !== JSON.stringify(form.trucks_assigned)) changes.push('trucks');

      if (changes.length > 0) {
        finalForm.amendment_history = [
        ...(finalForm.amendment_history || []),
        { amended_at: new Date().toISOString(), changes: `Updated: ${changes.join(', ')}` }];

      }
    }

    // Ensure date is stored as plain YYYY-MM-DD string (no Date conversion)
    finalForm.date = form.date;
    finalForm.truck_overrides = useStaggeredOverrides
      ? (Array.isArray(form.truck_overrides) ? form.truck_overrides : [])
        .map((entry) => ({
          truck_number: String(entry?.truck_number || '').trim(),
          start_time: String(entry?.start_time || '').trim(),
          start_location: String(entry?.start_location || '').trim(),
          instructions: String(entry?.instructions || '').trim(),
          notes: String(entry?.notes || '').trim(),
        }))
        .filter((entry) =>
          finalForm.trucks_assigned.includes(entry.truck_number) &&
          (entry.start_time || entry.start_location || entry.instructions || entry.notes)
        )
      : [];

    const isEdit = !!dispatch && !dispatch._isCopy;
    const statusChanged = isEdit ? dispatch.status !== finalForm.status : true;
    const previousTrucks = isEdit ? (dispatch.trucks_assigned || []) : [];
    const nextTrucks = finalForm.trucks_assigned || [];
    const addedTrucks = !statusChanged
      ? nextTrucks.filter((truck) => !previousTrucks.includes(truck))
      : [];

    if (isEdit && !statusChanged && addedTrucks.length === 0) {
      setPendingFinalForm(finalForm);
      setShowUpdateNotifyChoice(true);
      return;
    }

    await finalizeSubmit(finalForm);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Company *</Label>
          <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v, trucks_assigned: [], truck_overrides: [] })}>
            <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
            <SelectContent>
              {activeCompaniesSorted.map((c) =>
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => {
              setForm((prev) => {
                const fromAmendedOrCanceled = isAmendedOrCanceledStatus(prev.status);
                const toAmendedOrCanceled = isAmendedOrCanceledStatus(v);
                const switchedBetweenAmendedAndCanceled =
                  fromAmendedOrCanceled &&
                  toAmendedOrCanceled &&
                  String(prev.status || '').toLowerCase() !== String(v || '').toLowerCase();

                return {
                  ...prev,
                  status: v,
                  canceled_reason: switchedBetweenAmendedAndCanceled ? '' : prev.canceled_reason
                };
              });
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Scheduled">Scheduled (pending dispatch)</SelectItem>
              <SelectItem value="Dispatch">Dispatch (full details)</SelectItem>
              <SelectItem value="Amended">Amended</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Date *</Label>
          {/* value is kept as YYYY-MM-DD string — no Date object conversion */}
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div>
          <Label>Shift *</Label>
          <Select value={form.shift_time} onValueChange={(v) => setForm({ ...form, shift_time: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Day Shift">Day Shift</SelectItem>
              <SelectItem value="Night Shift">Night Shift</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!isConfirmed &&
        <>
            <div>
              <Label>Client Name *</Label>
              <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
            </div>
            {showStatusReasonField &&
          <div>
                <Label>{isCanceled ? 'Cancellation Reason *' : 'Amendment Reason *'}</Label>
                <Textarea
              value={form.canceled_reason}
              onChange={(e) => setForm({ ...form, canceled_reason: e.target.value })}
              rows={2}
              placeholder={isCanceled ? 'Reason for cancellation...' : 'Reason for amendment...'}
            />
              </div>
          }
          </>
        }
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-800">Reuse dispatch details</p>
            <p className="text-xs text-slate-500">Copy operational fields from a previous dispatch into this form.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCopyTargetAssignmentIndex(null);
              setShowCopyPicker(true);
            }}
            className="shrink-0"
          >
            <Copy className="h-4 w-4 mr-1" />Copy Details From...
          </Button>
        </div>
        {copySourceSummary &&
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
            Details copied from {copySourceSummary}
          </p>
        }
      </div>

      {!isConfirmed &&
      <>
          {/* Assignment 1 — primary */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Assignment 1 (Primary)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Job Number *</Label>
                <Input placeholder="Job #" value={form.job_number || ''} onChange={(e) => handlePrimaryJobNumberChange(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Reference Tag</Label>
                <Input placeholder="Spoken name" value={form.reference_tag || ''} onChange={(e) => handlePrimaryReferenceTagChange(e.target.value)} maxLength={40} />
              </div>
              <div>
                <Label className="text-xs">Start Time *</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Start Location *</Label>
              <Textarea value={form.start_location} onChange={(e) => setForm({ ...form, start_location: e.target.value })} rows={2} placeholder="Enter address (multi-line supported)" />
            </div>
            <div>
              <Label>Instructions *</Label>
              <Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div>
              <Label className="text-xs">Toll Status *</Label>
              <Select value={form.toll_status} onValueChange={(v) => setForm({ ...form, toll_status: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Authorized">Authorized</SelectItem>
                  <SelectItem value="Unauthorized">Unauthorized</SelectItem>
                  <SelectItem value="Included in Rate">Included in Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      }

      {/* Trucks */}
      <div>
        <Label>Trucks Assigned * {!form.company_id && <span className="text-xs text-slate-400 ml-1">(select company first)</span>}</Label>
        <div className="flex gap-2 flex-wrap mt-1">
          {availableTrucks.map((t) =>
          (() => {
            const isUnavailable = unavailableTrucks.has(t);

            return (
              <button
                key={t}
                onClick={() => toggleTruck(t)}
                disabled={!form.company_id || isUnavailable}
                className={`relative px-3 py-1.5 rounded-lg border text-sm font-mono transition-colors ${
                  form.trucks_assigned.includes(t)
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                } ${isUnavailable ? 'opacity-50 cursor-not-allowed' : ''} disabled:opacity-40`}
              >
                {isUnavailable && (
                  <span className="pointer-events-none absolute inset-0">
                    <span className="absolute left-0 top-1/2 h-px w-[140%] -translate-y-1/2 -rotate-45 bg-slate-500/80 origin-left" />
                  </span>
                )}
                {t}
              </button>
            );
          })()
          )}
          {form.company_id && availableTrucks.length === 0 &&
          <span className="text-xs text-slate-400">No trucks on this company</span>
          }
        </div>
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Checkbox checked={useStaggeredOverrides} onCheckedChange={(checked) => setUseStaggeredOverrides(Boolean(checked))} />
            Use staggered truck times/details
          </label>
          {useStaggeredOverrides && (
            <div className="mt-3 space-y-3">
              {(form.trucks_assigned || []).map((truckNumber) => {
                const override = getTruckOverride(truckNumber);
                return (
                  <div key={truckNumber} className="rounded-md border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{truckNumber}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">Start Time Override</Label>
                        <Input type="time" value={override?.start_time || ''} onChange={(e) => upsertTruckOverrideField(truckNumber, 'start_time', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Start Location Override</Label>
                        <Input value={override?.start_location || ''} onChange={(e) => upsertTruckOverrideField(truckNumber, 'start_location', e.target.value)} placeholder="Optional" />
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">Instructions Override</Label>
                        <Textarea rows={2} value={override?.instructions || ''} onChange={(e) => upsertTruckOverrideField(truckNumber, 'instructions', e.target.value)} placeholder="Optional" />
                      </div>
                      <div>
                        <Label className="text-xs">Notes Override</Label>
                        <Textarea rows={2} value={override?.notes || ''} onChange={(e) => upsertTruckOverrideField(truckNumber, 'notes', e.target.value)} placeholder="Optional" />
                      </div>
                    </div>
                  </div>
                );
              })}
              {(form.trucks_assigned || []).length === 0 && <p className="text-xs text-slate-500">Select trucks first to configure optional overrides.</p>}
            </div>
          )}
        </div>
      </div>

      {/* Additional Assignments - only for non-confirmed dispatches */}
      {!isConfirmed &&
      <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Additional Assignments</Label>
            <Button type="button" variant="outline" size="sm" onClick={addAssignment} className="text-xs">
              <Plus className="h-3 w-3 mr-1" />Add Assignment
            </Button>
          </div>
          {form.additional_assignments.map((a, i) =>
        <div key={i} className={`rounded-lg border border-slate-200 p-4 space-y-3 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-blue-50/40'}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Assignment {i + 2}</p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => {
                      setCopyTargetAssignmentIndex(i);
                      setShowCopyPicker(true);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />Copy Details From...
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeAssignment(i)} className="h-7 w-7 text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Job Number *</Label>
                  <Input placeholder="Job #" value={a.job_number || ''} onChange={(e) => updateAssignment(i, 'job_number', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Reference Tag</Label>
                  <Input placeholder="Spoken name" value={a.reference_tag || ''} onChange={(e) => updateAssignment(i, 'reference_tag', e.target.value)} maxLength={40} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Start Time *</Label>
                  <Input type="time" value={a.start_time} onChange={(e) => updateAssignment(i, 'start_time', e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Start Location *</Label>
                <Textarea placeholder="Enter address (multi-line supported)" value={a.start_location} onChange={(e) => updateAssignment(i, 'start_location', e.target.value)} rows={2} />
              </div>
              <div>
                <Label className="text-xs">Instructions *</Label>
                <Textarea placeholder="Instructions" value={a.instructions} onChange={(e) => updateAssignment(i, 'instructions', e.target.value)} rows={2} />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea placeholder="Notes" value={a.notes || ''} onChange={(e) => updateAssignment(i, 'notes', e.target.value)} rows={2} />
              </div>
              <div>
                <Label className="text-xs">Toll Status *</Label>
                <Select value={a.toll_status || ''} onValueChange={(v) => updateAssignment(i, 'toll_status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Authorized">Authorized</SelectItem>
                    <SelectItem value="Unauthorized">Unauthorized</SelectItem>
                    <SelectItem value="Included in Rate">Included in Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
        )}
        </div>
      }

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="bg-background text-red-600 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input shadow-sm hover:bg-accent hover:text-accent-foreground h-9 flex-1">Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving} className="flex-1 bg-slate-900 hover:bg-slate-800">
          {saving ? 'Saving...' : dispatch ? 'Update Dispatch' : 'Create Dispatch'}
        </Button>
      </div>

      <Dialog open={showRequiredFieldsDialog} onOpenChange={setShowRequiredFieldsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Required fields missing</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-700">{requiredFieldsMessage}</p>
          <div className="pt-2">
            <Button
              className="w-full bg-slate-900 hover:bg-slate-800"
              onClick={() => setShowRequiredFieldsDialog(false)}
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUpdateNotifyChoice} onOpenChange={setShowUpdateNotifyChoice}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Would you like to send a notification with this update?</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={async () => {
                const formToSave = pendingFinalForm;
                closeUpdateModals();
                if (formToSave) await finalizeSubmit(formToSave);
              }}
              disabled={saving}
            >
              No
            </Button>
            <Button
              className="flex-1 bg-slate-900 hover:bg-slate-800"
              onClick={() => {
                setShowUpdateNotifyChoice(false);
                setShowUpdateMessagePrompt(true);
              }}
              disabled={saving}
            >
              Yes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUpdateMessagePrompt} onOpenChange={setShowUpdateMessagePrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Please enter message</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={updateMessage}
              onChange={(e) => setUpdateMessage(e.target.value.slice(0, UPDATE_MESSAGE_MAX_LENGTH))}
              maxLength={UPDATE_MESSAGE_MAX_LENGTH}
              placeholder="Type a short update"
            />
            <p className="text-xs text-slate-500 text-right">{updateMessage.length}/{UPDATE_MESSAGE_MAX_LENGTH}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={closeUpdateModals}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-slate-900 hover:bg-slate-800"
              disabled={saving || !updateMessage.trim()}
              onClick={async () => {
                const formToSave = pendingFinalForm;
                const messageToSend = updateMessage.trim();
                closeUpdateModals();
                if (formToSave) await finalizeSubmit(formToSave, messageToSend);
              }}
            >
              {saving ? 'Saving...' : 'Save & Send'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCopyPicker} onOpenChange={setShowCopyPicker}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Copy Details From...</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-hidden flex flex-col">
            <Input
              placeholder="Search date, client, job #, reference tag, start, instructions, or status"
              value={copySearch}
              onChange={(e) => setCopySearch(e.target.value)}
            />
            <div className="overflow-y-auto border rounded-md">
              {copyEligibleDispatches.length === 0 &&
              <p className="text-sm text-slate-500 px-3 py-4">No matching dispatches found.</p>
              }
              {copyEligibleDispatches.map((candidate) => {
                return (
                  <button
                    type="button"
                    key={candidate.id}
                    onClick={() => copyDetailsFromDispatch(candidate)}
                    className="w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-sm font-semibold text-slate-800 leading-tight truncate">
                      {formatPickerDate(candidate.date)} • {candidate.client_name || '—'} • Job #{candidate.job_number || '—'}
                    </p>
                    {candidate.reference_tag && <p className="text-xs text-slate-500 leading-tight mt-0.5 truncate">Reference: {candidate.reference_tag}</p>}
                    <p className="text-xs text-slate-600 leading-tight mt-1 truncate">Start: {candidate.start_location || '—'}</p>
                    <p className="text-xs text-slate-600 leading-tight mt-0.5 truncate">Instructions: {candidate.instructions || '—'}</p>
                  </button>);

              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}
