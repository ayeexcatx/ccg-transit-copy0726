import React from 'react';
import { useSession } from '@/components/session/SessionContext';
import AdminAvailabilityAccessGuard from '@/components/admin/admin-availability/AdminAvailabilityAccessGuard';
import AdminAvailabilitySummarySection from '@/components/admin/admin-availability/AdminAvailabilitySummarySection';
import AdminAvailabilityManagerSection from '@/components/admin/admin-availability/AdminAvailabilityManagerSection';

export default function AdminAvailability() {
  const { session } = useSession();

  if (session?.code_type !== 'Admin') {
    return <AdminAvailabilityAccessGuard />;
  }

  return (
    <div className="space-y-4">
      <AdminAvailabilitySummarySection />
      <AdminAvailabilityManagerSection />
    </div>
  );
}
