import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Truck } from 'lucide-react';
import NotificationStatusBadge from './NotificationStatusBadge';
import { formatNotificationTime } from './notificationTimeFormat';
import NotificationMessageText from './NotificationMessageText';

export default function NotificationBellItem({
  notification,
  display,
  effectiveReadFlag,
  dispatch,
  confirmations,
  ownerAllowedTrucks,
  visibleTrucks = [],
  onClick,
}) {
  return (
    <div
      className={`group relative cursor-pointer border-b border-slate-100/90 px-4 py-3.5 transition-all duration-200 last:border-b-0 ${!effectiveReadFlag ? 'bg-blue-50/40' : 'bg-white/40'} hover:bg-slate-50/80 focus-within:bg-slate-50/80`}
      onClick={onClick}
    >
      {!effectiveReadFlag && (
        <span className="absolute left-2.5 top-5 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.12)]" aria-hidden="true" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className={`min-w-0 flex-1 ${!effectiveReadFlag ? 'pl-4' : ''}`}>
          <p className={`text-sm leading-5 text-slate-800 ${display.isOwnerDispatchStatus ? 'font-semibold' : 'font-medium'}`}>
            {display.title}
          </p>
          <NotificationMessageText
            notification={notification}
            message={display.message}
            className="mt-1 whitespace-pre-line text-sm leading-5 text-slate-600"
          />
          {dispatch && visibleTrucks.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
              <Truck className="h-3 w-3 text-slate-500" />
              {visibleTrucks.map((truck) => (
                <Badge key={`${notification.id}-${truck}`} variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-5">
                  {truck}
                </Badge>
              ))}
            </div>
          )}
          <div className="mt-2">
            <NotificationStatusBadge
              notification={notification}
              confirmations={confirmations}
              dispatch={dispatch}
              ownerAllowedTrucks={ownerAllowedTrucks}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {formatNotificationTime(notification.created_date)}
          </p>
        </div>
      </div>
    </div>
  );
}
