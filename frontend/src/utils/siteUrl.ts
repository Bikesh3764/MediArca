/** One address for the site: www.mediarca.in -> mediarca.in (sign-in is stored per address). */
export const redirectWwwToApex = (): void => {
  if (typeof window === 'undefined') return;
  if (window.location.hostname === 'www.mediarca.in') {
    const { pathname, search, hash } = window.location;
    window.location.replace(`https://mediarca.in${pathname}${search}${hash}`);
  }
};

/**
 * Copies of the site at other addresses (GitHub Pages, mediarca.pages.dev) tell search engines
 * not to list them, so only mediarca.in shows up (FIX-070). Google reads this after running the page.
 */
export const MIRROR_HOST = /(\.github\.io|\.pages\.dev)$/;
export const noindexMirrors = (): void => {
  if (typeof document === 'undefined' || !MIRROR_HOST.test(window.location.hostname)) return;
  const meta = document.createElement('meta');
  meta.name = 'robots';
  meta.content = 'noindex';
  document.head.appendChild(meta);
};

/** Where the app lives without a trailing slash: '' on mediarca.in, '/MediArca' on GitHub Pages. */
export const siteBase = (): string => (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

/**
 * Pages used to have addresses like mediarca.in/#/doctors. Printed QR posters and saved links still
 * use them, so turn '#/doctors?x=1' into '/doctors?x=1'. Returns null when there is nothing to change.
 */
export const legacyHashToPath = (base: string, hash: string): string | null => {
  if (!hash.startsWith('#/')) return null;
  return `${base}${hash.slice(1)}`;
};

/** Rewrite an old #/ address in place before the app starts (no reload). */
export const upgradeLegacyHashUrl = (): void => {
  if (typeof window === 'undefined') return;
  const next = legacyHashToPath(siteBase(), window.location.hash);
  if (next) window.history.replaceState(null, '', next);
};

/** Full link to an app page, e.g. appUrl('/clinic-checkin') -> https://mediarca.in/clinic-checkin */
export const appUrl = (path: string): string =>
  `${window.location.origin}${siteBase()}${path.startsWith('/') ? path : `/${path}`}`;
