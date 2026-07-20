import React from 'react';
import { Clock } from 'lucide-react';
import { getEffectiveTruckStartTime, hasMixedTruckStartTimes } from '@/lib/dispatchTruckOverrides';

function DetailTextRow({ label, value, valueClassName = '' }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600">{label}</p>
      <p className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 ${valueClassName}`}>{value}</p>
    </div>
  );
}

function AssignmentDetailBlock({ assignment, iconSize = 'h-4 w-4', textColor = 'text-slate-700' }) {
  const startTimeRows = Array.isArray(assignment.start_time_rows) ? assignment.start_time_rows : null;
  const hasStartTimeRows = Boolean(startTimeRows?.length);

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {assignment.job_number && (
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-sm leading-relaxed text-slate-700">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600">Job Number</span>{' '}
            <span className="font-semibold text-slate-800">{assignment.job_number}</span>
          </div>
        )}
        {(assignment.start_time || hasStartTimeRows) && (
          <div className={`flex items-start gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-2 text-sm sm:px-2 ${textColor}`}>
            <Clock className={`${iconSize} mt-0.5 shrink-0 text-slate-400`} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600">Start Time</p>
              {hasStartTimeRows ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 marker:text-slate-500">
                  {startTimeRows.map((row, index) => (
                    <li key={`${row.truckNumber}-${row.time ?? 'none'}-${index}`} className="block w-full text-xs text-slate-700">
                      <span className="inline-flex whitespace-nowrap">
                        <span className="font-mono">{row.truckNumber}</span>
                        <span className="px-1" aria-hidden="true">
                          —
                        </span>
                        <span>{assignment.formatTimeToAmPm(row.time) || '—'}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-0.5 whitespace-nowrap font-medium text-slate-700">{assignment.formatTimeToAmPm(assignment.start_time)}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <DetailTextRow
          label="Start Location"
          value={assignment.start_location}
          valueClassName={`${assignment.contentTextClass || 'text-slate-600'} ${assignment.contentExtraClass || ''}`}
        />
        <DetailTextRow
          label="Instructions"
          value={assignment.instructions}
          valueClassName={`${assignment.contentTextClass || 'text-slate-600'} ${assignment.contentExtraClass || ''}`}
        />
        <DetailTextRow
          label="Notes"
          value={assignment.notes}
          valueClassName={`${assignment.contentTextClass || 'text-slate-600'} ${assignment.contentExtraClass || ''}`}
        />
        <DetailTextRow
          label="Tolls"
          value={assignment.toll_status}
          valueClassName={`${assignment.contentTextClass || 'text-slate-600'} ${assignment.contentExtraClass || ''}`}
        />
      </div>
    </>
  );
}

export default function DispatchDrawerAssignmentsSection({ dispatch, hasAdditional, formatTimeToAmPm, visibleTrucks = [] }) {
  if (!(hasAdditional || dispatch.instructions || dispatch.notes || dispatch.toll_status || dispatch.start_time || dispatch.start_location)) {
    return null;
  }

  const primary = { ...dispatch, formatTimeToAmPm, contentTextClass: 'text-slate-700', contentExtraClass: 'leading-relaxed' };
  const assignmentTitle = (dispatch.additional_assignments || []).length > 0 ? 'Assignment 1' : 'Assignment';
  const shouldShowMixedTimes = hasMixedTruckStartTimes(dispatch, visibleTrucks);
  const startTimeRows = shouldShowMixedTimes
    ? (visibleTrucks || []).map((truckNumber) => ({
      truckNumber,
      time: getEffectiveTruckStartTime(dispatch, truckNumber)
    }))
    : [];
  if (startTimeRows.length > 0) {
    primary.start_time_rows = startTimeRows;
  }

  return (
    <section className="space-y-3">
      <div data-tour="dispatch-assignment-details" className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/70 p-3.5 sm:p-4">
        <div className="mb-2 rounded-md border border-slate-700/50 bg-gradient-to-r from-slate-700/85 via-slate-700/65 to-slate-700/15 px-2.5 py-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-100">{assignmentTitle}</p>
        </div>
        <div className="mt-2.5 space-y-3">
          <AssignmentDetailBlock assignment={primary} />
        </div>
      </div>

      {(dispatch.additional_assignments || []).length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Additional Assignments</p>
          <div className="space-y-2.5">
            {dispatch.additional_assignments.map((assignment, i) => {
              const entry = { ...assignment, formatTimeToAmPm, contentTextClass: 'text-slate-600', contentExtraClass: '' };
              return (
                <div key={i} className={`rounded-xl border border-slate-200/80 p-3 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/55'}`}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Assignment {i + 2}</p>
                  <div className="space-y-3">
                    <AssignmentDetailBlock assignment={entry} iconSize="h-3.5 w-3.5" textColor="text-slate-700" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
