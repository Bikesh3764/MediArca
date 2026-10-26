/** One address for the site: www.mediarca.in -> mediarca.in (sign-in is stored per address). */
export const redirectWwwToApex = (): void => {
  if (typeof window === 'undefined') return;
  if (window.location.hostname === 'www.mediarca.in') {
    const { pathname, search, hash } = window.location;
    window.location.replace(`https://mediarca.in${pathname}${search}${hash}`);
  }
};

/** Full link to an app page, e.g. appUrl('/clinic-checkin') -> https://mediarca.in/#/clinic-checkin */
export const appUrl = (path: string): string =>
  `${window.location.origin}${window.location.pathname}#${path.startsWith('/') ? path : `/${path}`}`;
