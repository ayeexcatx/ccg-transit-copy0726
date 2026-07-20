import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardSummaryCards({ stats, createPageUrl }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <Link key={s.label} to={createPageUrl(s.link)} state={s.state} className="h-full">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="flex h-full flex-col p-3.5 sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-2 sm:items-center sm:gap-3">
                <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.color} bg-opacity-10`}>
                    <s.icon className={`h-5 w-5 ${s.color.replace('bg-', 'text-')}`} />
                  </div>
                  <p className={`min-w-0 text-[11px] leading-4 sm:text-xs sm:leading-tight ${s.isAction ? 'font-semibold text-emerald-700' : 'text-slate-500'}`}>
                    {s.headerLabel}
                  </p>
                </div>
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500 sm:mt-0" />
              </div>

              <div className="flex flex-1 items-center">
                {s.shiftCounts ? (
                  <div className="w-full space-y-2">
                    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-[0.02em] text-slate-500">Day Shift</p>
                        <p className="mt-1 text-lg font-semibold leading-tight text-slate-900 sm:text-base">{s.shiftCounts.day}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-[0.02em] text-slate-500">Night Shift</p>
                        <p className="mt-1 text-lg font-semibold leading-tight text-slate-900 sm:text-base">{s.shiftCounts.night}</p>
                      </div>
                    </div>
                    {s.showSundayNightIndicator ? (
                      <p className="px-0.5 text-[10px] leading-tight text-slate-400">Sun Night Scheduled</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xl font-semibold leading-snug text-slate-900 sm:text-2xl sm:leading-tight">{s.value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
