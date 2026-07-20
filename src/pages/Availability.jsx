import React, { useState } from 'react';
import { useSession } from '@/components/session/SessionContext';
import { Card, CardContent } from '@/components/ui/card';
import AvailabilityManager from '@/components/availability/AvailabilityManager';
import AvailabilitySummaryBoxes from '@/components/availability/AvailabilitySummaryBoxes';
import { getActiveCompanyId, getEffectiveView } from '@/components/session/workspaceUtils';

export default function Availability() {
  const { session } = useSession();
  const effectiveView = getEffectiveView(session);
  const activeCompanyId = getActiveCompanyId(session);
  const isOwner = effectiveView === 'CompanyOwner';
  const [activeDate, setActiveDate] = useState(new Date());

  if (!isOwner) {
    return (
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-slate-900">Availability</h2>
          <p className="text-sm text-slate-500 mt-2">Only company owners can access this page.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <AvailabilitySummaryBoxes companyId={activeCompanyId} variant="ownerCompact" referenceDate={activeDate} />
      <AvailabilityManager companyId={activeCompanyId} activeDate={activeDate} onActiveDateChange={setActiveDate} />
    </div>
  );
}
