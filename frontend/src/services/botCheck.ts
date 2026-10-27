/**
 * Cloudflare Turnstile bot check for public forms (sign-up, forgot password, contact).
 * Invisible for most visitors: a small check box appears at the bottom of the screen only when
 * Cloudflare isn't sure. Each token works once, so a fresh one is fetched per submit.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const isLocal = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
// Local runs use Cloudflare's always-pass test key
const SITE_KEY: string =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || (isLocal ? '1x00000000000000000000AA' : '0x4AAAAAAFnC32eIvhw1X1Zf');

let scriptPromise: Promise<void> | null = null;

const loadScript = (): Promise<void> => {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error('Turnstile failed to load'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
};

/** Start loading the check early (call when a protected form opens). */
export const preloadBotCheck = (): void => {
  loadScript().catch(() => {});
};

/** A one-time token, or undefined if the check couldn't run (the server then explains). */
export const getBotCheckToken = async (): Promise<string | undefined> => {
  try {
    await loadScript();
  } catch {
    return undefined;
  }
  const ts = window.turnstile;
  if (!ts) return undefined;

  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;';
    document.body.appendChild(host);

    let widgetId = '';
    let settled = false;
    const finish = (token?: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        if (widgetId) ts.remove(widgetId);
      } catch {
        /* already gone */
      }
      host.remove();
      resolve(token);
    };
    const timer = window.setTimeout(() => finish(undefined), 60000);

    try {
      widgetId = ts.render(host, {
        sitekey: SITE_KEY,
        appearance: 'interaction-only',
        theme: 'light',
        callback: (token: string) => finish(token),
        'error-callback': () => finish(undefined),
        'expired-callback': () => finish(undefined),
        'timeout-callback': () => finish(undefined),
      });
    } catch {
      finish(undefined);
    }
  });
};

/** JSON body with a fresh bot-check token added. */
export const withBotCheck = async <T extends object>(body: T): Promise<T & { turnstileToken?: string }> => {
  const turnstileToken = await getBotCheckToken();
  return turnstileToken ? { ...body, turnstileToken } : body;
};
