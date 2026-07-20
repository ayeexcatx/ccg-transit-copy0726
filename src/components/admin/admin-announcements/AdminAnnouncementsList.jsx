import React from 'react';
import AdminAnnouncementCard from './AdminAnnouncementCard';

export default function AdminAnnouncementsList({
  announcements,
  onToggleActive,
  onEdit,
  targetLabel,
  priorityColors,
  formatActivityTimestamp,
}) {
  return (
    <div className="grid gap-2.5">
      {announcements.map((announcement) => (
        <AdminAnnouncementCard
          key={announcement.id}
          announcement={announcement}
          onToggleActive={onToggleActive}
          onEdit={onEdit}
          targetLabel={targetLabel}
          priorityColors={priorityColors}
          formatActivityTimestamp={formatActivityTimestamp}
        />
      ))}
    </div>
  );
}
