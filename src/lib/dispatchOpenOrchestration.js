const identity = (value) => value;

/**
 * Parse dispatch drawer deep-link parameters from a location search string.
 */
export function getDispatchOpenTargets(search, { normalizeId = identity } = {}) {
  const params = new URLSearchParams(search || '');
  return {
    targetDispatchId: normalizeId(params.get('dispatchId')),
    targetNotificationId: normalizeId(params.get('notificationId')),
  };
}

/**
 * Build query params for opening a dispatch drawer via URL deep-link.
 */
export function buildDispatchOpenParams({ dispatchId, notificationId, normalizeId = identity } = {}) {
  const params = new URLSearchParams();
  const normalizedDispatchId = normalizeId(dispatchId);
  const normalizedNotificationId = normalizeId(notificationId);

  if (normalizedDispatchId) params.set('dispatchId', normalizedDispatchId);
  if (normalizedNotificationId) params.set('notificationId', normalizedNotificationId);

  return params;
}

/**
 * Build a route path with dispatch drawer deep-link query params.
 */
export function buildDispatchOpenPath(targetPage, options = {}) {
  const params = buildDispatchOpenParams(options);
  const query = params.toString();
  return query ? `${targetPage}?${query}` : targetPage;
}

/**
 * Remove dispatch drawer deep-link parameters from a location search string.
 */
export function clearDispatchOpenParams(search) {
  const nextParams = new URLSearchParams(search || '');
  nextParams.delete('dispatchId');
  nextParams.delete('notificationId');

  const nextQuery = nextParams.toString();
  return nextQuery ? `?${nextQuery}` : '';
}

/**
 * Resolve the tab that should contain a deep-linked dispatch.
 */
export function resolveDispatchOpenTab({
  dispatchId,
  inUpcoming,
  inToday,
  inHistory,
  historyFallback = false,
}) {
  if (!dispatchId) return null;
  if (inUpcoming) return 'upcoming';
  if (inToday) return 'today';
  if (inHistory) return 'history';
  return historyFallback ? 'history' : null;
}
