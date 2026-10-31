import type { Location, NavigateFunction } from 'react-router-dom';

// Pages that should never be the place we send someone back to after signing in.
const AUTH_PATHS = new Set([
  '/login',
  '/signup',
  '/patient/login',
  '/patient/signup',
  '/doctor/login',
  '/doctor/signup',
  '/forgot-password',
  '/clinic/login',
  '/clinic/signup',
  '/receptionist/login',
  '/admin-login',
  '/admin/login',
]);

const isSafeInternalPath = (path: string | null | undefined): path is string =>
  Boolean(path && path.startsWith('/') && !path.startsWith('//'));

const isAuthPath = (path: string) => AUTH_PATHS.has(path.split(/[?#]/)[0]);

/**
 * Where to go after sign in / sign up: the `?redirect=` param first, then
 * `state.from` (set by ProtectedRoute or a "Sign In" link). Null if none.
 */
export const getReturnPath = (location: Pick<Location, 'search' | 'state'>): string | null => {
  const redirectParam = new URLSearchParams(location.search).get('redirect');
  if (isSafeInternalPath(redirectParam) && !isAuthPath(redirectParam)) return redirectParam;

  const rawFrom = (location.state as { from?: unknown } | null)?.from;
  let path: string | undefined;
  if (typeof rawFrom === 'string') {
    path = rawFrom;
  } else if (rawFrom && typeof rawFrom === 'object' && 'pathname' in rawFrom) {
    const from = rawFrom as { pathname?: string; search?: string };
    path = `${from.pathname || ''}${from.search || ''}`;
  }
  if (isSafeInternalPath(path) && !isAuthPath(path)) return path;
  return null;
};

/** Router state that carries the return page across Login ↔ Signup links. */
export const returnState = (location: Pick<Location, 'search' | 'state'>) => {
  const from = getReturnPath(location);
  return from ? { from } : undefined;
};

/** Router state for a "Sign In" link: come back to the page the visitor is on now. */
export const currentPageState = (location: Pick<Location, 'pathname' | 'search' | 'state'>) => {
  if (isAuthPath(location.pathname)) return returnState(location);
  if (location.pathname === '/') return undefined;
  return { from: `${location.pathname}${location.search}` };
};

/** Go back inside the site; if this page was opened directly, go to the fallback instead. */
export const goBack = (navigate: NavigateFunction, location: Pick<Location, 'key'>, fallback: string) => {
  if (location.key && location.key !== 'default') {
    navigate(-1);
  } else {
    navigate(fallback);
  }
};
