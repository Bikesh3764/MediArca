const rawApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
export const API_BASE_URL = rawApiUrl
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, '')}/api`)
  : (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : 'https://mediarca-api-sg.onrender.com/api');

export const getBackendBaseUrl = (): string => {
  return API_BASE_URL.replace(/\/api\/?$/, '');
};

export const getFileUrl = (filePath?: string): string => {
  if (!filePath) return '';
  if (filePath.startsWith('data:') || filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  if (filePath.startsWith('r2://')) {
    const clean = filePath.replace(/^r2:\/\//, '');
    const r2PublicUrl =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_R2_PUBLIC_URL) ||
      'https://pub-a590817d9f404eb889f6482b025ea9ad.r2.dev';
    return `${r2PublicUrl}/${clean}`;
  }
  const backendBase = getBackendBaseUrl();
  return `${backendBase}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
};
