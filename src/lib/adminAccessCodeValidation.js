export function findValidAdminAccessCodeMatch(enteredCode, accessCodes = []) {
  const trimmedCode = String(enteredCode || '').trim();
  if (!trimmedCode) return null;

  return (accessCodes || []).find((code) =>
    code?.code === trimmedCode &&
    code?.code_type === 'Admin' &&
    code?.active_flag !== false
  ) || null;
}

export function validateAdminAccessCode(enteredCode, accessCodes = []) {
  const trimmedCode = String(enteredCode || '').trim();
  if (!trimmedCode) {
    return { isValid: false, trimmedCode, error: 'Enter an admin access code to continue.' };
  }

  const match = findValidAdminAccessCodeMatch(trimmedCode, accessCodes);
  if (!match) {
    return { isValid: false, trimmedCode, error: 'Invalid admin access code.' };
  }

  return { isValid: true, trimmedCode, match, error: '' };
}
