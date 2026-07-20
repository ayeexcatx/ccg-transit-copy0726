import React from 'react';
import { format } from 'date-fns';
import { Megaphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import AnnouncementCard from '@/components/announcements/AnnouncementCard';

export default function ActiveAnnouncementsSection({ announcements, formatAudience }) {
  return (
    <Card className="rounded-lg border bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-blue-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-white" />
          <h3 className="text-sm font-semibold text-white">Active Announcements</h3>
        </div>
      </div>
      <CardContent className="bg-white p-0">
        {announcements.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No active announcements.</p>
        ) : (
          <div className="divide-y divide-slate-100 bg-white">
            {announcements.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                variant="plain"
                footer={(
                  <div className="mt-2 text-xs text-slate-600">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <p>
                        <span className="font-medium text-slate-700">Added:</span>{' '}
                        {announcement.created_at
                          ? format(new Date(announcement.created_at), 'MMM d, yyyy · h:mm a')
                          : '—'}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Audience:</span>{' '}
                        {formatAudience(announcement)}
                      </p>
                    </div>
                  </div>
                )}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
