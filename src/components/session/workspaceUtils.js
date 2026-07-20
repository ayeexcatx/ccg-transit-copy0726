const ADMIN_VIEW = 'Admin';
const OWNER_VIEW = 'CompanyOwner';

export const WORKSPACE_VIEWS = [ADMIN_VIEW, OWNER_VIEW];

export function normalizeId(value) {
  return value ? String(value) : '';
}

export function normalizeView(value) {
  return value === OWNER_VIEW ? OWNER_VIEW : ADMIN_VIEW;
}

export function getAvailableWorkspaces(accessCode, companies = []) {
  if (!accessCode) return [];

  const companyNameById = new Map(
    companies
      .filter((company) => company?.id)
      .map((company) => [normalizeId(company.id), company.name || 'Company']),
  );

  const rawViews = Array.isArray(accessCode.available_views)
    ? accessCode.available_views
    : [];

  const views = rawViews
    .map(normalizeView)
    .filter((view, index, arr) => WORKSPACE_VIEWS.includes(view) && arr.indexOf(view) === index);

  if (views.length === 0) {
    if (accessCode.code_type === ADMIN_VIEW) views.push(ADMIN_VIEW);
    if (accessCode.code_type === OWNER_VIEW) views.push(OWNER_VIEW);
  }

  const linkedCompanyIds = Array.isArray(accessCode.linked_company_ids)
    ? accessCode.linked_company_ids.map(normalizeId).filter(Boolean)
    : [];

  const options = [];

  if (views.includes(ADMIN_VIEW)) {
    options.push({
      key: ADMIN_VIEW,
      mode: ADMIN_VIEW,
      companyId: null,
      label: 'Admin',
    });
  }

  if (views.includes(OWNER_VIEW)) {
    const ownerCompanyIds = linkedCompanyIds.length > 0
      ? linkedCompanyIds
      : [normalizeId(accessCode.company_id)].filter(Boolean);

    ownerCompanyIds.forEach((companyId) => {
      options.push({
        key: `${OWNER_VIEW}:${companyId}`,
        mode: OWNER_VIEW,
        companyId,
        label: companyNameById.get(companyId) || 'Company',
      });
    });
  }

  return options;
}

export function getEffectiveView(session) {
  if (!session) return null;
  return session.activeViewMode || session.code_type;
}

export function getActiveCompanyId(session) {
  if (!session) return null;
  if (getEffectiveView(session) === OWNER_VIEW) {
    return session.activeCompanyId || session.company_id || null;
  }
  return null;
}

function getBaseLabelName(session) {
  const rawLabel = typeof session?.admin_display_name === 'string' && session.admin_display_name.trim()
    ? session.admin_display_name.trim()
    : (typeof session?.label === 'string' ? session.label.trim() : '');
  if (!rawLabel) return '';

  const withoutWorkspaceSuffix = rawLabel.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return withoutWorkspaceSuffix || rawLabel;
}

export function getWorkspaceDisplayLabel(session, activeCompanyName) {
  if (!session) return '';

  const effectiveView = getEffectiveView(session);
  const baseName =
    getBaseLabelName(session) ||
    (typeof session?.name === 'string' ? session.name.trim() : '') ||
    '';

  if (effectiveView === ADMIN_VIEW) {
    if (!baseName) return 'Admin';
    return `${baseName} (Admin)`;
  }

  if (effectiveView === OWNER_VIEW) {
    const companyLabel =
      (typeof activeCompanyName === 'string' ? activeCompanyName.trim() : '') ||
      'Company';
    return baseName || companyLabel;
  }

  return session.label || effectiveView || session.code_type || '';
}
