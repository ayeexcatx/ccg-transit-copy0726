import React from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DispatchConfirmReceiptLogSection({
  myTrucks,
  currentConfType,
  isTruckConfirmedForCurrent,
  getTruckCurrentConfirmation,
  getTruckPriorConfirmations,
  handleConfirmTruck,
  formatLogTimestampWithActor,
  getEntryActorLabel
}) {
  if (myTrucks.length === 0) return null;

  return (
    <section data-tour="dispatch-confirm-receipt" className="rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5">
      <p className="bg-slate-50 text-slate-500 mb-2 text-xs uppercase tracking-wide flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
        Confirm Receipt — <span className="text-slate-700">{currentConfType}</span>
      </p>
      <div className="space-y-2">
        {myTrucks.map((truck) => {
          const confirmed = isTruckConfirmedForCurrent(truck);
          const conf = getTruckCurrentConfirmation(truck);
          const priorConfs = getTruckPriorConfirmations(truck);
          return (
            <div key={truck} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-sm font-mono font-medium">{truck}</span>
                </div>
                {confirmed ?
                <div className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-medium">Confirmed</span>
                    {conf?.confirmed_at &&
                  <span className="text-xs text-slate-400 ml-1">
                        {format(new Date(conf.confirmed_at), 'MMM d, h:mm a')}
                      </span>
                  }
                  </div> :

                <Button
                  size="sm" className="bg-green-600 text-primary-foreground px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow hover:bg-slate-800 h-7"

                  onClick={() => handleConfirmTruck(truck)}>
                  
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Confirm Receipt
                  </Button>
                }
              </div>
              {priorConfs.length > 0 &&
              <div className="border-t border-slate-100 px-3 py-2 bg-slate-50">
                  <p className="text-xs text-slate-400 mb-1">Prior confirmations:</p>
                  {priorConfs.map((c, i) =>
                <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                      <CheckCircle2 className="h-3 w-3 text-slate-400" />
                      <span className="font-medium">{c.confirmation_type}</span>
                      {c.confirmed_at &&
                  <span className="text-slate-400 text-right">{formatLogTimestampWithActor('Confirmed', c.confirmed_at, getEntryActorLabel(c) || 'Unknown')}</span>
                  }
                    </div>
                )}
                </div>
              }
            </div>);

        })}
      </div>
    </section>);

}