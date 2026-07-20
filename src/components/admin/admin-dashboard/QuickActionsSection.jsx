import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, FileText, Key, StickyNote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const quickActionItems = [
  {
    key: 'dispatches',
    link: 'AdminDispatches',
    title: 'Manage Dispatches',
    subtitle: 'Create & edit',
    icon: FileText,
    iconClassName: 'text-blue-600',
    iconBgClassName: 'bg-blue-50',
  },
  {
    key: 'companies',
    link: 'AdminCompanies',
    title: 'Manage Companies',
    subtitle: 'Add trucks & info',
    icon: Building2,
    iconClassName: 'text-emerald-600',
    iconBgClassName: 'bg-emerald-50',
  },
  {
    key: 'access-codes',
    link: 'AdminAccessCodes',
    title: 'Access Codes',
    subtitle: 'Create & manage',
    icon: Key,
    iconClassName: 'text-amber-600',
    iconBgClassName: 'bg-amber-50',
  },
  {
    key: 'template-notes',
    link: 'AdminTemplateNotes',
    title: 'Template Notes',
    subtitle: 'Manage notes',
    icon: StickyNote,
    iconClassName: 'text-purple-600',
    iconBgClassName: 'bg-purple-50',
  },
];

export default function QuickActionsSection({ createPageUrl }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActionItems.map((item) => (
          <Link key={item.key} to={createPageUrl(item.link)}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg ${item.iconBgClassName} flex items-center justify-center`}>
                  <item.icon className={`h-4 w-4 ${item.iconClassName}`} />
                </div>
                <div>
                  <p className="text-sm text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.subtitle}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
