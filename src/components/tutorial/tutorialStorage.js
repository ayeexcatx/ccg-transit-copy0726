export function buildTutorialStorageKey(baseKey, session, scope = 'user') {
  const keyBase = String(baseKey || '').trim();
  if (!keyBase) return '';

  if (!session) return keyBase;

  const sessionId = session.user_id || session.id || null;
  const companyId = session.company_id || session.activeCompanyId || null;

  if (scope === 'company') {
    return companyId ? `${keyBase}:${companyId}` : keyBase;
  }

  if (scope === 'user') {
    if (sessionId) return `${keyBase}:${sessionId}`;
    if (companyId && session.code_type === 'CompanyOwner') return `${keyBase}:owner:${companyId}`;
  }

  return keyBase;
}
