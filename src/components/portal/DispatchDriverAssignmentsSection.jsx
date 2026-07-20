import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { UserCog } from 'lucide-react';

const STATUS_LABELS = {
  staged: 'Staged',
  sent: 'Sent',
  seen: 'Seen',
  cancelled: 'Cancelled/Removed',
  removed: 'Cancelled/Removed',
};

export default function DispatchDriverAssignmentsSection({
  eligibleDrivers,
  ownerOptions = [],
  canUseOwnerInformationalAssignments = false,
  trucksAssigned,
  selectedDriverByTruck,
  unassignedDriverValue,
  handleDriverSelection,
  assignDriverMutation,
  conflictingDriverAssignmentsById,
  driverAssignmentErrors,
  shouldShowDriverAssignmentControls,
  driverDispatchByTruck,
  onSendDispatch,
  onCancelDispatch,
  sendMutationPending,
  cancelMutationPending,
  dispatchStatus,
}) {
  if (trucksAssigned.length === 0 || !shouldShowDriverAssignmentControls) return null;
  const hasOwnerChoices = canUseOwnerInformationalAssignments && ownerOptions.length > 0;
  const hasSelectableAssignees = eligibleDrivers.length > 0 || hasOwnerChoices;
  const normalizedDispatchStatus = String(dispatchStatus || '').trim().toLowerCase();
  const isDispatchCanceled = normalizedDispatchStatus === 'cancelled' || normalizedDispatchStatus === 'canceled';

  return (
    <section data-screenshot-exclude="true" data-tour="dispatch-driver-assignments" className="rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5 space-y-2">
      <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
        <UserCog className="h-3.5 w-3.5 text-slate-400" />
        Driver Dispatch Assignments
      </p>
      <p className="text-xs text-slate-500">
        <span className="block">
          Select a driver. Then click <span className="font-semibold text-green-600">Send</span> to deliver the dispatch.
        </span>
        <span className="block">
          Click <span className="font-semibold text-red-500">Cancel</span> to remove the driver and the dispatch from the driver’s portal.
        </span>
        <span className="block">Please read all of the information on the driver’s page before assigning drivers.</span>
      </p>
      {hasOwnerChoices && (
        <p className="text-xs text-slate-500">
          Selecting an owner as a driver does not trigger driver assignment notifications for that driver.
        </p>
      )}
      {eligibleDrivers.length === 0 && !hasOwnerChoices && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
          Create and activate a driver access code first.
        </p>
      )}
      {trucksAssigned.map((truckNumber) => {
        const row = driverDispatchByTruck?.[truckNumber] || null;
        const status = STATUS_LABELS[String(row?.delivery_status || 'staged').toLowerCase()] || 'Staged';
        const canSend = row?.id && row?.active_flag !== false && !row?.is_visible_to_driver;
        const canCancel = row?.id && row?.active_flag !== false && row?.is_visible_to_driver;
        const isDispatchCanceledAndDriverAlreadyAutoCanceled = isDispatchCanceled && canCancel;

        return (
          <div key={`driver-${truckNumber}`} className="grid grid-cols-[70px,1fr] items-start gap-2 border-t pt-2 first:border-t-0 first:pt-0">
            <span className="text-xs font-mono text-slate-600">{truckNumber}</span>
            {hasSelectableAssignees ? (
              <div className="space-y-1">
                <Select
                  value={selectedDriverByTruck[truckNumber] || unassignedDriverValue}
                  onValueChange={(value) => handleDriverSelection(truckNumber, value)}
                  disabled={assignDriverMutation.isPending || sendMutationPending || cancelMutationPending}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Assign driver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={unassignedDriverValue}>No driver assigned</SelectItem>
                    {hasOwnerChoices && ownerOptions.map((owner) => (
                      <SelectItem key={`owner-${owner.id}`} value={`__owner__:${owner.id}`}>
                        {owner.label} (Owner)
                      </SelectItem>
                    ))}
                    {eligibleDrivers.map((driver) => {
                      const isCurrentTruckSelection = selectedDriverByTruck[truckNumber] === driver.id;
                      const hasConflict = Boolean(conflictingDriverAssignmentsById[driver.id]) && !isCurrentTruckSelection;
                      return (
                        <SelectItem key={driver.id} value={driver.id} disabled={hasConflict}>
                          {driver.driver_name}{hasConflict ? ' (Already assigned this shift)' : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Status: {status}</span>
                  {canSend && (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => onSendDispatch(truckNumber)}
                    >
                      Send
                    </Button>
                  )}
                  {canCancel && !isDispatchCanceledAndDriverAlreadyAutoCanceled && (
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => onCancelDispatch(truckNumber)}>Cancel</Button>
                  )}
                  {isDispatchCanceledAndDriverAlreadyAutoCanceled && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled
                      className="h-7 text-xs border-red-500 text-red-600 bg-white cursor-not-allowed hover:bg-white active:bg-white disabled:opacity-100 disabled:border-red-500 disabled:text-red-600 disabled:bg-white disabled:cursor-not-allowed"
                    >
                      Already canceled
                    </Button>
                  )}
                  {row?.last_seen_at && <span className="text-[11px] text-emerald-700">Seen</span>}
                </div>
                {driverAssignmentErrors[truckNumber] && (
                  <p className="text-xs text-red-600">{driverAssignmentErrors[truckNumber]}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No eligible drivers available</p>
            )}
          </div>
        );
      })}
    </section>
  );
} 
