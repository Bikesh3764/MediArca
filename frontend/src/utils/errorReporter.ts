import { API_BASE_URL } from '../services/api';

/**
 * Sends browser crashes to the backend, where they appear in Render logs as [ClientError].
 * Capped per page load and de-duplicated so a crash loop can't flood the server.
 * Only the page path is sent (no query string), never form contents.
 */
const MAX_REPORTS = 10;
let sent = 0;
const seen = new Set<string>();

export const reportClientError = (error: unknown): void => {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const key = `${err.message}|${(err.stack || '').split('\n')[1] || ''}`;
    if (sent >= MAX_REPORTS || seen.has(key)) return;
    seen.add(key);
    sent += 1;
    fetch(`${API_BASE_URL}/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        message: err.message.slice(0, 300),
        stack: (err.stack || '').slice(0, 1500),
        url: window.location.pathname,
      }),
    }).catch(() => {});
  } catch {
    /* reporting must never break the app */
  }
};

export const installGlobalErrorReporting = (): void => {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (event) => reportClientError(event.error || event.message));
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    // Network blips and aborted requests are expected; only report real code errors
    if (reason?.name === 'AbortError' || reason?.name === 'ApiTimeoutError' || typeof reason?.status === 'number') return;
    reportClientError(reason);
  });
};
