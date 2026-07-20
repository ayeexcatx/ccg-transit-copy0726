export const APP_RUNTIME_VERSION_KEY = 'dispatch_hub_runtime_version';
export const APP_RUNTIME_VERSION_CONFIG_KEY = 'app_runtime_version';
export const APP_RUNTIME_VERSION_CHECK_INTERVAL_MS = 60_000;

export const normalizeRuntimeVersion = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

export const createRuntimeVersionToken = () => `${Date.now()}`;
