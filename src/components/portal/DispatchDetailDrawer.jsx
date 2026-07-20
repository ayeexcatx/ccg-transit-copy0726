import React, { useMemo, useState, useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Truck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { canCompanyOwnerViewAssignmentsAndTimeLogs, statusBadgeColors } from './statusConfig';
import { filterTemplateNotesForDispatch, NOTE_DISPLAY_WIDTH, NOTE_TYPES, normalizeTemplateNote } from '@/lib/templateNotes';
import { calculateWorkedHours, formatTime24h, formatWorkedHours } from '@/lib/timeLogs';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import DispatchActivityLogSection from './DispatchActivityLogSection';
import DispatchTimeLogSection from './DispatchTimeLogSection';
import DispatchDriverConfirmationSection from './DispatchDriverConfirmationSection';
import DispatchDrawerTopBar from './DispatchDrawerTopBar';
import DispatchDrawerIdentitySection from './DispatchDrawerIdentitySection';
import DispatchDrawerStatusReasonBox from './DispatchDrawerStatusReasonBox';
import DispatchDrawerAssignmentsSection from './DispatchDrawerAssignmentsSection';
import DispatchDrawerTemplateNotesSection from './DispatchDrawerTemplateNotesSection';
import { getVisibleTrucksForDispatch } from '@/lib/dispatchVisibility';
import { getActiveCompanyId, getEffectiveView } from '@/components/session/workspaceUtils';
import { buildConfirmedTruckSetForStatus } from '@/components/notifications/confirmationStateHelpers';
import { deactivateDriverAssignment, sendDriverAssignment, upsertDriverAssignment } from '@/services/driverAssignmentMutationService';
import { appendDispatchActivityEntries, getSessionActorName } from '@/lib/dispatchActivity';
import { resolveCompanyOwnerCompanyId, resolveDriverIdentity } from '@/services/currentAppIdentityService';
import { listDriverDispatchesForDriver } from '@/lib/driverDispatch';

const UNASSIGNED_DRIVER_VALUE = '__unassigned__';
const DRIVER_SHIFT_CONFLICT_MESSAGE = 'That driver is already assigned on a different dispatch for the same shift. Please remove the driver from that assignment or select a different driver.';
let openDispatchDrawerCount = 0;

const OWNER_ASSIGNMENT_PREFIX = '__owner__:';

function normalizeOwnerAssignmentMap(value) {
  if (!value || typeof value !== 'object') return {};
  return value;
}

function buildOwnerSelectionValue(ownerId) {
  return `${OWNER_ASSIGNMENT_PREFIX}${ownerId}`;
}

function parseOwnerSelectionValue(value) {
  const normalized = String(value || '');
  if (!normalized.startsWith(OWNER_ASSIGNMENT_PREFIX)) return null;
  return normalized.slice(OWNER_ASSIGNMENT_PREFIX.length) || null;
}



function buildDriverAssignmentActivityEntries({ session, truckNumber, previousAssignment, nextAssignment }) {
  if (session?.code_type !== 'CompanyOwner') return [];

  const previousDriverId = previousAssignment?.driver_id || null;
  const nextDriverId = nextAssignment?.driver_id || null;
  if (previousDriverId === nextDriverId) return [];

  const actorName = getSessionActorName(session);
  const timestamp = new Date().toISOString();
  const previousDriverName = previousAssignment?.driver_name || 'Unknown driver';
  const nextDriverName = nextAssignment?.driver_name || 'Unknown driver';

  if (!previousDriverId && nextDriverId) {
    return [{
      timestamp,
      actor_type: 'CompanyOwner',
      actor_id: session?.id,
      actor_name: actorName,
      action: 'owner_assigned_driver',
      message: `${actorName} assigned driver ${nextDriverName} to Truck ${truckNumber}`
    }];
  }

  if (previousDriverId && !nextDriverId) {
    return [{
      timestamp,
      actor_type: 'CompanyOwner',
      actor_id: session?.id,
      actor_name: actorName,
      action: 'owner_removed_driver',
      message: `${actorName} removed driver ${previousDriverName} from Truck ${truckNumber}`
    }];
  }

  return [{
    timestamp,
    actor_type: 'CompanyOwner',
    actor_id: session?.id,
    actor_name: actorName,
    action: 'owner_changed_driver',
    message: `${actorName} changed driver from ${previousDriverName} to ${nextDriverName} on Truck ${truckNumber}`
  }];
}

function announceDispatchDrawerState() {
  if (typeof window === 'undefined') return;
  const isOpen = openDispatchDrawerCount > 0;
  window.__dispatchDetailDrawerOpen = isOpen;
  window.dispatchEvent(new CustomEvent('dispatch-detail-drawer-state', {
    detail: { open: isOpen }
  }));
}


function formatActivityTimestamp(value) {
  if (!value) return '';
  const date = parseTimestampForDisplay(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function parseTimestampForDisplay(value) {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);

  const raw = String(value).trim();
  if (!raw) return new Date(NaN);

  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw);
  if (hasExplicitTimezone) return new Date(raw);

  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  return new Date(`${normalized}Z`);
}
function formatTimeToAmPm(value) {
  if (!value) return '';
  const v = String(value).trim();

  if (/[ap]m$/i.test(v) || /\b[ap]m\b/i.test(v)) {
    return v.replace(/\s+/g, ' ').toUpperCase();
  }

  const m = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return v;

  let hh = parseInt(m[1], 10);
  const mm = m[2];
  if (Number.isNaN(hh) || hh < 0 || hh > 23) return v;

  const suffix = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12;
  if (hh === 0) hh = 12;

  return `${hh}:${mm} ${suffix}`;
}

function getEntryActorLabel(entry) {
  if (!entry) return '';
  const preferred = [
  entry.confirmed_by_name,
  entry.entered_by_name,
  entry.driver_name,
  entry.user_label,
  entry.access_code_label,
  entry.access_code_name,
  entry.label,
  entry.name];

  const explicit = preferred.find((value) => String(value || '').trim());
  if (explicit) return String(explicit).trim();

  if (String(entry.truck_number || '').trim()) return `Truck ${String(entry.truck_number).trim()}`;
  return '';
}

function formatLogTimestampWithActor(prefix, timestamp, actorLabel) {
  if (!timestamp) return '';
  const parsed = parseTimestampForDisplay(timestamp);
  if (Number.isNaN(parsed.getTime())) return '';
  const formattedTimestamp = parsed.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  return actorLabel ? `${prefix} by ${actorLabel} at ${formattedTimestamp}` : `${prefix} at ${formattedTimestamp}`;
}

function TruckTimeRow({
  truck,
  dispatch,
  timeEntries,
  readOnly,
  draft,
  onChangeDraft,
  showActor = false,
  isEditing = true,
  onEdit
}) {
  const existing = timeEntries.find((te) =>
  te.dispatch_id === dispatch.id && te.truck_number === truck
  );
  const start = draft?.start ?? existing?.start_time ?? '';
  const end = draft?.end ?? existing?.end_time ?? '';
  const workedHours = calculateWorkedHours(existing?.start_time, existing?.end_time);

  if (readOnly || !isEditing) {
    return (
      <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded px-3 py-2">
        <div className="flex items-center gap-2">
          <Truck className="h-3 w-3 text-slate-400" />
          <span className="font-mono font-medium">{truck}</span>
        </div>
        <span className="text-right">
          {existing ?
          <span className="text-slate-500">
              {formatTime24h(existing.start_time) || '—'} → {formatTime24h(existing.end_time) || '—'}
              {workedHours != null &&
            <span className="block text-[11px] text-slate-400">Total: {formatWorkedHours(workedHours)} hrs</span>
            }
              {showActor &&
            <span className="block text-[11px] text-slate-400">
                  {formatLogTimestampWithActor(
                'Entered',
                existing.last_updated_at || existing.updated_date || existing.created_date,
                existing.last_updated_by_name ||
                getEntryActorLabel(existing) ||
                'Unknown'
              )}
                </span>
            }
            </span> :

          <span className="text-slate-400 italic">No time logged</span>
          }
        </span>
        {!readOnly && onEdit &&
        <Button type="button" size="sm" variant="outline" className="ml-3 h-7 px-2 text-[11px]" onClick={onEdit}>
            Edit
          </Button>
        }
      </div>);

  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-3.5 sm:py-3">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100">
          <Truck className="h-3.5 w-3.5 text-slate-500" />
        </div>
        <span className="text-sm font-semibold text-slate-800">{truck}</span>
        {existing &&
        <div className="ml-auto text-right text-[11px] text-slate-500">
            <span className="font-medium">Saved: {formatTime24h(existing.start_time) || '—'} → {formatTime24h(existing.end_time) || '—'}</span>
            {workedHours != null &&
          <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-slate-400">Total: {formatWorkedHours(workedHours)} hrs</span>
          }
          </div>
        }
      </div>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-600">Check-in</p>
          <Input
            type="time"
            value={start}
            onChange={(e) => onChangeDraft(truck, 'start', e.target.value)}
            className="h-9 w-full text-sm" />
          
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-600">Check-out</p>
          <Input
            type="time"
            value={end}
            onChange={(e) => onChangeDraft(truck, 'end', e.target.value)}
            className="h-9 w-full text-sm" />
          
        </div>
      </div>
    </div>);

}

export default function DispatchDetailDrawer({
  dispatch, session, confirmations, timeEntries, templateNotes,
  onConfirm, onTimeEntry, onOwnerTruckUpdate, onAdminEditDispatch, companyName: _companyName, open, onClose
}) {
  const { currentAppIdentity } = useAuth();
  const [draftTimeEntries, setDraftTimeEntries] = useState({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [editingTimeLogTrucks, setEditingTimeLogTrucks] = useState({});
  const [optimisticTimeEntries, setOptimisticTimeEntries] = useState([]);
  const drawerScrollRef = React.useRef(null);
  const timeLogSectionRef = React.useRef(null);
  const [isEditingTrucks, setIsEditingTrucks] = useState(false);
  const [draftTrucks, setDraftTrucks] = useState([]);
  const [isSavingTrucks, setIsSavingTrucks] = useState(false);
  const [truckEditMessage, setTruckEditMessage] = useState(null);
  const [isCreatingScreenshot, setIsCreatingScreenshot] = useState(false);
  const [selectedDriverByTruck, setSelectedDriverByTruck] = useState({});
  const [driverAssignmentErrors, setDriverAssignmentErrors] = useState({});
  const [isInternalNotesDialogOpen, setIsInternalNotesDialogOpen] = useState(false);
  const [draftOwnerVisibleInternalNotes, setDraftOwnerVisibleInternalNotes] = useState('');
  const [draftAdminOnlyInternalNotes, setDraftAdminOnlyInternalNotes] = useState('');
  const screenshotSectionRef = React.useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setDraftTimeEntries({});
    setEditingTimeLogTrucks({});
    setOptimisticTimeEntries([]);
  }, [dispatch?.id]);

  useEffect(() => {
    if (!open) return undefined;

    openDispatchDrawerCount += 1;
    announceDispatchDrawerState();

    return () => {
      openDispatchDrawerCount = Math.max(0, openDispatchDrawerCount - 1);
      announceDispatchDrawerState();
    };
  }, [open]);

  useEffect(() => {
    setIsEditingTrucks(false);
    setDraftTrucks(dispatch?.trucks_assigned || []);
    setIsSavingTrucks(false);
    setTruckEditMessage(null);
  }, [dispatch?.id, dispatch?.trucks_assigned]);

  useEffect(() => {
    setDraftOwnerVisibleInternalNotes(dispatch?.owner_visible_internal_notes || '');
    setDraftAdminOnlyInternalNotes(dispatch?.admin_internal_notes || '');
    setIsInternalNotesDialogOpen(false);
  }, [dispatch?.id, dispatch?.owner_visible_internal_notes, dispatch?.admin_internal_notes]);

  useEffect(() => {
    if (!truckEditMessage) return undefined;

    const timeoutId = window.setTimeout(() => {
      setTruckEditMessage(null);
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [truckEditMessage]);

  const myTrucks = getVisibleTrucksForDispatch(session, dispatch);
  const effectiveView = getEffectiveView(session);
  const isOwner = effectiveView === 'CompanyOwner';
  const isAdmin = effectiveView === 'Admin';
  const isDriverUser = effectiveView === 'Driver';
  const driverIdentity = useMemo(
    () => resolveDriverIdentity({ currentAppIdentity, session }),
    [currentAppIdentity, session]
  );
  const activeOwnerCompanyId = useMemo(
    () => getActiveCompanyId(session),
    [session]
  );
  const ownerCompanyId = useMemo(
    () => activeOwnerCompanyId || resolveCompanyOwnerCompanyId({ currentAppIdentity, session }),
    [activeOwnerCompanyId, currentAppIdentity, session]
  );

  const { data: ownerCompanyRecord = null } = useQuery({
    queryKey: ['company-owner-trucks', ownerCompanyId],
    queryFn: async () => {
      const companies = await base44.entities.Company.filter({ id: ownerCompanyId }, '-created_date', 1);
      return companies?.[0] || null;
    },
    enabled: open && isOwner && !!ownerCompanyId
  });

  const { data: ownerAccessCodes = [] } = useQuery({
    queryKey: ['owner-access-codes', dispatch?.company_id],
    queryFn: () => base44.entities.AccessCode.filter({
      company_id: dispatch.company_id,
      code_type: 'CompanyOwner',
      active_flag: true,
    }, '-created_date', 500),
    enabled: open && isOwner && !!dispatch?.company_id,
  });

  const { data: companyDrivers = [] } = useQuery({
    queryKey: ['drivers', dispatch?.company_id],
    queryFn: () => base44.entities.Driver.filter({ company_id: dispatch.company_id }, '-driver_name', 500),
    enabled: open && isOwner && !!dispatch?.company_id
  });

  const eligibleDrivers = useMemo(
    () => companyDrivers.filter((driver) => {
      const isActive = driver.active_flag !== false && (driver.status || 'Active') === 'Active';
      return isActive && driver.access_code_status === 'Created';
    }),
    [companyDrivers]
  );

  const { data: driverAssignments = [], refetch: refetchDriverAssignments } = useQuery({
    queryKey: ['driver-dispatch-assignments', dispatch?.id],
    queryFn: () => base44.entities.DriverDispatch.filter({ dispatch_id: dispatch.id }, '-created_date', 500),
    enabled: open && (isOwner || isAdmin) && !!dispatch?.id
  });



  const { data: currentDriverAssignments = [] } = useQuery({
    queryKey: ['driver-dispatch-assignments', dispatch?.id, driverIdentity],
    queryFn: async () => (await listDriverDispatchesForDriver(driverIdentity)).filter((entry) => String(entry.dispatch_id) === String(dispatch.id)),
    enabled: open && isDriverUser && !!dispatch?.id && !!driverIdentity
  });

  const ownerAssignmentByTruck = useMemo(() => normalizeOwnerAssignmentMap(dispatch?.owner_assignment_by_truck), [dispatch?.owner_assignment_by_truck]);

  useEffect(() => {
    if (!isOwner || !dispatch?.id) return;

    const next = {};
    (dispatch.trucks_assigned || []).forEach((truckNumber) => {
      const assignment = driverAssignments.find((entry) => entry.truck_number === truckNumber && entry.active_flag !== false);
      const ownerAssignment = ownerAssignmentByTruck[truckNumber];
      next[truckNumber] = assignment?.driver_id || (ownerAssignment?.owner_access_code_id ? buildOwnerSelectionValue(ownerAssignment.owner_access_code_id) : UNASSIGNED_DRIVER_VALUE);
    });
    setSelectedDriverByTruck(next);
    setDriverAssignmentErrors({});
  }, [isOwner, dispatch?.id, dispatch?.trucks_assigned, driverAssignments, ownerAssignmentByTruck]);

  const { data: conflictingDriverAssignmentsById = {} } = useQuery({
    queryKey: ['driver-shift-conflicts', dispatch?.id, dispatch?.company_id, dispatch?.date, dispatch?.shift_time],
    enabled: open && isOwner && !!dispatch?.id && !!dispatch?.company_id && !!dispatch?.date && !!dispatch?.shift_time,
    queryFn: async () => {
      const sameShiftDispatches = await base44.entities.Dispatch.filter({
        company_id: dispatch.company_id,
        date: dispatch.date,
        shift_time: dispatch.shift_time
      }, '-created_date', 500);

      const conflictingDispatches = (sameShiftDispatches || []).filter((candidate) =>
      candidate?.id &&
      candidate.id !== dispatch.id &&
      candidate.status !== 'Cancelled'
      );

      if (!conflictingDispatches.length) return {};

      const dispatchIds = new Set(conflictingDispatches.map((candidate) => candidate.id));
      const assignmentsByDispatch = await Promise.all(
        conflictingDispatches.map((candidate) =>
        base44.entities.DriverDispatch.filter({
          dispatch_id: candidate.id,
          active_flag: true
        }, '-created_date', 200)
        )
      );

      return assignmentsByDispatch.flat().reduce((map, assignment) => {
        if (!assignment?.driver_id || !dispatchIds.has(assignment.dispatch_id)) return map;
        if (!map[assignment.driver_id]) map[assignment.driver_id] = assignment;
        return map;
      }, {});
    }
  });

  const assignDriverMutation = useMutation({
    mutationFn: async ({ truckNumber, driverId }) => {
      const previousAssignments = [...driverAssignments];
      const driver = eligibleDrivers.find((entry) => entry.id === driverId);
      if (!driver) throw new Error('Selected driver was not found.');

      const sameShiftDispatches = await base44.entities.Dispatch.filter({
        company_id: dispatch.company_id,
        date: dispatch.date,
        shift_time: dispatch.shift_time
      }, '-created_date', 500);

      const conflictingDispatchIds = new Set((sameShiftDispatches || []).
      filter((candidate) =>
      candidate?.id &&
      candidate.id !== dispatch.id &&
      candidate.status !== 'Cancelled'
      ).
      map((candidate) => candidate.id));

      if (conflictingDispatchIds.size > 0) {
        const driverActiveAssignments = await base44.entities.DriverDispatch.filter({
          driver_id: driverId,
          active_flag: true
        }, '-created_date', 500);

        const hasConflict = (driverActiveAssignments || []).some((assignment) =>
        conflictingDispatchIds.has(assignment.dispatch_id)
        );

        if (hasConflict) {
          throw new Error(DRIVER_SHIFT_CONFLICT_MESSAGE);
        }
      }

      const existing = driverAssignments.find((entry) => entry.truck_number === truckNumber);
      const { savedAssignment } = await upsertDriverAssignment({
        dispatch,
        driverAssignments: previousAssignments,
        truckNumber,
        driver,
        session,
        buildActivityEntries: ({ truckNumber: nextTruckNumber, previousAssignment, nextAssignment }) =>
        buildDriverAssignmentActivityEntries({
          session,
          truckNumber: nextTruckNumber,
          previousAssignment,
          nextAssignment
        }),
        appendActivityEntries: (_dispatch, entries) => appendDispatchActivityEntries(dispatch.id, entries)
      });

      return savedAssignment;
    },
    onSuccess: async () => {
      await refetchDriverAssignments();
      queryClient.invalidateQueries({ queryKey: ['portal-dispatches', dispatch?.company_id] });
      queryClient.invalidateQueries({ queryKey: ['dispatches-admin'] });
      queryClient.invalidateQueries({ queryKey: ['driver-dispatch-assignments', dispatch?.id] });
      toast.success('Driver assignment saved.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Unable to save driver assignment.');
    }
  });

  const sendDriverDispatchMutation = useMutation({
    mutationFn: async (truckNumber) => {
      const row = driverAssignments.find((entry) => entry.truck_number === truckNumber && entry.active_flag !== false);
      if (!row?.id) throw new Error('Select a driver first.');
      return sendDriverAssignment({ dispatch, driverDispatch: row, session });
    },
    onSuccess: async () => {
      await refetchDriverAssignments();
      queryClient.invalidateQueries({ queryKey: ['driver-dispatch-assignments', dispatch?.id] });
      queryClient.invalidateQueries({ queryKey: ['driver-dispatch-assignments', driverIdentity] });
      toast.success('Dispatch sent to driver.');
    },
    onError: (error) => toast.error(error?.message || 'Unable to send dispatch.')
  });

  const cancelDriverDispatchMutation = useMutation({
    mutationFn: async (truckNumber) => deactivateDriverAssignment({ dispatch, driverAssignments, truckNumber, session }),
    onSuccess: async () => {
      await refetchDriverAssignments();
      queryClient.invalidateQueries({ queryKey: ['driver-dispatch-assignments', dispatch?.id] });
      queryClient.invalidateQueries({ queryKey: ['driver-dispatch-assignments', driverIdentity] });
      toast.success('Driver dispatch cancelled.');
    },
    onError: (error) => toast.error(error?.message || 'Unable to cancel driver dispatch.')
  });

  const handleSendDriverDispatch = async (truckNumber) => sendDriverDispatchMutation.mutateAsync(truckNumber);
  const handleCancelDriverDispatch = async (truckNumber) => cancelDriverDispatchMutation.mutateAsync(truckNumber);
  const saveInternalNotesMutation = useMutation({
    mutationFn: async ({ ownerVisibleInternalNotes, adminOnlyInternalNotes }) => {
      if (!dispatch?.id) throw new Error('Dispatch not found.');
      return base44.entities.Dispatch.update(dispatch.id, {
        owner_visible_internal_notes: ownerVisibleInternalNotes.trim() || null,
        admin_internal_notes: adminOnlyInternalNotes.trim() || null
      });
    },
    onSuccess: async (_, { ownerVisibleInternalNotes, adminOnlyInternalNotes }) => {
      const normalizedOwnerVisibleNotes = ownerVisibleInternalNotes.trim();
      const normalizedAdminOnlyNotes = adminOnlyInternalNotes.trim();
      queryClient.setQueryData(['dispatches-admin'], (current) => {
        if (!Array.isArray(current)) return current;
        return current.map((entry) =>
        entry?.id === dispatch?.id ?
        {
          ...entry,
          owner_visible_internal_notes: normalizedOwnerVisibleNotes,
          admin_internal_notes: normalizedAdminOnlyNotes
        } :
        entry
        );
      });
      queryClient.setQueryData(['dispatch-admin-overlay-target', String(dispatch?.id || '')], (current) => {
        if (!current || current?.id !== dispatch?.id) return current;
        return {
          ...current,
          owner_visible_internal_notes: normalizedOwnerVisibleNotes,
          admin_internal_notes: normalizedAdminOnlyNotes
        };
      });
      queryClient.setQueryData(['portal-dispatches', dispatch?.company_id], (current) => {
        if (!Array.isArray(current)) return current;
        return current.map((entry) =>
        entry?.id === dispatch?.id ?
        {
          ...entry,
          owner_visible_internal_notes: normalizedOwnerVisibleNotes,
          admin_internal_notes: normalizedAdminOnlyNotes
        } :
        entry
        );
      });
      queryClient.invalidateQueries({ queryKey: ['dispatches-admin'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-admin-overlay-target', String(dispatch?.id || '')] });
      queryClient.invalidateQueries({ queryKey: ['portal-dispatches', dispatch?.company_id] });
      setIsInternalNotesDialogOpen(false);
      toast.success('Internal notes saved.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Unable to save internal notes.');
    }
  });

  const handleDriverSelection = async (truckNumber, driverId) => {
    const previousDriverId = selectedDriverByTruck[truckNumber] || UNASSIGNED_DRIVER_VALUE;
    setSelectedDriverByTruck((prev) => ({ ...prev, [truckNumber]: driverId }));
    setDriverAssignmentErrors((prev) => ({ ...prev, [truckNumber]: null }));

    const ownerSelectionId = parseOwnerSelectionValue(driverId);
    const actorName = getSessionActorName(session);
    const timestamp = new Date().toISOString();

    const persistOwnerAssignment = async (ownerCode) => {
      const nextMap = { ...ownerAssignmentByTruck };
      nextMap[truckNumber] = {
        owner_access_code_id: ownerCode.id,
        owner_name: ownerCode.label || ownerCode.name || ownerCode.code || 'Owner',
        updated_at: timestamp,
        updated_by_owner_access_code_id: session?.id || null,
      };
      await base44.entities.Dispatch.update(dispatch.id, { owner_assignment_by_truck: nextMap });
      await appendDispatchActivityEntries(dispatch.id, [{
        timestamp,
        actor_type: 'CompanyOwner',
        actor_id: session?.id,
        actor_name: actorName,
        action: 'owner_selected_owner_assignment',
        message: `${actorName} selected ${nextMap[truckNumber].owner_name} (Owner) for Truck ${truckNumber}`,
      }]);
      queryClient.invalidateQueries({ queryKey: ['portal-dispatches', dispatch?.company_id] });
      queryClient.invalidateQueries({ queryKey: ['dispatches-admin'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-admin-overlay-target', String(dispatch?.id || '')] });
      queryClient.invalidateQueries({ queryKey: ['driver-dispatch-assignments', dispatch?.id] });
    };

    if (driverId === UNASSIGNED_DRIVER_VALUE) {
      await deactivateDriverAssignment({
        dispatch,
        driverAssignments,
        truckNumber,
        session,
        suppressDriverNotification: true,
      });
      const nextMap = { ...ownerAssignmentByTruck };
      delete nextMap[truckNumber];
      await base44.entities.Dispatch.update(dispatch.id, { owner_assignment_by_truck: nextMap });
      await refetchDriverAssignments();
      queryClient.invalidateQueries({ queryKey: ['portal-dispatches', dispatch?.company_id] });
      queryClient.invalidateQueries({ queryKey: ['dispatches-admin'] });
      queryClient.invalidateQueries({ queryKey: ['driver-dispatch-assignments', dispatch?.id] });
      toast.success('Assignment cleared.');
      return;
    }

    if (ownerSelectionId) {
      const selectedOwner = ownerAccessCodes.find((entry) => String(entry.id) === String(ownerSelectionId));
      if (!selectedOwner) {
        setSelectedDriverByTruck((prev) => ({ ...prev, [truckNumber]: previousDriverId }));
        toast.error('Selected owner was not found.');
        return;
      }

      await deactivateDriverAssignment({
        dispatch,
        driverAssignments,
        truckNumber,
        session,
        suppressDriverNotification: true,
      });
      await persistOwnerAssignment(selectedOwner);
      await refetchDriverAssignments();
      toast.success('Owner assignment updated.');
      return;
    }

    try {
      await assignDriverMutation.mutateAsync({ truckNumber, driverId });
      if (ownerAssignmentByTruck[truckNumber]) {
        const nextMap = { ...ownerAssignmentByTruck };
        delete nextMap[truckNumber];
        await base44.entities.Dispatch.update(dispatch.id, { owner_assignment_by_truck: nextMap });
      }
    } catch (error) {
      setSelectedDriverByTruck((prev) => ({ ...prev, [truckNumber]: previousDriverId }));
      if (error?.message === DRIVER_SHIFT_CONFLICT_MESSAGE) {
        setDriverAssignmentErrors((prev) => ({ ...prev, [truckNumber]: DRIVER_SHIFT_CONFLICT_MESSAGE }));
      }
    }
  };

  const effectiveTimeEntries = useMemo(() => {
    if (!optimisticTimeEntries.length) return timeEntries;

    const keyFor = (entry) => `${entry.dispatch_id}::${entry.truck_number}`;
    const optimisticByKey = optimisticTimeEntries.reduce((map, entry) => {
      if (!entry?.dispatch_id || !entry?.truck_number) return map;
      map[keyFor(entry)] = entry;
      return map;
    }, {});

    const merged = timeEntries.map((entry) => optimisticByKey[keyFor(entry)] || entry);
    const existingKeys = new Set(merged.map(keyFor));
    optimisticTimeEntries.forEach((entry) => {
      const key = keyFor(entry);
      if (!existingKeys.has(key)) merged.push(entry);
    });

    return merged;
  }, [timeEntries, optimisticTimeEntries]);

  if (!dispatch) return null;

  const activeDriverDispatches = driverAssignments.filter((entry) => entry?.active_flag !== false);
  const driverAssignedTrucks = currentDriverAssignments.
  filter((entry) => entry?.active_flag !== false).
  map((entry) => entry.truck_number).
  filter(Boolean);

  const visibleTrucks = getVisibleTrucksForDispatch(session, dispatch, {
    driverAssignedTrucks
  });
  const activeAssignmentsByTruck = (isOwner || isAdmin ? activeDriverDispatches : currentDriverAssignments).
  filter((entry) => entry?.active_flag !== false && entry?.truck_number).
  reduce((map, entry) => {
    map[entry.truck_number] = entry;
    return map;
  }, {});

  const hasTruckSeenStatus = (truckNumber) => Boolean(activeAssignmentsByTruck[truckNumber]?.last_seen_at);
  const latestDriverDispatchByTruck = driverAssignments.
  filter((entry) => entry?.truck_number).
  sort((a, b) => new Date(b.updated_date || b.cancelled_at || b.sent_at || b.created_date || 0) - new Date(a.updated_date || a.cancelled_at || a.sent_at || a.created_date || 0)).
  reduce((map, entry) => {
    if (!map[entry.truck_number]) map[entry.truck_number] = entry;
    return map;
  }, {});
  const driverDispatchByTruck = { ...latestDriverDispatchByTruck, ...activeAssignmentsByTruck };

  const assignedDriverNameByTruck = activeDriverDispatches.
  filter((entry) => entry?.active_flag !== false).
  reduce((map, entry) => {
    if (!entry?.truck_number || !entry?.driver_name) return map;
    map[entry.truck_number] = entry.driver_name;
    return map;
  }, {});

  const eligibleDriverNameById = eligibleDrivers.reduce((map, driver) => {
    if (!driver?.id || !driver?.driver_name) return map;
    map[driver.id] = driver.driver_name;
    return map;
  }, {});

  const companyHasDrivers = companyDrivers.length > 0;
  const ownerCount = ownerAccessCodes.length;
  const canUseOwnerInformationalAssignments = isOwner && (ownerCount > 1 || companyHasDrivers);
  const ownerOptions = canUseOwnerInformationalAssignments
    ? ownerAccessCodes.map((ownerCode) => ({
      id: ownerCode.id,
      label: ownerCode.label || ownerCode.name || ownerCode.code || 'Owner',
    }))
    : [];
  const shouldShowDriverAssignmentControls = !isOwner || companyHasDrivers || canUseOwnerInformationalAssignments;
  const shouldShowUnassignedDriverLabel = shouldShowDriverAssignmentControls;

  const getTruckDriverSummaryLabel = (truckNumber) => {
    if (!isOwner) {
      const assignedDriverName = assignedDriverNameByTruck[truckNumber];
      if (assignedDriverName) return assignedDriverName;

      if (isAdmin) {
        const ownerAssignment = ownerAssignmentByTruck[truckNumber];
        if (ownerAssignment?.owner_name) return `${ownerAssignment.owner_name} (Owner)`;
      }

      return 'Unassigned';
    }

    const selectedDriverId = selectedDriverByTruck[truckNumber];
    const selectedOwnerId = parseOwnerSelectionValue(selectedDriverId);
    if (selectedOwnerId) {
      const selectedOwner = ownerOptions.find((owner) => String(owner.id) === String(selectedOwnerId));
      if (selectedOwner?.label) return `${selectedOwner.label} (Owner)`;
      const ownerAssignment = ownerAssignmentByTruck[truckNumber];
      if (ownerAssignment?.owner_name) return `${ownerAssignment.owner_name} (Owner)`;
      return 'Owner (Owner)';
    }
    if (selectedDriverId === UNASSIGNED_DRIVER_VALUE) {
      const ownerAssignment = ownerAssignmentByTruck[truckNumber];
      if (ownerAssignment?.owner_name) return `${ownerAssignment.owner_name} (Owner)`;
      return shouldShowUnassignedDriverLabel ? 'No driver assigned' : null;
    }
    if (selectedDriverId && eligibleDriverNameById[selectedDriverId]) {
      return eligibleDriverNameById[selectedDriverId];
    }

    return assignedDriverNameByTruck[truckNumber] || (shouldShowUnassignedDriverLabel ? 'No driver assigned' : null);
  };

  const currentConfType = dispatch.status;
  const hasOwnerVisibleInternalNotes = Boolean(String(dispatch?.owner_visible_internal_notes || '').trim());
  const hasAdminOnlyInternalNotes = Boolean(String(dispatch?.admin_internal_notes || '').trim());
  const hasInternalNotes = hasOwnerVisibleInternalNotes || hasAdminOnlyInternalNotes;
  const hasNoInternalNotes = !hasOwnerVisibleInternalNotes && !hasAdminOnlyInternalNotes;
  const currentConfirmedTruckSet = buildConfirmedTruckSetForStatus({
    confirmations,
    dispatchId: dispatch.id,
    status: currentConfType
  });
  const hasAdditional = Array.isArray(dispatch.additional_assignments) && dispatch.additional_assignments.length > 0;

  const dispatchScopedTemplateNotes = filterTemplateNotesForDispatch(templateNotes || [], dispatch?.job_number || '');
  const normalizedTemplateNotes = dispatchScopedTemplateNotes.map(normalizeTemplateNote);
  const boxNotes = normalizedTemplateNotes.filter((n) => n.note_type === NOTE_TYPES.BOX);
  const generalNotes = normalizedTemplateNotes.filter((n) => n.note_type !== NOTE_TYPES.BOX);

  const isTruckConfirmedForCurrent = (truck) => currentConfirmedTruckSet.has(truck);

  const getTruckCurrentConfirmation = (truck) =>
  confirmations.find((c) =>
  c.dispatch_id === dispatch.id &&
  c.truck_number === truck &&
  c.confirmation_type === currentConfType
  );

  const getTruckPriorConfirmations = (truck) =>
  confirmations.
  filter((c) =>
  c.dispatch_id === dispatch.id &&
  c.truck_number === truck &&
  c.confirmation_type !== currentConfType
  ).
  sort((a, b) => new Date(b.confirmed_at || 0) - new Date(a.confirmed_at || 0));

  const handleChangeDraft = (truck, field, value) => {
    setDraftTimeEntries((prev) => ({
      ...prev,
      [truck]: {
        ...(prev[truck] || {}),
        [field]: value
      }
    }));
  };

  const editableTimeLogTrucks = isOwner ?
  myTrucks :
  isDriverUser ?
  visibleTrucks :
  isAdmin ?
  (dispatch.trucks_assigned || []) :
  [];

  const entriesToSave = editableTimeLogTrucks.
  map((truck) => {
    const existing = effectiveTimeEntries.find((te) => te.dispatch_id === dispatch.id && te.truck_number === truck);
    const start = draftTimeEntries[truck]?.start ?? existing?.start_time ?? '';
    const end = draftTimeEntries[truck]?.end ?? existing?.end_time ?? '';
    if (!start && !end) return null;
    return { truck, start, end };
  }).
  filter(Boolean);

  const hasUnsavedChanges = editableTimeLogTrucks.some((truck) => {
    const draft = draftTimeEntries[truck];
    if (!draft) return false;
    const existing = effectiveTimeEntries.find((te) => te.dispatch_id === dispatch.id && te.truck_number === truck);
    const currentStart = existing?.start_time ?? '';
    const currentEnd = existing?.end_time ?? '';
    const nextStart = draft.start ?? currentStart;
    const nextEnd = draft.end ?? currentEnd;
    return nextStart !== currentStart || nextEnd !== currentEnd;
  });

  const handleSaveAll = async () => {
    if (entriesToSave.length === 0 || !hasUnsavedChanges) return;
    setIsSavingAll(true);
    const previousScrollTop = drawerScrollRef.current?.scrollTop;

    try {
      const savedEntries = await onTimeEntry(dispatch, entriesToSave);
      if (Array.isArray(savedEntries) && savedEntries.length > 0) {
        setOptimisticTimeEntries((prev) => {
          const keyFor = (entry) => `${entry.dispatch_id}::${entry.truck_number}`;
          const merged = [...prev];
          savedEntries.forEach((entry) => {
            const key = keyFor(entry);
            const index = merged.findIndex((candidate) => keyFor(candidate) === key);
            if (index >= 0) merged[index] = entry;
            else merged.push(entry);
          });
          return merged;
        });
      }
      setDraftTimeEntries({});
      setEditingTimeLogTrucks((prev) => {
        const next = { ...prev };
        entriesToSave.forEach(({ truck }) => {
          delete next[truck];
        });
        return next;
      });
      requestAnimationFrame(() => {
        if (typeof previousScrollTop === 'number' && drawerScrollRef.current) {
          drawerScrollRef.current.scrollTop = previousScrollTop;
          return;
        }
        timeLogSectionRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleConfirmTruck = (truck) => {
    onConfirm(dispatch, truck, currentConfType);
  };
  const handleSaveInternalNotes = async () => {
    await saveInternalNotesMutation.mutateAsync({
      ownerVisibleInternalNotes: draftOwnerVisibleInternalNotes,
      adminOnlyInternalNotes: draftAdminOnlyInternalNotes
    });
  };


  const ownerTruckOptions = isOwner ?
  Array.isArray(ownerCompanyRecord?.trucks) ? ownerCompanyRecord.trucks : [] :
  [];
  const showOwnerAssignmentsAndTimeLogs = !isOwner || canCompanyOwnerViewAssignmentsAndTimeLogs(dispatch.status);
  const requiredTruckCount = (dispatch?.trucks_assigned || []).filter(Boolean).length;

  const resetDraftTrucksToCurrentDispatch = () => {
    setDraftTrucks(dispatch?.trucks_assigned || []);
  };

  const resetTruckEditing = () => {
    setIsEditingTrucks(false);
    resetDraftTrucksToCurrentDispatch();
    setTruckEditMessage(null);
  };

  const handleDrawerClose = () => {
    resetTruckEditing();
    onClose();
  };

  const toggleDraftTruck = (truck) => {
    setDraftTrucks((prev) =>
    prev.includes(truck) ?
    prev.filter((item) => item !== truck) :
    [...prev, truck]
    );
  };

  const handleSaveTrucks = async () => {
    if (!onOwnerTruckUpdate) return;
    setTruckEditMessage(null);
    const nextTrucks = [...new Set(draftTrucks.filter(Boolean))];

    if (nextTrucks.length !== requiredTruckCount) {
      setTruckEditMessage({
        type: 'error',
        text: `Truck count must remain ${requiredTruckCount}. Replace trucks one-for-one before saving.`
      });
      resetDraftTrucksToCurrentDispatch();
      return;
    }

    setIsSavingTrucks(true);
    try {
      const result = await onOwnerTruckUpdate(dispatch, nextTrucks);
      if (result?.updated) {
        resetTruckEditing();
      }
    } catch (error) {
      setTruckEditMessage({
        type: 'error',
        text: error?.message || 'Unable to update truck assignments.'
      });
      resetDraftTrucksToCurrentDispatch();
    } finally {
      setIsSavingTrucks(false);
    }
  };

  const hasTruckDraftChanges = (() => {
    const current = [...new Set((dispatch?.trucks_assigned || []).filter(Boolean))].sort();
    const next = [...new Set(draftTrucks.filter(Boolean))].sort();
    if (current.length !== next.length) return true;
    return current.some((truck, index) => truck !== next[index]);
  })();

  // Safe date display: use parseISO to avoid timezone shift on YYYY-MM-DD strings
  const displayDate = dispatch.date ?
  format(parseISO(dispatch.date), 'EEE, MMM d, yyyy') :
  '';


  const handleReportIncident = () => {
    const params = new URLSearchParams();
    params.set('create', '1');
    params.set('fromDispatch', '1');
    params.set('dispatchId', dispatch.id);

    if (dispatch.company_id) {
      params.set('companyId', dispatch.company_id);
    }

    if (visibleTrucks.length === 1) {
      params.set('truckNumber', visibleTrucks[0]);
    }

    handleDrawerClose();
    window.location.href = createPageUrl(`Incidents?${params.toString()}`);
  };

  const handleScreenshotDispatch = async () => {
    if (isEditingTrucks) {
      toast.error('Finish editing trucks before creating a screenshot.');
      return;
    }

    const target = screenshotSectionRef.current;
    if (!target) {
      toast.error('Dispatch details are not ready to capture yet.');
      return;
    }

    setIsCreatingScreenshot(true);
    let screenshotRoot;
    try {
      screenshotRoot = document.createElement('div');
      screenshotRoot.style.position = 'fixed';
      screenshotRoot.style.left = '-10000px';
      screenshotRoot.style.top = '0';
      screenshotRoot.style.width = `${Math.max(360, Math.min(target.scrollWidth || 420, 720))}px`;
      screenshotRoot.style.padding = '20px';
      screenshotRoot.style.background = '#ffffff';
      screenshotRoot.style.boxSizing = 'border-box';
      screenshotRoot.style.zIndex = '-1';

      const clone = target.cloneNode(true);
      clone.setAttribute('data-screenshot-export-clone', 'true');
      clone.querySelectorAll('[data-screenshot-exclude="true"]').forEach((node) => node.remove());
      clone.querySelectorAll('[data-screenshot-only="true"]').forEach((node) => node.classList.remove('hidden'));

      screenshotRoot.appendChild(clone);
      document.body.appendChild(screenshotRoot);

      const canvas = await html2canvas(screenshotRoot, {
        backgroundColor: '#ffffff',
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: screenshotRoot.scrollWidth,
        windowHeight: screenshotRoot.scrollHeight
      });

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to generate screenshot image.');

      const fileNameDate = dispatch?.date || format(new Date(), 'yyyy-MM-dd');
      const fileName = `dispatch-${fileNameDate}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      const canShareFile = typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] });

      if (canShareFile) {
        await navigator.share({ files: [file], title: 'Dispatch Screenshot' });
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      }

      toast.success('Dispatch screenshot created.');
    } catch (error) {
      toast.error(error?.message || 'Unable to create dispatch screenshot on this device/browser.');
    } finally {
      if (screenshotRoot?.parentNode) {
        screenshotRoot.parentNode.removeChild(screenshotRoot);
      }
      setIsCreatingScreenshot(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => {if (!v) handleDrawerClose();}}>
      <SheetContent
        ref={drawerScrollRef}
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto p-0"
        data-tutorial-scroll="drawer">
        
        <DispatchDrawerTopBar
          dispatch={dispatch}
          session={session}
          displayDate={displayDate}
          isOwner={isOwner}
          isAdmin={isAdmin}
          isDriverUser={isDriverUser}
          open={open}
          onBack={handleDrawerClose}
          isCreatingScreenshot={isCreatingScreenshot}
          isEditingTrucks={isEditingTrucks}
          onReportIncident={handleReportIncident}
          onScreenshotDispatch={handleScreenshotDispatch}
          onAdminEditDispatch={() => onAdminEditDispatch?.(dispatch)} />
        

        <div className="px-5 py-5 space-y-6">
          <div ref={screenshotSectionRef} className="space-y-6 bg-white">
            <div data-screenshot-only="true" className="hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge
                    data-screenshot-badge-top="true"
                    className={`${statusBadgeColors[dispatch.status]} inline-flex h-6 items-center justify-center border px-2.5 text-xs font-medium leading-none`}>
                    {dispatch.status}
                  </Badge>
                  <span className="text-sm text-slate-600">{dispatch.shift_time}</span>
                </div>
                <span className="text-lg font-bold text-slate-800">{displayDate}</span>
              </div>
              <div className="mt-3 border-t border-slate-200" />
            </div>
            <DispatchDrawerIdentitySection
              dispatch={dispatch}
              isAdmin={isAdmin}
              isOwner={isOwner}
              visibleTrucks={visibleTrucks}
              getTruckDriverSummaryLabel={getTruckDriverSummaryLabel}
              hasTruckSeenStatus={hasTruckSeenStatus}
              isEditingTrucks={isEditingTrucks}
              onToggleEditingTrucks={() => {
                if (isEditingTrucks) {
                  resetTruckEditing();
                  return;
                }
                setTruckEditMessage(null);
                setIsEditingTrucks((prev) => !prev);
              }}
              requiredTruckCount={requiredTruckCount}
              ownerTruckOptions={ownerTruckOptions}
              draftTrucks={draftTrucks}
              toggleDraftTruck={toggleDraftTruck}
              truckEditMessage={truckEditMessage}
              hasTruckDraftChanges={hasTruckDraftChanges}
              isSavingTrucks={isSavingTrucks}
              onSaveTrucks={handleSaveTrucks} />

            {(isAdmin || isOwner && hasOwnerVisibleInternalNotes) &&
            <section
              className="rounded-xl border border-red-200 bg-red-50/40 px-3.5 py-3"
              data-screenshot-exclude="true">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-700">Internal Notes</p>
                  {isAdmin &&
                  <Button
                  type="button"
                  size="sm"
                  variant={hasNoInternalNotes ? 'default' : 'outline'}
                  className={hasNoInternalNotes ?
                  'h-7 bg-red-600 px-3 text-white hover:bg-red-700' :
                  'h-7 border-red-300 text-red-700 hover:bg-red-100/80 hover:text-red-800'}
                  onClick={() => setIsInternalNotesDialogOpen(true)}>
                    {hasNoInternalNotes ? 'Add Note' : 'Internal Notes'}
                    {hasInternalNotes &&
                  <span className="ml-2 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                        Notes Added
                      </span>
                  }
                  </Button>
                  }
                </div>

                {!hasNoInternalNotes &&
              <>
                    <div className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">Owner-Visible Internal Note</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                        {hasOwnerVisibleInternalNotes ? dispatch.owner_visible_internal_notes : 'No owner-visible note saved.'}
                      </p>
                    </div>

                    {isAdmin &&
                <div className="mt-3">
                        <div className="mb-2 border-t border-dotted border-red-300" />
                        <div className="rounded-lg bg-red-600 px-3 py-2.5 text-white">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-white">Admin Only</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white">
                            {hasAdminOnlyInternalNotes ? dispatch.admin_internal_notes : 'No admin-only note saved.'}
                          </p>
                        </div>
                      </div>
                }
                  </>
              }
              </section>
            }

          {dispatch.status !== 'Scheduled' &&
            <>
              <DispatchDrawerStatusReasonBox dispatch={dispatch} />
              <DispatchDrawerAssignmentsSection
                dispatch={dispatch}
                hasAdditional={hasAdditional}
                formatTimeToAmPm={formatTimeToAmPm}
                visibleTrucks={visibleTrucks} />
              
            </>
            }

          {dispatch.status !== 'Scheduled' &&
            <DispatchDrawerTemplateNotesSection
              boxNotes={boxNotes}
              generalNotes={generalNotes}
              NOTE_DISPLAY_WIDTH={NOTE_DISPLAY_WIDTH} />

            }
          </div>

          {/* Actions */}
          {(isOwner || isAdmin || isDriverUser) &&
          <div className="space-y-4 pt-2">
              <div className="pt-2 border-t-2 border-slate-200">
                <section className="bg-stone-400 p-3.5 rounded-2xl border border-slate-200 sm:p-4 space-y-3.5">
                  <div className="bg-stone-600 text-slate-50 px-3 py-2.5 rounded-xl border border-slate-200">
                    <p className="text-neutral-100 font-semibold uppercase tracking-[0.14em] flex items-center gap-2">OPERATIONS PANEL


                  </p>
                    <p className="text-slate-50 mt-1 text-xs">{isOwner || isAdmin ?
                    'Internal workflow controls for owner/admin use. These tools are not part of the formal dispatch record.' :
                    'Time log and activity history for this dispatch.'}

                  </p>
                  </div>

                  {(isOwner || isAdmin) &&
                  <DispatchDriverConfirmationSection
                    isOwner={isOwner}
                    isAdmin={isAdmin}
                    showOwnerAssignmentsAndTimeLogs={showOwnerAssignmentsAndTimeLogs}
                    myTrucks={myTrucks}
                    currentConfType={currentConfType}
                    isTruckConfirmedForCurrent={isTruckConfirmedForCurrent}
                    getTruckCurrentConfirmation={getTruckCurrentConfirmation}
                    getTruckPriorConfirmations={getTruckPriorConfirmations}
                    handleConfirmTruck={handleConfirmTruck}
                    formatLogTimestampWithActor={formatLogTimestampWithActor}
                    getEntryActorLabel={getEntryActorLabel}
                    dispatch={dispatch}
                    eligibleDrivers={eligibleDrivers}
                    ownerOptions={ownerOptions}
                    canUseOwnerInformationalAssignments={canUseOwnerInformationalAssignments}
                    selectedDriverByTruck={selectedDriverByTruck}
                    handleDriverSelection={handleDriverSelection}
                    assignDriverMutation={assignDriverMutation}
                    unassignedDriverValue={UNASSIGNED_DRIVER_VALUE}
                    conflictingDriverAssignmentsById={conflictingDriverAssignmentsById}
                    driverAssignmentErrors={driverAssignmentErrors}
                    confirmations={confirmations}
                    shouldShowDriverAssignmentControls={shouldShowDriverAssignmentControls}
                    driverDispatchByTruck={driverDispatchByTruck}
                    onSendDispatch={handleSendDriverDispatch}
                    onCancelDispatch={handleCancelDriverDispatch}
                    sendMutationPending={sendDriverDispatchMutation.isPending}
                    cancelMutationPending={cancelDriverDispatchMutation.isPending} />

                  }

                  <DispatchTimeLogSection
                    isOwner={isOwner}
                    isDriverUser={isDriverUser}
                    isAdmin={isAdmin}
                    showOwnerAssignmentsAndTimeLogs={showOwnerAssignmentsAndTimeLogs}
                    dispatchStatus={dispatch.status}
                    myTrucks={myTrucks}
                    visibleTrucks={visibleTrucks}
                    assignedTrucks={dispatch.trucks_assigned || []}
                    editableTrucks={editableTimeLogTrucks}
                    timeLogSectionRef={timeLogSectionRef}
                    draftTimeEntries={draftTimeEntries}
                    timeEntries={effectiveTimeEntries}
                    dispatch={dispatch}
                    onChangeDraft={handleChangeDraft}
                    onSaveAll={handleSaveAll}
                    editingTimeLogTrucks={editingTimeLogTrucks}
                    onEditTruckTimeLog={(truck) => setEditingTimeLogTrucks((prev) => ({ ...prev, [truck]: true }))}
                    hasUnsavedChanges={hasUnsavedChanges}
                    isSavingAll={isSavingAll}
                    entriesToSave={entriesToSave}
                    TruckTimeRow={TruckTimeRow} />
                </section>
              </div>

              {/* Activity */}
              {isAdmin &&
              <DispatchActivityLogSection
                activityLog={dispatch.admin_activity_log}
                formatActivityTimestamp={formatActivityTimestamp} />
              }

            </div>
          }
        </div>
        <Dialog open={isInternalNotesDialogOpen} onOpenChange={setIsInternalNotesDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Internal Notes</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Use one combined internal-notes workflow with two sections: an owner-visible section (for admin + company owner) and an admin-only section. Drivers cannot view either section.
              </p>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Owner-Visible Internal Note</p>
                <p className="text-xs text-slate-500">Visible to admin and company owner. Hidden from drivers.</p>
                <Textarea
                  value={draftOwnerVisibleInternalNotes}
                  onChange={(event) => setDraftOwnerVisibleInternalNotes(event.target.value)}
                  rows={5}
                  placeholder="Enter internal notes visible to the company owner..."
                  className="resize-y" />
              </div>
              <div className="border-t border-dotted border-red-300 pt-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Admin-Only Internal Note</p>
                <p className="text-xs text-red-600">Visible to admin only.</p>
                <Textarea
                  value={draftAdminOnlyInternalNotes}
                  onChange={(event) => setDraftAdminOnlyInternalNotes(event.target.value)}
                  rows={5}
                  placeholder="Enter internal notes for admin only..."
                  className="resize-y border-red-200 focus-visible:ring-red-400" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsInternalNotesDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSaveInternalNotes} disabled={saveInternalNotesMutation.isPending}>
                  {saveInternalNotesMutation.isPending ? 'Saving…' : 'Save Notes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>);

}
