import { safeFetch } from '../safeFetch';
import { safeStorage } from '../../utils/safeStorage';

export const getHeaders = (isMultipart = false) => {
  const token = safeStorage.getItem('mediarca_token');
  const headers: Record<string, string> = {};
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export async function handleResponse<T>(res: Response): Promise<T> {
  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) {
      const error: any = new Error(
        `Server returned error ${res.status}: ${res.statusText || 'Unexpected error'}`
      );
      error.status = res.status;
      throw error;
    }
    data = text;
  }

  if (!res.ok || (data && typeof data === 'object' && data.success === false)) {
    const error: any = new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${res.status}${res.statusText ? `: ${res.statusText}` : ''}`
    );
    error.status = res.status;
    if (typeof data?.code === 'string') error.code = data.code;
    if (data?.requiresVerification) {
      error.requiresVerification = true;
      error.email = data.email;
    }
    if (data?.isAlreadyVerified) {
      error.isAlreadyVerified = true;
    }
    if (data?.retryAfterSeconds) {
      error.retryAfterSeconds = data.retryAfterSeconds;
    }
    const cooldown =
      data?.data?.cooldownSeconds ??
      data?.cooldownSeconds ??
      data?.retryAfterSeconds ??
      data?.remainingSeconds;
    if (cooldown !== undefined) {
      error.cooldownSeconds = cooldown;
    }
    throw error;
  }
  return data?.data !== undefined ? data.data : data;
}

// Short-lived memory cache for public GET lists (doctors, clinics) so moving between
// pages is instant. Identical requests made at the same time share one network call.
const publicGetCache = new Map<string, { at: number; data: unknown }>();
const publicGetInFlight = new Map<string, Promise<unknown>>();

export const cachedPublicGet = async <T>(url: string, ttlMs = 30000): Promise<T> => {
  const hit = publicGetCache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const pending = publicGetInFlight.get(url);
  if (pending) return pending as Promise<T>;
  const request = (async () => {
    try {
      const res = await safeFetch(url);
      const data = await handleResponse<T>(res);
      publicGetCache.set(url, { at: Date.now(), data });
      return data;
    } finally {
      publicGetInFlight.delete(url);
    }
  })();
  publicGetInFlight.set(url, request);
  return request;
};

export const clearPublicGetCache = (): void => {
  publicGetCache.clear();
};
