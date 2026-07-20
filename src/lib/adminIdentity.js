export function resolveProfileName(user) {
  const candidates = [
    user?.app_display_name,
    user?.admin_display_name,
    user?.full_name,
    user?.display_name,
    user?.name,
    user?.user_metadata?.app_display_name,
    user?.raw_user_meta_data?.app_display_name,
    user?.user_metadata?.full_name,
    user?.user_metadata?.display_name,
    user?.user_metadata?.name,
    user?.raw_user_meta_data?.full_name,
    user?.raw_user_meta_data?.display_name,
    user?.raw_user_meta_data?.name,
    user?.given_name && user?.family_name ? `${user.given_name} ${user.family_name}` : null,
    user?.user_metadata?.given_name && user?.user_metadata?.family_name
      ? `${user.user_metadata.given_name} ${user.user_metadata.family_name}`
      : null,
  ];

  const resolved = candidates.find((value) => String(value || '').trim());
  return resolved ? String(resolved).trim() : '';
}

export function resolveAdminDisplayName(user) {
  const profileName = resolveProfileName(user);
  if (profileName) return profileName;

  const email = String(user?.email || '').trim();
  if (email) return email;

  return 'Admin';
}

export function resolveAdminDisplayNameFromSession(session) {
  const candidates = [
    session?.admin_display_name,
    session?.label,
    session?.name,
    session?.email,
  ];
  const resolved = candidates.find((value) => String(value || '').trim());
  return resolved ? String(resolved).trim() : 'Admin';
}
