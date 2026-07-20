import React from 'react';
import { Inbox } from 'lucide-react';
import DispatchCard from './DispatchCard';

export default function PortalDispatchList({
  currentList,
  tab,
  normalizeId,
  drawerDispatchId,
  dispatchRefs,
  session,
  confirmations,
  timeEntries,
  sortedNotes,
  handleConfirm,
  handleTimeEntry,
  handleOwnerTruckUpdate,
  companyMap,
  handleDrawerClose,
  handleDispatchOpen,
  isDriverUser,
  driverAssignedTrucksByDispatch,
}) {
  if (currentList.length === 0) {
    return (
      <div className="text-center py-16">
        <Inbox className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">
          {tab === 'today' ? 'No dispatches today' : tab === 'upcoming' ? 'No upcoming dispatches' : 'No history'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {currentList.map((d) => {
        const isForcedOpenCard = normalizeId(drawerDispatchId) === normalizeId(d.id);

        return (
          <div
            key={d.id}
            ref={(el) => {
              dispatchRefs.current[normalizeId(d.id)] = el;
            }}
          >
            <DispatchCard
              dispatch={d}
              session={session}
              confirmations={confirmations}
              timeEntries={timeEntries}
              templateNotes={sortedNotes}
              onConfirm={handleConfirm}
              onTimeEntry={handleTimeEntry}
              onOwnerTruckUpdate={handleOwnerTruckUpdate}
              companyName={companyMap[d.company_id]}
              forceOpen={isForcedOpenCard}
              onDrawerClose={handleDrawerClose}
              onOpenDispatch={handleDispatchOpen}
              visibleTrucksOverride={isDriverUser ? (driverAssignedTrucksByDispatch.get(normalizeId(d.id)) || []) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
