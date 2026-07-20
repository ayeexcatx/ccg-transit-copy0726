import React from 'react';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, Camera, Moon, Pencil, Sun } from 'lucide-react';
import DispatchDrawerTutorial from '@/components/tutorial/DispatchDrawerTutorial';
import { statusBadgeColors } from './statusConfig';

export default function DispatchDrawerTopBar({
  dispatch,
  session,
  displayDate,
  isOwner,
  isAdmin,
  isDriverUser,
  open,
  onBack,
  isCreatingScreenshot,
  isEditingTrucks,
  onReportIncident,
  onScreenshotDispatch,
  onAdminEditDispatch,
}) {
  const canShowAdminEdit = isAdmin && typeof onAdminEditDispatch === 'function';
  const canShowReportIncident = isDriverUser || isOwner || isAdmin;
  const canShowScreenshot = isOwner || isAdmin;

  return (
    <div className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div className="px-5 pb-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-2 h-9 rounded-lg px-2.5 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {canShowAdminEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 rounded-lg px-0 text-xs font-medium sm:w-auto sm:px-3"
                onClick={onAdminEditDispatch}
                aria-label="Edit dispatch"
                title="Edit dispatch"
              >
                <Pencil className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="sr-only">Edit dispatch</span>
                <span className="hidden sm:inline">Edit</span>
              </Button>
            )}
            {canShowReportIncident && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg px-3 text-xs font-medium"
                data-screenshot-exclude="true"
                onClick={onReportIncident}
                data-tour="dispatch-report-incident"
              >
                <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                Report Incident
              </Button>
            )}

            {canShowScreenshot && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-lg px-3 text-xs font-medium"
                disabled={isCreatingScreenshot || isEditingTrucks}
                onClick={onScreenshotDispatch}
                data-tour="dispatch-screenshot"
              >
                <Camera className="mr-1.5 h-3.5 w-3.5" />
                {isCreatingScreenshot ? 'Creating…' : (isAdmin ? 'Screenshot' : 'Screenshot Dispatch')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-5 py-4">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge className={`${statusBadgeColors[dispatch.status]} border text-xs font-medium`}>
                {dispatch.status}
              </Badge>
              <span className="flex items-center gap-1 text-xs font-normal text-slate-500">
                {dispatch.shift_time === 'Day Shift' ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
                {dispatch.shift_time}
              </span>
            </div>
            <span className="text-base font-bold text-slate-800">
              {displayDate}
            </span>
          </SheetTitle>
        </SheetHeader>
      </div>

      <DispatchDrawerTutorial
        isOwner={isOwner}
        drawerOpen={open}
        dispatchStatus={dispatch?.status}
        session={session}
      />
    </div>
  );
}
