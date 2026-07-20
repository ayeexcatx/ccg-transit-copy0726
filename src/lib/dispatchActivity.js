import { base44 } from '@/api/base44Client';

export function getSessionActorName(session, fallback = 'Company Owner') {
  const candidates = [
    session?.label,
    session?.access_code_label,
    session?.name,
    session?.access_code_name,
  ];
  const resolved = candidates.find((value) => String(value || '').trim());
  return resolved ? String(resolved).trim() : fallback;
}

export async function appendDispatchActivityEntries(dispatchId, entries = []) {
  if (!dispatchId || !Array.isArray(entries) || entries.length === 0) return;

  try {
    const latestDispatch = await base44.entities.Dispatch.filter({ id: dispatchId }, '-created_date', 1);
    const currentDispatch = latestDispatch?.[0] || null;
    const currentLog = Array.isArray(currentDispatch?.admin_activity_log) ? currentDispatch.admin_activity_log : [];

    await base44.entities.Dispatch.update(dispatchId, {
      admin_activity_log: [...entries, ...currentLog],
    });
  } catch (error) {
    console.error('Failed to append dispatch activity entries:', error);
  }
}
