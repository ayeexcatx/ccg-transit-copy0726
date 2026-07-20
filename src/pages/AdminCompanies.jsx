import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DeleteConfirmationDialog from '@/components/admin/DeleteConfirmationDialog';
import { Building2, Plus, Pencil, Trash2, X, TrendingUp, TrendingDown, Minus, MessageSquare, Smartphone, UserRound, Truck, ChevronRight, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import { calculateCompanyScore, SCORING_EVENT_TYPES, SCORING_PERIODS } from '@/lib/companyScoring';
import { formatPhoneNumber, getCompanyOwnerSmsState, getCompanySmsContact, getDriverSmsState } from '@/lib/sms';
import { validateAdminAccessCode } from '@/lib/adminAccessCodeValidation';
import { reviewCompanyProfileChangeRequest } from '@/services/companyProfileChangeReviewService';
import { activeDriverProtocolQueryKey, getCurrentActiveDriverProtocol } from '@/services/driverProtocolService';
import { toast } from 'sonner';

const CONTACT_TYPE_OPTIONS = ['Office', 'Cell', 'Email', 'Fax', 'Other'];
const PHONE_CONTACT_TYPES = ['Office', 'Cell', 'Fax'];

const normalizeContactMethods = (company) => {
  const fallbackContactName = company?.additional_contact_name || '';
  if (Array.isArray(company?.contact_methods) && company.contact_methods.length > 0) {
    return company.contact_methods.map((method) => ({
      name: method?.name || fallbackContactName || '',
      type: CONTACT_TYPE_OPTIONS.includes(method?.type) ? method.type : 'Other',
      value: method?.value || '',
    }));
  }

  if (company?.contact_info) return [{ name: fallbackContactName, type: 'Other', value: company.contact_info }];
  return [{ name: '', type: 'Office', value: '' }];
};

const initialEventForm = {
  event_type: 'Company Cancellation',
  event_date: new Date().toISOString().slice(0, 10),
  dispatch_id: '',
  truck_number: '',
  driver_id: '',
  severity: 'Medium',
  notes: '',
  impacts_completion_rate: true,
  include_in_trends: true,
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDispatchOptionLabel = (dispatch) => {
  const date = parseDate(dispatch.date);
  const dateLabel = date ? format(date, 'MMM d, yyyy') : 'Unknown date';
  const withStartTime = dispatch.start_time && date ? parseDate(`${dispatch.date}T${dispatch.start_time}`) : null;
  const timeSource = withStartTime || parseDate(dispatch.start_datetime);
  const timeLabel = timeSource ? format(timeSource, 'h:mm a') : 'No time';
  const idLabel = dispatch.job_number || dispatch.reference_tag || dispatch.dispatch_number || dispatch.id;
  return `${dateLabel} • ${timeLabel} • Job #${idLabel}`;
};

const getTrendStyling = (trend) => {
  if (trend === 'Trending Up') return { icon: TrendingUp, color: 'text-emerald-600' };
  if (trend === 'Trending Down') return { icon: TrendingDown, color: 'text-red-600' };
  return { icon: Minus, color: 'text-slate-500' };
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const formatDisplayValue = (value, fallback = 'Not available') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  if (value === '—') return fallback;
  return value;
};

const getInitials = (value = '') => {
  const parts = String(value).trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return 'DR';
  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
};

const SECTION_WRAPPER_CLASS = 'relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm';

const DrawerSection = ({ title, icon: Icon = Building2, children }) => (
  <section className={SECTION_WRAPPER_CLASS}>
    <div className="absolute inset-y-0 left-0 w-1 bg-slate-200/70" />
    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600"><Icon className="h-3.5 w-3.5" /></span>
      {title}
    </h3>
    <div className="mt-4">{children}</div>
  </section>
);

const KeyValueRow = ({ label, value, valueClassName = '' }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`text-sm text-right text-slate-900 ${valueClassName}`}>{formatDisplayValue(value)}</p>
  </div>
);

const CompanyDetailHero = ({ company, driverCount, truckCount, smsStateLabel }) => (
  <div className="sticky top-0 z-10 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Company Summary</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">{company?.name || 'Company'}</h2>
        <p className={`mt-2 text-sm whitespace-pre-line ${company?.address ? 'text-slate-600' : 'italic text-slate-500'}`}>
          {formatDisplayValue(company?.address, 'Address not available')}
        </p>
      </div>
      <Badge variant="outline" className="capitalize border-slate-300 bg-slate-100 text-slate-700">
        {formatDisplayValue(company?.status || 'active')}
      </Badge>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Drivers</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{driverCount}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Trucks</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{truckCount}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 col-span-2 sm:col-span-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">SMS Contact</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{smsStateLabel}</p>
      </div>
    </div>
  </div>
);

const DriverAccordionCard = ({ driver, smsState, driverCode, protocolAck, latestProtocolAck, currentProtocolVersion }) => {
  const [isOpen, setIsOpen] = useState(false);
  const consentRecorded = driverCode?.sms_consent_given === true;
  const protocolAcknowledged = Boolean(protocolAck);
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <button
        type="button"
        className="w-full px-4 py-3.5 sm:px-5 text-left"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {getInitials(driver.driver_name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{driver.driver_name || 'Unnamed driver'}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{driver.phone ? formatPhoneNumber(driver.phone) : 'No phone on file'}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className={smsState.effective ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}>
              {smsState.effective ? 'SMS Active' : 'SMS Off'}
            </Badge>
            <Badge variant="secondary" className={`hidden sm:inline-flex ${protocolAcknowledged ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
              {protocolAcknowledged ? 'Protocol Acknowledged' : 'Protocol Not Acknowledged'}
            </Badge>
            <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </div>
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-slate-200 bg-slate-50/40 px-4 py-4 sm:px-5">
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Identity</p>
              <div className="mt-2">
                <KeyValueRow label="Driver name" value={driver.driver_name || 'Not available'} />
                <KeyValueRow label="Phone" value={driver.phone ? formatPhoneNumber(driver.phone) : 'Not available'} />
                <KeyValueRow label="SMS status" value={smsState.effective ? 'SMS Active' : 'SMS Off'} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access & SMS</p>
              <div className="mt-2">
                <KeyValueRow label="Access code status" value={driver.access_code_status || 'Not requested'} />
                <KeyValueRow label="Owner enabled" value={smsState.ownerEnabled ? 'Yes' : 'No'} />
                <KeyValueRow label="Driver opted in" value={smsState.driverOptedIn ? 'Yes' : 'No'} />
                <KeyValueRow label="SMS phone" value={smsState.normalizedPhone ? formatPhoneNumber(smsState.normalizedPhone) : 'Not available'} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consent History</p>
              <div className="mt-2">
                <KeyValueRow label="Consent status" value={consentRecorded ? 'Recorded' : 'Not recorded'} />
                <KeyValueRow label="Consent timestamp" value={formatDateTime(driverCode?.sms_consent_at)} />
                <KeyValueRow label="Consent method" value={driverCode?.sms_consent_method} />
                <KeyValueRow label="Opt-out timestamp" value={formatDateTime(driverCode?.sms_opted_out_at)} />
                <KeyValueRow label="Intro/welcome sent" value={formatDateTime(driverCode?.sms_intro_sent_at)} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Protocols</p>
              <div className="mt-2">
                <KeyValueRow label={`Current protocol v${currentProtocolVersion || '—'}`} value={protocolAck ? 'Recorded' : 'Not recorded'} />
                <KeyValueRow label="Current version timestamp" value={formatDateTime(protocolAck?.accepted_at)} />
                <KeyValueRow label="Latest acknowledged version" value={latestProtocolAck?.protocol_version || 'Not recorded'} />
                <KeyValueRow label="Latest acknowledged timestamp" value={formatDateTime(latestProtocolAck?.accepted_at)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CompanyOwnerCard = ({ ownerCode, ownerUser, ownerCount }) => {
  const smsState = getCompanyOwnerSmsState({ accessCode: ownerCode });
  const consentRecorded = ownerCode?.sms_consent_given === true;
  const ownerDisplayName = String(ownerUser?.app_display_name || '').trim()
    || String(ownerCode?.label || '').trim()
    || `Owner ${ownerCount}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{ownerDisplayName}</p>
          <p className="mt-1 text-xs text-slate-500">Access code: {ownerCode?.code || 'Not available'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={ownerCode?.active_flag === false ? 'border-slate-300 bg-slate-100 text-slate-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
            {ownerCode?.active_flag === false ? 'Inactive' : 'Active'}
          </Badge>
          <Badge variant="outline" className={smsState.effective ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}>
            {smsState.effective ? 'SMS Active' : 'SMS Off'}
          </Badge>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner Profile & SMS Compliance</p>
        <div className="mt-2">
          <KeyValueRow label="Owner name / display name" value={ownerDisplayName} />
          <KeyValueRow label="SMS phone" value={smsState.normalizedPhone ? formatPhoneNumber(smsState.normalizedPhone) : 'Not available'} />
          <KeyValueRow label="Owner SMS enabled" value={smsState.ownerEnabled ? 'Yes' : 'No'} />
          <KeyValueRow label="Owner SMS effective" value={smsState.effective ? 'Yes' : 'No'} />
          <KeyValueRow label="Owner consent" value={consentRecorded ? 'Recorded' : 'Not recorded'} />
          <KeyValueRow label="Owner consent timestamp" value={formatDateTime(ownerCode?.sms_consent_at)} />
          <KeyValueRow label="Owner consent method" value={ownerCode?.sms_consent_method} />
          <KeyValueRow label="Owner opt-out timestamp" value={formatDateTime(ownerCode?.sms_opted_out_at)} />
          <KeyValueRow label="Owner intro/welcome sent" value={formatDateTime(ownerCode?.sms_intro_sent_at)} />
        </div>
      </div>
    </div>
  );
};


const renderContactMethodsList = (contactMethods = [], fallbackText = '', fallbackContactName = '') => {
  if (Array.isArray(contactMethods) && contactMethods.some((method) => method?.value)) {
    return (
      <div className="space-y-1">
        {contactMethods.filter((method) => method?.value).map((method, index) => (
          <p key={`contact-method-${index}`}>
            <span className="font-medium text-slate-700">{(method?.name || (index === 0 ? fallbackContactName : '')) ? `${method?.name || (index === 0 ? fallbackContactName : '')} | ` : ''}{method.type || 'Other'}:</span> {method.value}
          </p>
        ))}
      </div>
    );
  }

  return <p className="italic text-slate-500">{fallbackText || 'Not available'}</p>;
};

const MetricCard = ({ metric }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-3">
    <p className="text-xs text-slate-500">{metric.label}</p>
    <p className="text-sm font-semibold text-slate-900 mt-1">{metric.display}</p>
    <p className="text-xs text-slate-500 mt-1">Score {Math.round(metric.score)} / 100</p>
  </div>
);

function ScoringDetailDialog({ company, score, eventForm, setEventForm, onCreate, onDelete, isSaving, isDeleting, dispatchOptions, drivers, trucks }) {
  if (!company || !score) return null;
  const trend = getTrendStyling(score.trend);
  const TrendIcon = trend.icon;

  const selectedDispatch = dispatchOptions.find((dispatch) => dispatch.id === eventForm.dispatch_id);
  const dispatchTruckOptions = selectedDispatch?.trucks_assigned?.length ? selectedDispatch.trucks_assigned : trucks;
  const dispatchDriverIds = selectedDispatch?.drivers_assigned || [];
  const narrowedDrivers = dispatchDriverIds.length ? drivers.filter((driver) => dispatchDriverIds.includes(driver.id)) : drivers;

  return (
    <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Company Reliability Score</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{score.score} / 100</p>
              <p className={`text-sm mt-1 flex items-center gap-1 ${trend.color}`}><TrendIcon className="h-4 w-4" />{score.trend}</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>{score.periodComparisonLabels.current}: {score.trendCurrentScore}</p>
              <p>{score.periodComparisonLabels.previous}: {score.trendPreviousScore}</p>
              <p>{score.additional.periodDateRangeLabel}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.values(score.metrics).map((metric) => <MetricCard key={metric.label} metric={metric} />)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <details>
            <summary className="cursor-pointer font-semibold text-slate-800">How this scoring works</summary>
            <div className="mt-3 text-sm text-slate-600 space-y-1">
              <p>Reliability Score combines confirmation speed, missed confirmations, completion rate, truck utilization, breakdowns, manual late events, cancellations, and scheduled confirmation performance.</p>
              <p><strong>Truck score</strong> is based only on true mechanical/breakdown incidents linked to that truck and manual scoring entries linked to that truck.</p>
              <p><strong>Driver score</strong> is based only on manual scoring entries linked to that driver.</p>
              <p>Only true mechanical/breakdown incident types from incident reports are counted automatically for breakdown scoring.</p>
              <p>Delay incidents do not automatically count as late issues. Late issues are tracked via manual events like "Late Arrival".</p>
              <p>Accidents from incident reports do not automatically reduce completion or reliability.</p>
              <p>Completion defaults to complete for dispatches before today unless manual non-completion flags are logged, or a true mechanical/breakdown incident is attached.</p>
              <p>Manual event checkboxes mean: <strong>Impacts completion rate</strong> will reduce completion, and <strong>Include in trend analysis</strong> allows the event to influence trend calculations.</p>
              <p>Exceptional Performance gives a small positive adjustment to score/trend (modest and intentionally limited).</p>
              <p>The selected period updates metrics, trend, warnings, truck/driver summaries, and event history. Current vs Previous period labels always match the selected period.</p>
            </div>
          </details>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-800">Truck Performance</p>
            {score.truckSummaries.length === 0 ? <p className="text-sm text-slate-500">No truck data available.</p> : score.truckSummaries.map((truck) => (
              <div key={truck.truckNumber} className="rounded-lg border border-slate-200 p-3 text-sm flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">Truck {truck.truckNumber}</p>
                  <p className="text-slate-600">Dispatches: {truck.dispatchCount} • Breakdowns: {truck.breakdowns} • Late events: {truck.lateIssues}</p>
                  <p className="text-slate-600">Completion rate: {Math.round(truck.completionRate)}%</p>
                </div>
                <p className={`text-4xl font-bold leading-none ${truck.truckScore >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {Math.round(truck.truckScore)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-800">Driver Performance</p>
            {score.driverSummaries.length === 0 ? <p className="text-sm text-slate-500">No driver data available.</p> : score.driverSummaries.map((driver) => (
              <div key={driver.driverId} className="rounded-lg border border-slate-200 p-3 text-sm flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{driver.driverName}</p>
                  <p className="text-slate-600">Dispatches: {driver.dispatchCount} • Confirmation rate: {Math.round(driver.confirmationRate)}%</p>
                  <p className="text-slate-600">Logged performance events: {driver.eventCount}</p>
                </div>
                <p className={`text-4xl font-bold leading-none ${driver.driverScore >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {Math.round(driver.driverScore)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <p className="text-sm font-semibold text-slate-800">Manual Reliability Log</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Event Type</Label>
              <Select value={eventForm.event_type} onValueChange={(value) => setEventForm((prev) => ({ ...prev, event_type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SCORING_EVENT_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={eventForm.event_date} onChange={(e) => setEventForm((prev) => ({ ...prev, event_date: e.target.value }))} />
            </div>
            <div>
              <Label>Related Dispatch (optional)</Label>
              <Select value={eventForm.dispatch_id || 'none'} onValueChange={(value) => setEventForm((prev) => ({ ...prev, dispatch_id: value === 'none' ? '' : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked dispatch</SelectItem>
                  {dispatchOptions.map((dispatch) => (
                    <SelectItem key={dispatch.id} value={dispatch.id}>{formatDispatchOptionLabel(dispatch)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Related Truck (optional)</Label>
              <Select value={eventForm.truck_number || 'none'} onValueChange={(value) => setEventForm((prev) => ({ ...prev, truck_number: value === 'none' ? '' : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked truck</SelectItem>
                  {dispatchTruckOptions.map((truckNumber) => <SelectItem key={truckNumber} value={truckNumber}>{truckNumber}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Related Driver (optional)</Label>
              <Select value={eventForm.driver_id || 'none'} onValueChange={(value) => setEventForm((prev) => ({ ...prev, driver_id: value === 'none' ? '' : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked driver</SelectItem>
                  {narrowedDrivers.map((driver) => <SelectItem key={driver.id} value={driver.id}>{driver.driver_name || 'Unknown Driver'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severity</Label>
              <Select value={eventForm.severity} onValueChange={(value) => setEventForm((prev) => ({ ...prev, severity: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={3} value={eventForm.notes} onChange={(e) => setEventForm((prev) => ({ ...prev, notes: e.target.value }))} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={eventForm.impacts_completion_rate} onChange={(e) => setEventForm((prev) => ({ ...prev, impacts_completion_rate: e.target.checked }))} />Impacts completion rate</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={eventForm.include_in_trends} onChange={(e) => setEventForm((prev) => ({ ...prev, include_in_trends: e.target.checked }))} />Include in trend analysis</label>
          </div>
          <Button onClick={onCreate} disabled={isSaving} className="bg-slate-900 hover:bg-slate-800">{isSaving ? 'Saving Event...' : 'Add Performance Event'}</Button>

          <div className="space-y-2">
            <p className="text-xs uppercase text-slate-500">Event History</p>
            {score.events.length === 0 ? <p className="text-sm text-slate-500">No manual reliability events yet.</p> : score.events.map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-200 p-3 text-sm flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-slate-800">{event.event_type || '—'}</p>
                  <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
                    <p><span className="font-medium text-slate-700">Event Date:</span> {event.event_date ? new Date(event.event_date).toLocaleDateString() : '—'}</p>
                    <p><span className="font-medium text-slate-700">Related Dispatch:</span> {event.dispatch_id || '—'}</p>
                    <p><span className="font-medium text-slate-700">Related Truck:</span> {event.truck_number || '—'}</p>
                    <p><span className="font-medium text-slate-700">Related Driver:</span> {drivers.find((driver) => driver.id === event.driver_id)?.driver_name || '—'}</p>
                    <p><span className="font-medium text-slate-700">Severity:</span> {event.severity || '—'}</p>
                    <p className="sm:col-span-2 break-words"><span className="font-medium text-slate-700">Notes:</span> {event.notes || '—'}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDelete(event.id)} disabled={isDeleting} className="h-7 w-7 text-red-500 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminCompanies() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pageTab, setPageTab] = useState('company-info');
  const [form, setForm] = useState({
    name: '',
    address: '',
    contact_methods: [{ name: '', type: 'Office', value: '' }],
    trucks: [],
    status: 'active'
  });
  const [truckInput, setTruckInput] = useState('');
  const [periodKey, setPeriodKey] = useState('last30');
  const [selectedScoringCompany, setSelectedScoringCompany] = useState(null);
  const [selectedCompanyDetailId, setSelectedCompanyDetailId] = useState(null);
  const [eventForm, setEventForm] = useState(initialEventForm);
  const [companyPendingDelete, setCompanyPendingDelete] = useState(null);
  const [deleteAdminCode, setDeleteAdminCode] = useState('');
  const [deleteAdminCodeError, setDeleteAdminCodeError] = useState('');

  const { data: companies = [], isLoading } = useQuery({ queryKey: ['companies'], queryFn: () => base44.entities.Company.list() });
  const { data: dispatches = [] } = useQuery({ queryKey: ['scoring-dispatches'], queryFn: () => base44.entities.Dispatch.list('-date', 1000) });
  const { data: confirmations = [] } = useQuery({ queryKey: ['scoring-confirmations'], queryFn: () => base44.entities.Confirmation.list('-confirmed_at', 1000) });
  const { data: incidents = [] } = useQuery({ queryKey: ['scoring-incidents'], queryFn: () => base44.entities.IncidentReport.list('-created_date', 1000) });
  const { data: drivers = [] } = useQuery({ queryKey: ['scoring-drivers'], queryFn: () => base44.entities.Driver.list('-created_date', 1000) });
  const { data: accessCodes = [] } = useQuery({ queryKey: ['access-codes'], queryFn: () => base44.entities.AccessCode.list() });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => base44.entities.User.list('-created_date', 1000) });
  const { data: assignments = [] } = useQuery({ queryKey: ['scoring-driver-assignments'], queryFn: () => base44.entities.DriverDispatch.list('-created_date', 1000) });
  const { data: events = [] } = useQuery({ queryKey: ['company-scoring-events'], queryFn: () => base44.entities.CompanyScoringEvent.list('-event_date', 1000) });
  const { data: driverProtocolAcknowledgments = [] } = useQuery({
    queryKey: ['admin-driver-protocol-acknowledgments'],
    queryFn: () => base44.entities.DriverProtocolAcknowledgment.list('-accepted_at', 2000),
  });
  const { data: currentActiveProtocol = null } = useQuery({
    queryKey: activeDriverProtocolQueryKey,
    queryFn: () => getCurrentActiveDriverProtocol(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => (editing ? base44.entities.Company.update(editing.id, data) : base44.entities.Company.create(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Company.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  });

  const reviewProfileChangeMutation = useMutation({
    mutationFn: ({ companyId, action }) => reviewCompanyProfileChangeRequest({ companyId, action }),
    onSuccess: (updatedCompany, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['access-codes'] });
      toast.success(action === 'approve' ? 'Profile change approved' : 'Profile change rejected');
    },
    onError: (error) => {
      toast.error(error?.message || 'Unable to review company profile request');
    },
  });

  const saveEventMutation = useMutation({
    mutationFn: (payload) => base44.entities.CompanyScoringEvent.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-scoring-events'] });
      setEventForm(initialEventForm);
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id) => base44.entities.CompanyScoringEvent.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company-scoring-events'] }),
  });

  const scoreByCompany = useMemo(() => new Map(companies.map((company) => [
    company.id,
    calculateCompanyScore({ company, dispatches, confirmations, incidents, events, drivers, driverAssignments: assignments, periodKey }),
  ])), [companies, dispatches, confirmations, incidents, events, drivers, assignments, periodKey]);

  const selectedScore = selectedScoringCompany ? scoreByCompany.get(selectedScoringCompany.id) : null;
  const selectedCompanyDispatches = useMemo(() => {
    const selectedEventDate = eventForm.event_date;
    const byDateTime = (dispatch) => {
      const dateTime = dispatch.start_time ? parseDate(`${dispatch.date}T${dispatch.start_time}`) : parseDate(dispatch.start_datetime) || parseDate(dispatch.date);
      return dateTime ? dateTime.getTime() : 0;
    };

    return dispatches
      .filter((dispatch) => dispatch.company_id === selectedScoringCompany?.id)
      .sort((a, b) => {
        const aDateMatch = selectedEventDate && String(a.date || '').slice(0, 10) === selectedEventDate ? 1 : 0;
        const bDateMatch = selectedEventDate && String(b.date || '').slice(0, 10) === selectedEventDate ? 1 : 0;
        if (aDateMatch !== bDateMatch) return bDateMatch - aDateMatch;
        return byDateTime(b) - byDateTime(a);
      });
  }, [dispatches, selectedScoringCompany, eventForm.event_date]);
  const selectedCompanyDrivers = useMemo(() => drivers.filter((driver) => driver.company_id === selectedScoringCompany?.id), [drivers, selectedScoringCompany]);

  const driversByCompany = useMemo(() => drivers.reduce((map, driver) => {
    const companyId = driver.company_id;
    if (!companyId) return map;
    if (!map.has(companyId)) map.set(companyId, []);
    map.get(companyId).push(driver);
    return map;
  }, new Map()), [drivers]);
  const protocolAckByDriver = useMemo(() => {
    const currentAckByDriver = new Map();
    const latestAckByDriver = new Map();

    driverProtocolAcknowledgments.forEach((record) => {
      if (!record?.driver_id) return;
      const existingLatest = latestAckByDriver.get(record.driver_id);
      if (!existingLatest || new Date(record.accepted_at || 0).getTime() > new Date(existingLatest.accepted_at || 0).getTime()) {
        latestAckByDriver.set(record.driver_id, record);
      }

      if (currentActiveProtocol?.id && record.driver_protocol_id === currentActiveProtocol.id) {
        const existingCurrent = currentAckByDriver.get(record.driver_id);
        if (!existingCurrent || new Date(record.accepted_at || 0).getTime() > new Date(existingCurrent.accepted_at || 0).getTime()) {
          currentAckByDriver.set(record.driver_id, record);
        }
      }
    });

    return { currentAckByDriver, latestAckByDriver };
  }, [driverProtocolAcknowledgments, currentActiveProtocol?.id]);

  const sortedCompanies = useMemo(() => companies.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })), [companies]);
  const selectedCompanyDetail = useMemo(() => companies.find((company) => company.id === selectedCompanyDetailId) || null, [companies, selectedCompanyDetailId]);
  const accessCodeById = useMemo(() => accessCodes.reduce((map, code) => {
    map.set(code.id, code);
    return map;
  }, new Map()), [accessCodes]);
  const ownerCodesByCompany = useMemo(() => accessCodes.reduce((map, code) => {
    if (code.code_type !== 'CompanyOwner' || !code.company_id) return map;
    if (code.active_flag === false) return map;
    if (!map.has(code.company_id)) map.set(code.company_id, []);
    map.get(code.company_id).push(code);
    return map;
  }, new Map()), [accessCodes]);
  const usersById = useMemo(() => users.reduce((map, user) => {
    if (user?.id) map.set(user.id, user);
    return map;
  }, new Map()), [users]);

  const openNew = () => {
    setEditing(null);
  setForm({
    name: '',
    address: '',
    contact_methods: [{ name: '', type: 'Office', value: '' }],
    trucks: [],
    status: 'active'
   });
    setTruckInput('');
    setOpen(true);
  };

  const openEdit = (company) => {
    setEditing(company);
    setForm({
      name: company.name || '',
      address: company.address || '',
      additional_contact_name: company.additional_contact_name || '',
      contact_methods: normalizeContactMethods(company),
      trucks: company.trucks || [],
      status: company.status || 'active',
    });
    setTruckInput('');
    setOpen(true);
  };

  const addTruck = () => {
    const val = truckInput.trim();
    if (val && !form.trucks.includes(val)) setForm({ ...form, trucks: [...form.trucks, val] });
    setTruckInput('');
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const cleanedContactMethods = (form.contact_methods || [])
      .map((method) => ({
        name: (method?.name || '').trim(),
        type: CONTACT_TYPE_OPTIONS.includes(method?.type) ? method.type : 'Other',
        value: (method?.value || '').trim(),
      }))
      .filter((method) => method.value);

    saveMutation.mutate({
      ...form,
      additional_contact_name: (form.additional_contact_name || '').trim(),
      contact_methods: cleanedContactMethods,
      contact_info: cleanedContactMethods.map((method) => `${method.name ? `${method.name} | ` : ''}${method.type}: ${method.value}`).join(' • '),
    });
  };

  const updateContactMethod = (index, key, nextValue) => {
    setForm((prev) => ({
      ...prev,
      contact_methods: prev.contact_methods.map((method, i) => {
        if (i !== index) return method;
        if (key === 'value' && PHONE_CONTACT_TYPES.includes(method.type)) return { ...method, value: formatPhoneNumber(nextValue) };
        if (key === 'type') {
          const nextMethod = { ...method, type: nextValue };
          if (PHONE_CONTACT_TYPES.includes(nextValue)) nextMethod.value = formatPhoneNumber(nextMethod.value);
          return nextMethod;
        }
        return { ...method, [key]: nextValue };
      }),
    }));
  };

  const confirmDeleteCompany = () => {
    if (!companyPendingDelete) return;

    const validation = validateAdminAccessCode(deleteAdminCode, accessCodes);
    if (!validation.isValid) {
      setDeleteAdminCodeError(validation.error);
      return;
    }

    deleteMutation.mutate(companyPendingDelete.id, {
      onSuccess: () => {
        setCompanyPendingDelete(null);
        setDeleteAdminCode('');
        setDeleteAdminCodeError('');
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Companies</h2>
          <p className="text-sm text-slate-500">{companies.length} companies</p>
        </div>
        <Button onClick={openNew} className="bg-slate-900 hover:bg-slate-800"><Plus className="h-4 w-4 mr-2" />Add Company</Button>
      </div>

      <Tabs value={pageTab} onValueChange={setPageTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="company-info">Company Info</TabsTrigger>
          <TabsTrigger value="company-scoring">Company Scoring</TabsTrigger>
        </TabsList>

        <TabsContent value="company-info">
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-700 rounded-full" /></div>
          ) : companies.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">No companies yet</div>
          ) : (
            <div className="grid gap-4">
              {sortedCompanies.map((c) => (
                <Card key={c.id} className="group relative cursor-pointer overflow-hidden border border-slate-200/90 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg" onClick={() => setSelectedCompanyDetailId(c.id)}>
                  <div className="absolute inset-y-0 left-0 w-1 bg-slate-900/75 transition-colors group-hover:bg-slate-900" />
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><Building2 className="h-5 w-5 text-slate-500" /></div>
                        <div>
                          <div className="flex items-center gap-2"><h3 className="text-base font-semibold text-slate-900">{c.name}</h3><Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-xs">{c.status}</Badge></div>
                          {c.address && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{c.address}</p>}
                          <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-2 py-1">
                              <UserRound className="h-3.5 w-3.5 text-slate-500" />
                              {(driversByCompany.get(c.id) || []).length} drivers
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-2 py-1">
                              <Truck className="h-3.5 w-3.5 text-slate-500" />
                              {(c.trucks || []).length} trucks
                            </span>
                            {getCompanySmsContact(c).phone && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/80 px-2 py-1 text-emerald-700">
                                <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                                SMS contact on file
                              </span>
                            )}
                          </div>
                          {c.pending_profile_change?.status === 'Pending' && <div className="mt-2.5 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">Pending profile change request</div>}
                          <p className="mt-2.5 inline-flex items-center gap-1 text-xs text-slate-500 transition-colors group-hover:text-slate-700">View company details <ChevronRight className="h-3.5 w-3.5" /></p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); openEdit(c); }} className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setCompanyPendingDelete(c); }} className="h-8 w-8 text-red-500 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="company-scoring" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">Click a company to view full scoring breakdown, performance details, and manual event logging.</p>
            <Select value={periodKey} onValueChange={setPeriodKey}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.values(SCORING_PERIODS).map((period) => <SelectItem key={period.key} value={period.key}>{period.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedCompanies.map((company) => {
              const score = scoreByCompany.get(company.id);
              if (!score) return null;
              const trend = getTrendStyling(score.trend);
              const TrendIcon = trend.icon;
              return (
                <Card key={company.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelectedScoringCompany(company); setEventForm(initialEventForm); }}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800">{company.name}</p>
                        <p className="text-2xl font-bold text-slate-900">{score.score}</p>
                      </div>
                      <p className={`text-xs flex items-center gap-1 ${trend.color}`}><TrendIcon className="h-3.5 w-3.5" />{score.trend}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <p>Avg Confirm: {score.metrics.confirmationSpeed.display}</p>
                      <p>Completion: {Math.round(score.metrics.dispatchCompletionRate.value)}%</p>
                      <p>Breakdown: {Math.round(score.metrics.breakdownRate.value)}%</p>
                      <p>Missed Conf: {score.metrics.missedConfirmations.display}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {score.warningBadges.length ? score.warningBadges.map((warning) => <Badge key={warning} variant="destructive" className="text-xs">{warning}</Badge>) : <Badge variant="outline" className="text-xs">No warning flags</Badge>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>


      <DeleteConfirmationDialog
        open={!!companyPendingDelete}
        onOpenChange={(openState) => {
          if (openState) return;
          setCompanyPendingDelete(null);
          setDeleteAdminCode('');
          setDeleteAdminCodeError('');
        }}
        title="Delete Company?"
        description="This action permanently deletes this company. Enter an active admin access code to continue."
        onConfirm={confirmDeleteCompany}
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Company' : 'New Company'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Company Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Address</Label><Textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address\nCity, State ZIP" /></div>
            <div>
              <Label>Contact Info</Label>
              <div className="space-y-2 mt-1">
                {form.contact_methods.map((method, index) => {
                  const isPhoneType = PHONE_CONTACT_TYPES.includes(method.type);
                  return (
                    <div key={`contact-method-${index}`} className="flex gap-2 items-start">
                      <Input className="w-44 shrink-0" value={method.name || ''} placeholder="Contact name" onChange={(e) => updateContactMethod(index, 'name', e.target.value)} />
                      <Select value={method.type} onValueChange={(v) => updateContactMethod(index, 'type', v)}>
                        <SelectTrigger className="w-32 shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent>{CONTACT_TYPE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input value={method.value} placeholder={isPhoneType ? '(555) 123-4567' : 'Enter value'} onChange={(e) => updateContactMethod(index, 'value', e.target.value)} />
                      {form.contact_methods.length > 1 && <Button type="button" size="icon" variant="ghost" onClick={() => setForm((prev) => ({ ...prev, contact_methods: prev.contact_methods.filter((_, i) => i !== index) }))} className="h-9 w-9 shrink-0"><X className="h-4 w-4" /></Button>}
                    </div>
                  );
                })}
                <Button type="button" variant="outline" size="sm" onClick={() => setForm((prev) => ({ ...prev, contact_methods: [...prev.contact_methods, { name: '', type: 'Office', value: '' }] }))}><Plus className="h-3.5 w-3.5 mr-1" />Add Contact</Button>
              </div>
            </div>
            <div><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
            <div>
              <Label>Trucks</Label>
              <div className="flex gap-2 mt-1"><Input value={truckInput} onChange={(e) => setTruckInput(e.target.value)} placeholder="Truck number" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTruck())} /><Button type="button" variant="outline" onClick={addTruck}>Add</Button></div>
              <div className="flex gap-1.5 flex-wrap mt-2">{form.trucks.map((t) => <Badge key={t} variant="secondary" className="gap-1 pr-1">{t}<button onClick={() => setForm({ ...form, trucks: form.trucks.filter((x) => x !== t) })} className="hover:bg-slate-300 rounded-full p-0.5"><X className="h-3 w-3" /></button></Badge>)}</div>
            </div>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full bg-slate-900 hover:bg-slate-800">{saveMutation.isPending ? 'Saving...' : 'Save Company'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedCompanyDetailId} onOpenChange={(openState) => !openState && setSelectedCompanyDetailId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedCompanyDetail?.name || 'Company'} Details</SheetTitle>
          </SheetHeader>
          {selectedCompanyDetail && (
            <div className="mt-3 space-y-5 pb-6">
              {(() => {
                const companyDrivers = (driversByCompany.get(selectedCompanyDetail.id) || []).slice().sort((a, b) => (a.driver_name || '').localeCompare(b.driver_name || ''));
                const smsContact = getCompanySmsContact(selectedCompanyDetail);
                const ownerCodes = (ownerCodesByCompany.get(selectedCompanyDetail.id) || []).slice().sort((a, b) => (a.label || a.code || '').localeCompare(b.label || b.code || '', undefined, { sensitivity: 'base' }));

                return (
                  <>
                    <CompanyDetailHero
                      company={selectedCompanyDetail}
                      driverCount={companyDrivers.length}
                      truckCount={(selectedCompanyDetail.trucks || []).length}
                      smsStateLabel={smsContact.phone ? 'On file' : 'Not available'}
                    />

                    <DrawerSection title="1. Company Overview" icon={Briefcase}>
                      <div className="space-y-3 text-sm">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">Address</p>
                          <p className={`mt-2 whitespace-pre-line ${selectedCompanyDetail.address ? 'font-semibold text-slate-900' : 'font-medium italic text-slate-500'}`}>
                            {formatDisplayValue(selectedCompanyDetail.address)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">Contact methods</p>
                          <div className="mt-2 text-sm text-slate-900">
                            {renderContactMethodsList(selectedCompanyDetail.contact_methods, formatDisplayValue(selectedCompanyDetail.contact_info), selectedCompanyDetail.additional_contact_name || '')}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">Trucks</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(selectedCompanyDetail.trucks || []).length
                              ? selectedCompanyDetail.trucks.map((truck) => <Badge key={truck} variant="outline" className="font-mono text-xs">{truck}</Badge>)
                              : <span className="text-slate-500 italic">Not available</span>}
                          </div>
                        </div>
                      </div>
                    </DrawerSection>

                    <DrawerSection title="2. Company SMS / Compliance" icon={MessageSquare}>
                      <div className="space-y-3.5 text-sm">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SMS Configuration</p>
                          <div className="mt-2">
                            <KeyValueRow label="SMS contact" value={smsContact.phone ? formatPhoneNumber(smsContact.phone) : 'No SMS phone selected'} />
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company Owners & Individual SMS Compliance</p>
                            <Badge variant="secondary">{ownerCodes.length} active owner{ownerCodes.length === 1 ? '' : 's'}</Badge>
                          </div>
                          {ownerCodes.length === 0 ? (
                            <p className="mt-3 text-sm italic text-slate-500">No active company owners are currently linked to this company.</p>
                          ) : (
                            <div className="mt-3 space-y-3">
                              {ownerCodes.map((ownerCode, index) => (
                                <CompanyOwnerCard
                                  key={ownerCode.id || `${ownerCode.company_id}-${ownerCode.code}-${index}`}
                                  ownerCode={ownerCode}
                                  ownerUser={ownerCode?.used_by_user_id ? usersById.get(ownerCode.used_by_user_id) : null}
                                  ownerCount={index + 1}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </DrawerSection>

                    <DrawerSection title="3. Drivers" icon={UserRound}>
                      {companyDrivers.length === 0 ? (
                        <p className="text-sm text-slate-500">No drivers linked to this company.</p>
                      ) : (
                        <div className="space-y-3">
                          {companyDrivers.map((driver) => {
                            const smsState = getDriverSmsState(driver);
                            const driverCode = accessCodeById.get(driver.access_code_id);
                            const protocolAck = protocolAckByDriver.currentAckByDriver.get(driver.id);
                            const latestProtocolAck = protocolAckByDriver.latestAckByDriver.get(driver.id);
                            return (
                              <DriverAccordionCard
                                key={driver.id}
                                driver={driver}
                                smsState={smsState}
                                driverCode={driverCode}
                                protocolAck={protocolAck}
                                latestProtocolAck={latestProtocolAck}
                                currentProtocolVersion={currentActiveProtocol?.version_number}
                              />
                            );
                          })}
                        </div>
                      )}
                    </DrawerSection>

                    {selectedCompanyDetail.pending_profile_change?.status === 'Pending' && (
                      <DrawerSection title="4. Pending Profile Change Request" icon={Pencil}>
                        <div className="space-y-3 text-sm">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current</p>
                              <div className="mt-2 space-y-2 text-slate-700">
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Company name</p>
                                  <p>{selectedCompanyDetail.pending_profile_change.current_name || selectedCompanyDetail.name || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Address</p>
                                  <p className="whitespace-pre-line">{selectedCompanyDetail.pending_profile_change.current_address || selectedCompanyDetail.address || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Contact methods</p>
                                  {renderContactMethodsList(
                                    selectedCompanyDetail.pending_profile_change.current_contact_methods,
                                    selectedCompanyDetail.pending_profile_change.current_contact_info || selectedCompanyDetail.contact_info || '—',
                                    selectedCompanyDetail.pending_profile_change.current_additional_contact_name || selectedCompanyDetail.additional_contact_name || '',
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requested</p>
                              <div className="mt-2 space-y-2 text-slate-700">
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Company name</p>
                                  <p>{selectedCompanyDetail.pending_profile_change.requested_name || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Address</p>
                                  <p className="whitespace-pre-line">{selectedCompanyDetail.pending_profile_change.requested_address || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Contact methods</p>
                                  {renderContactMethodsList(
                                    selectedCompanyDetail.pending_profile_change.requested_contact_methods,
                                    selectedCompanyDetail.pending_profile_change.requested_contact_info || '—',
                                    selectedCompanyDetail.pending_profile_change.requested_additional_contact_name || '',
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="bg-slate-900 hover:bg-slate-800" onClick={() => reviewProfileChangeMutation.mutate({ companyId: selectedCompanyDetail.id, action: 'approve' })} disabled={reviewProfileChangeMutation.isPending}>Approve</Button>
                            <Button size="sm" variant="outline" onClick={() => reviewProfileChangeMutation.mutate({ companyId: selectedCompanyDetail.id, action: 'reject' })} disabled={reviewProfileChangeMutation.isPending}>Reject</Button>
                          </div>
                        </div>
                      </DrawerSection>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!selectedScoringCompany} onOpenChange={(openState) => !openState && setSelectedScoringCompany(null)}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader><DialogTitle>{selectedScoringCompany?.name} — Scoring Detail ({SCORING_PERIODS[periodKey].label})</DialogTitle></DialogHeader>
          <ScoringDetailDialog
            company={selectedScoringCompany}
            score={selectedScore}
            eventForm={eventForm}
            setEventForm={setEventForm}
            dispatchOptions={selectedCompanyDispatches}
            drivers={selectedCompanyDrivers}
            trucks={selectedScoringCompany?.trucks || []}
            isSaving={saveEventMutation.isPending}
            isDeleting={deleteEventMutation.isPending}
            onCreate={() => saveEventMutation.mutate({
              ...eventForm,
              company_id: selectedScoringCompany.id,
              event_date: eventForm.event_date ? new Date(eventForm.event_date).toISOString() : new Date().toISOString(),
            })}
            onDelete={(id) => deleteEventMutation.mutate(id)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
