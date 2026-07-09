import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The `/` (name `home`) route now renders the home CMS post IN PLACE for
 * anonymous visitors (no client redirect to `/home`). The ONE product decision
 * that stays host-owned is: an AUTHENTICATED visitor at `/` belongs on their
 * dashboard, not the marketing homepage. That redirect lives in the host
 * navigation guard (fires before the component mounts, so no chrome flash),
 * NOT in a plugin or in the home component.
 */

const { isAuthenticated, hasUserPermission, sessionExpired } = vi.hoisted(() => ({
  isAuthenticated: vi.fn(() => false),
  hasUserPermission: vi.fn((_perm?: string) => true),
  sessionExpired: { value: false },
}));

vi.mock('@/api', () => ({
  isAuthenticated: () => isAuthenticated(),
  hasUserPermission: (perm: string) => hasUserPermission(perm),
  sessionExpired,
}));

import { authNavigationGuard } from '../../../src/router';

type NextArg = Parameters<typeof authNavigationGuard>[2];

function runGuard(to: Record<string, unknown>) {
  const next = vi.fn() as unknown as NextArg;
  // The guard is typed `NavigationGuardWithThis<undefined>` (this: undefined);
  // call via .call(undefined, …) so a plain invocation's `this: void` doesn't
  // trip TS2684.
  authNavigationGuard.call(
    undefined,
    { meta: {}, ...to } as Parameters<typeof authNavigationGuard>[0],
    undefined as unknown as Parameters<typeof authNavigationGuard>[1],
    next,
  );
  return next as unknown as ReturnType<typeof vi.fn>;
}

describe('router: authNavigationGuard — home vs dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionExpired.value = false;
    isAuthenticated.mockReturnValue(false);
    hasUserPermission.mockReturnValue(true);
  });

  it('redirects an AUTHENTICATED visitor at `/` (home) to the dashboard', () => {
    isAuthenticated.mockReturnValue(true);
    const next = runGuard({ name: 'home', fullPath: '/', meta: { requiresAuth: false } });
    expect(next).toHaveBeenCalledWith({ name: 'dashboard' });
  });

  it('lets an AUTHENTICATED visitor preview the public home when public_home=1', () => {
    isAuthenticated.mockReturnValue(true);
    const next = runGuard({
      name: 'home',
      fullPath: '/?public_home=1',
      query: { public_home: '1' },
      meta: { requiresAuth: false },
    });
    expect(next).toHaveBeenCalledWith();
    expect(next).not.toHaveBeenCalledWith({ name: 'dashboard' });
  });

  it('still bounces an AUTHENTICATED visitor to dashboard for a bare `/` (no flag)', () => {
    isAuthenticated.mockReturnValue(true);
    const next = runGuard({
      name: 'home',
      fullPath: '/',
      query: {},
      meta: { requiresAuth: false },
    });
    expect(next).toHaveBeenCalledWith({ name: 'dashboard' });
  });

  it('lets an ANONYMOUS visitor render `/` in place (no redirect to /home or /login)', () => {
    isAuthenticated.mockReturnValue(false);
    const next = runGuard({ name: 'home', fullPath: '/', meta: { requiresAuth: false } });
    expect(next).toHaveBeenCalledWith();
    expect(next).not.toHaveBeenCalledWith('/home');
  });

  it('still redirects an expired session to login', () => {
    sessionExpired.value = true;
    const next = runGuard({ name: 'home', fullPath: '/', meta: { requiresAuth: false } });
    expect(next).toHaveBeenCalledWith({ name: 'login' });
  });
});
