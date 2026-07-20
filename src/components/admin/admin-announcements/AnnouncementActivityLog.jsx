import React from 'react';

export default function AnnouncementActivityLog({ entries, formatActivityTimestamp }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2">
      <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">Activity</p>
      {Array.isArray(entries) && entries.length > 0 ? (
        <div className="space-y-1">
          {entries.slice(0, 3).map((entry, idx) => (
            <div key={`${entry.timestamp || 'activity'}-${idx}`} className="text-[11px] text-slate-500">
              <span className="text-slate-400">{formatActivityTimestamp(entry.timestamp)}</span>
              <span className="mx-1">•</span>
              <span>{entry.message || entry.action || 'Activity update'}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">No activity yet.</p>
      )}
    </div>
  );
}
