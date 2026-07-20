import React from 'react';
import { Check, X } from 'lucide-react';
import { getDriverSmsState } from '@/lib/sms';

export default function DriverSmsStatus({ driver, desktop = false }) {
  const smsState = getDriverSmsState(driver);

  return (
    <div className={desktop ? 'mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs' : 'mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs shadow-sm shadow-slate-200/50'}>
      <div className="space-y-1.5">
        <p className="text-slate-700">
          <span className="font-medium text-slate-600">Do you want this driver to receive SMS?</span>{' '}
          <span className={smsState.ownerEnabled ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'}>
            {smsState.ownerEnabled ? 'Yes' : 'No'}
          </span>
        </p>
        <p className="text-slate-700">
          <span className="font-medium text-slate-600">Driver opted in:</span>{' '}
          <span className={smsState.driverOptedIn ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'}>
            {smsState.driverOptedIn ? 'Yes' : 'No'}
          </span>
        </p>
        <p className="flex items-center gap-1 text-slate-700">
          <span className="font-medium text-slate-600">SMS enabled:</span>
          {smsState.effective ? (
            <><Check className="h-3.5 w-3.5 text-emerald-700" /><span className="font-semibold text-emerald-700">Yes</span></>
          ) : (
            <><X className="h-3.5 w-3.5 text-red-600" /><span className="font-semibold text-red-600">No</span></>
          )}
        </p>
      </div>
    </div>
  );
}
