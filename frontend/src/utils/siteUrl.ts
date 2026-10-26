/** One address for the site: www.mediarca.in -> mediarca.in (sign-in is stored per address). */
export const redirectWwwToApex = (): void => {
  if (typeof window === 'undefined') return;
  if (window.location.hostname === 'www.mediarca.in') {
    const { pathname, search, hash } = window.location;
    window.location.replace(`https://mediarca.in${pathname}${search}${hash}`);
  }
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
