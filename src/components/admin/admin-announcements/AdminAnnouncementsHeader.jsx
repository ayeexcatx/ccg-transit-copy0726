import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminAnnouncementsHeader({ total, onNew }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Announcements</h2>
        <p className="text-sm text-slate-500">{total} total</p>
      </div>
      <Button onClick={onNew} className="bg-slate-900 hover:bg-slate-800 text-xs">
        <Plus className="h-3.5 w-3.5 mr-1" />New Announcement
      </Button>
    </div>
  );
}
