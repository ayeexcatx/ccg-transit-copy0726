import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminAvailabilityAccessGuard() {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold text-slate-900">Availability Management</h2>
        <p className="text-sm text-slate-500 mt-2">Only admins can access this page.</p>
      </CardContent>
    </Card>
  );
}
