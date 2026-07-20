import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export const confirmationsQueryKey = ['confirmations'];

export function useConfirmationsQuery(enabled = true, companyId = null) {
  const scopedCompanyId = companyId ?? null;
  return useQuery({
    queryKey: [...confirmationsQueryKey, scopedCompanyId],
    queryFn: async () => {
      if (!scopedCompanyId) return [];

      const confirmations = await base44.entities.Confirmation.list('-confirmed_at', 500);
      const companyDispatches = await base44.entities.Dispatch.filter({ company_id: scopedCompanyId }, '-date', 500);
      const companyDispatchIds = new Set((companyDispatches || []).map((dispatch) => String(dispatch.id || '')));
      return (confirmations || []).filter((confirmation) => companyDispatchIds.has(String(confirmation.dispatch_id || '')));
    },
    enabled: enabled && !!scopedCompanyId,
    refetchInterval: 30000,
  });
}
