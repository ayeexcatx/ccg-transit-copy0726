import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { statusBadgeColors } from './statusConfig';

export default function DispatchDrawerStatusReasonBox({ dispatch }) {
  const normalizedStatus = String(dispatch.status || '').toLowerCase();
  const isCanceled = normalizedStatus === 'cancelled' || normalizedStatus === 'canceled';
  const isAmended = normalizedStatus === 'amended';

  if (!dispatch.canceled_reason || (!isCanceled && !isAmended)) return null;

  const amendmentBadgeClasses = statusBadgeColors.Amended || '';

  return (
    <div className={`flex items-start gap-2 rounded-lg p-4 ${isAmended ? amendmentBadgeClasses : 'bg-red-50'}`}>
      <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${isAmended ? 'text-amber-700' : 'text-red-500'}`} />
      <div>
        <p className={`text-xs font-semibold mb-0.5 ${isAmended ? 'text-amber-700' : 'text-red-700'}`}>{isCanceled ? 'Cancellation' : 'Amendment'}</p>
        <p className={`text-sm ${isAmended ? 'text-amber-700' : 'text-red-600'}`}>{dispatch.canceled_reason}</p>
      </div>
    </div>
  );
}
