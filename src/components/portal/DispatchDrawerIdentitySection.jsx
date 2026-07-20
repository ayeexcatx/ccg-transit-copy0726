import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Pencil } from 'lucide-react';
import { scheduledDispatchNote, scheduledStatusMessage } from './statusConfig';

export default function DispatchDrawerIdentitySection({
  dispatch,
  isAdmin,
  isOwner,
  visibleTrucks,
  getTruckDriverSummaryLabel,
  hasTruckSeenStatus,
  isEditingTrucks,
  onToggleEditingTrucks,
  requiredTruckCount,
  ownerTruckOptions,
  draftTrucks,
  toggleDraftTruck,
  truckEditMessage,
  hasTruckDraftChanges,
  isSavingTrucks,
  onSaveTrucks
}) {
  if (dispatch.status === 'Scheduled') {
    return (
      <div>
        <h2 className="text-sm font-semibold text-slate-700">Scheduled Dispatch</h2>
        <p className="text-sm text-blue-600 mt-1 italic">{scheduledStatusMessage}</p>
        <p className="text-xs text-slate-600 mt-2 italic">{scheduledDispatchNote}</p>
      </div>);

  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 border-b border-slate-200/80 pb-3">
        {dispatch.client_name &&
        <h2 className="text-xl font-semibold leading-tight text-slate-900 sm:text-2xl">{dispatch.client_name}</h2>
        }
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Building2 className="h-4 w-4 text-slate-400" />
          <span>
            <span className="text-slate-500">Working for</span>{' '}
            <span className="font-medium text-slate-700">CCG Transit</span>
          </span>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white p-3.5 sm:p-4">
        <div className="mb-3 flex w-full items-center justify-between gap-2 rounded-md border border-slate-700/50 bg-gradient-to-r from-slate-700/85 via-slate-700/65 to-slate-700/15 px-2.5 py-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-100">Trucks Assigned</p>
          {isOwner &&
          <Button
            type="button"
            data-screenshot-exclude="true"
            variant="outline"
            size="sm"
            className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
            data-tour="dispatch-edit-trucks"
            onClick={onToggleEditingTrucks}>
            
              <Pencil className="h-3.5 w-3.5 mr-1" />
              {isEditingTrucks ? 'Cancel' : 'Edit Trucks'}
            </Button>
          }
        </div>

        <div className="space-y-3">
          <div>
            {isAdmin || isOwner ?
            <div className="min-w-0 space-y-1.5">
                {visibleTrucks.map((t) => {
                const truckDriverSummaryLabel = getTruckDriverSummaryLabel(t);

                return (
                  <div key={t} className="grid grid-cols-[auto,1fr,auto] items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-2.5 py-2">
                      <Badge
                        data-screenshot-badge-truck="true"
                        variant="outline"
                        className="inline-flex h-6 shrink-0 items-center justify-center rounded-md border border-slate-700/80 bg-white px-2.5 font-semibold leading-none text-slate-950 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                        {t}
                      </Badge>
                      <span className="min-w-0 break-words text-xs leading-relaxed text-slate-600">
                        {truckDriverSummaryLabel || 'No driver assigned'}
                      </span>
                      <div className="flex justify-end">
                        {hasTruckSeenStatus(t) &&
                      <Badge
                        data-screenshot-exclude="true"
                        className="border border-emerald-200/80 bg-emerald-50/70 px-1.5 py-0 text-[10px] font-semibold text-emerald-700">
                            Seen
                          </Badge>
                      }
                      </div>
                    </div>);

              })}
              </div> :

            <div className="flex items-center gap-1.5 flex-wrap">
                {visibleTrucks.map((t) =>
              <Badge key={t} variant="outline" className="text-xs border-slate-900 text-slate-900 font-semibold w-fit">
                    {t}
                  </Badge>
              )}
              </div>
            }
          </div>

          {isOwner && isEditingTrucks &&
          <div data-screenshot-exclude="true" className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
              <p className="text-xs text-slate-500">
                Select assigned trucks. You must keep exactly {requiredTruckCount} truck{requiredTruckCount === 1 ? '' : 's'}.
              </p>
              <div className="space-y-2">
                {ownerTruckOptions.map((truck) =>
              <label key={truck} className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox
                  checked={draftTrucks.includes(truck)}
                  disabled={!draftTrucks.includes(truck) && draftTrucks.filter(Boolean).length >= requiredTruckCount}
                  onCheckedChange={() => toggleDraftTruck(truck)} />
                
                    <span className="font-mono">{truck}</span>
                  </label>
              )}
              </div>
              {truckEditMessage?.text &&
            <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
                  {truckEditMessage.text}
                </div>
            }
              <Button
              type="button"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!hasTruckDraftChanges || isSavingTrucks || draftTrucks.filter(Boolean).length !== requiredTruckCount}
              onClick={onSaveTrucks}>
              
                {isSavingTrucks ? 'Saving…' : 'Save Truck Assignments'}
              </Button>
            </div>
          }
        </div>
      </section>
    </div>);

}
