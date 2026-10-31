import { platform } from '../platform';

const DEFAULT_API_BASE_URL = 'https://mediarca-api-sg.onrender.com/api';

/** Adds /api to a server address when it's missing. */
export const normalizeApiBaseUrl = (rawApiUrl?: string | null): string => {
  if (!rawApiUrl) return DEFAULT_API_BASE_URL;
  return rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, '')}/api`;
};

/** Set once at startup through configurePlatform({ apiBaseUrl }). */
export let API_BASE_URL = DEFAULT_API_BASE_URL;

export const setApiBaseUrl = (rawApiUrl: string): void => {
  API_BASE_URL = normalizeApiBaseUrl(rawApiUrl);
};

export const getBackendBaseUrl = (): string => {
  return API_BASE_URL.replace(/\/api\/?$/, '');
};

export const getFileUrl = (filePath?: string): string => {
  if (!filePath) return '';
  if (filePath.startsWith('data:') || filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  if (filePath.startsWith('r2://')) {
    const clean = filePath.replace(/^r2:\/\//, '');
    return `${platform().r2PublicUrl}/${clean}`;
  }
  const backendBase = getBackendBaseUrl();
  return `${backendBase}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
};
