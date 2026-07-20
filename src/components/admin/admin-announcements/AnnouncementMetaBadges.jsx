import React from 'react';
import { format } from 'date-fns';
import { Building2, KeyRound, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AnnouncementMetaBadges({ announcement, targetLabel, priorityColors }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge className={`${priorityColors[announcement.priority] || priorityColors[3]} border text-xs`}>
        P{announcement.priority}
      </Badge>
      <Badge variant="outline" className="text-xs flex items-center gap-1">
        {announcement.target_type === 'All' && <Users className="h-3 w-3" />}
        {announcement.target_type === 'Companies' && <Building2 className="h-3 w-3" />}
        {announcement.target_type === 'AccessCodes' && <KeyRound className="h-3 w-3" />}
        {targetLabel(announcement)}
      </Badge>
      {!announcement.active_flag && <Badge variant="outline" className="text-xs text-slate-500 border-slate-300">Inactive</Badge>}
      {announcement.created_at && (
        <span className="text-xs text-slate-400 ml-auto">{format(new Date(announcement.created_at), 'MMM d, yyyy')}</span>
      )}
    </div>
  );
}
