// Update this version string whenever you publish a new app release.
// IMPORTANT: Keep this value in sync with public/version.json -> { "version": "..." }.
export const APP_VERSION = '2026-03-10-2';

// Public endpoint checked by running app sessions to detect newer deploys.
export const APP_VERSION_ENDPOINT = '/version.json';

// How often to check for a newer version while the app stays open.
export const APP_VERSION_CHECK_INTERVAL_MS = 60_000;
