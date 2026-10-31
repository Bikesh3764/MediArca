import { describe, expect, it, vi } from 'vitest';
import { currentPageState, getReturnPath, goBack, returnState } from '../utils/authRedirect';

const loc = (search = '', state: unknown = null, pathname = '/login') => ({ pathname, search, state, key: 'abc' });

describe('authRedirect', () => {
  it('returns the booking page saved by ProtectedRoute, with its query', () => {
    expect(getReturnPath(loc('', { from: { pathname: '/book/d1', search: '?date=2026-11-01' } }))).toBe(
      '/book/d1?date=2026-11-01'
    );
  });

  it('prefers ?redirect= and ignores outside or auth pages', () => {
    expect(getReturnPath(loc('?redirect=/clinic-checkin?c=1'))).toBe('/clinic-checkin?c=1');
    expect(getReturnPath(loc('?redirect=//evil.com'))).toBeNull();
    expect(getReturnPath(loc('', { from: '/signup' }))).toBeNull();
    expect(getReturnPath(loc('', { from: '/patient/login?x=1' }))).toBeNull();
  });

  it('carries the return page across Login and Signup links', () => {
    expect(returnState(loc('', { from: '/book/d1' }))).toEqual({ from: '/book/d1' });
    expect(returnState(loc())).toBeUndefined();
  });

  it('Sign In links come back to the current page, not home', () => {
    expect(currentPageState(loc('?clinicId=c1', null, '/doctor/d1'))).toEqual({ from: '/doctor/d1?clinicId=c1' });
    expect(currentPageState(loc('', null, '/'))).toBeUndefined();
  });

  it('Back stays on the site when the page was opened directly', () => {
    const navigate = vi.fn();
    goBack(navigate, { key: 'default' }, '/doctors');
    expect(navigate).toHaveBeenCalledWith('/doctors');
    goBack(navigate, { key: 'x1' }, '/doctors');
    expect(navigate).toHaveBeenLastCalledWith(-1);
  });
});
