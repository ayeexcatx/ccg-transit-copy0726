import React from 'react';
import { Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import AnnouncementMetaBadges from './AnnouncementMetaBadges';
import AnnouncementActivityLog from './AnnouncementActivityLog';
import { getAnnouncementTextColorOption } from '@/components/announcements/announcementTextColors';

export default function AdminAnnouncementCard({
  announcement,
  onToggleActive,
  onEdit,
  targetLabel,
  priorityColors,
  formatActivityTimestamp,
}) {
  const textColor = getAnnouncementTextColorOption(announcement.text_color);

  return (
    <Card className={`${!announcement.active_flag ? 'opacity-65' : ''} shadow-sm border-slate-200`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="space-y-1.5">
            <AnnouncementMetaBadges
              announcement={announcement}
              targetLabel={targetLabel}
              priorityColors={priorityColors}
            />
              <p className="text-base font-semibold leading-tight text-slate-900">{announcement.title}</p>
            </div>
            <p className={`text-sm leading-6 whitespace-pre-wrap break-words ${textColor.className}`}>
              {announcement.message}
            </p>
            <AnnouncementActivityLog
              entries={announcement.admin_activity_log}
              formatActivityTimestamp={formatActivityTimestamp}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0 rounded-lg border border-slate-200 bg-slate-50/70 p-1.5">
            <Switch
              checked={announcement.active_flag !== false}
              onCheckedChange={(v) => onToggleActive(announcement, v)}
            />
            <Button variant="ghost" size="icon" onClick={() => onEdit(announcement)} className="h-8 w-8 hover:bg-white">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
