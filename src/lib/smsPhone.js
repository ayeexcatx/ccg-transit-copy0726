export function normalizeUsSmsPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const normalizedDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

  if (normalizedDigits.length !== 10) return '';

  const area = normalizedDigits.slice(0, 3);
  const exchange = normalizedDigits.slice(3, 6);

  // NANP basic validation: area/exchange cannot start with 0/1.
  if (!/[2-9]/.test(area[0]) || !/[2-9]/.test(exchange[0])) {
    return '';
  }

  return `+1${normalizedDigits}`;
}

/**
 * True when the value is normalized to strict US E.164 format (+1XXXXXXXXXX).
 */
export function isUsSmsPhone(value) {
  return typeof value === 'string' && /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(value);
}

/**
 * Shared SMS phone validity check used by derived-state helpers.
 */
export function hasUsSmsPhone(value) {
  return isUsSmsPhone(value);
}
