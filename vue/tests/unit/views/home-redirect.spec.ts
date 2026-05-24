/**
 * Homepage (`/` and, via a router redirect, `/index.html`) resolution.
 *
 * Rules (sprint 2026-05-23/02):
 *   - A CMS "default" routing rule wins → redirect to its target slug.
 *   - No rule + authenticated → /dashboard.
 *   - No rule + anonymous → the public default slug, NOT /login.
 *   - The root must NEVER redirect to /login. Login is reserved for
 *     protected routes (router guard on `requiresAuth`).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Home from '../../../src/views/Home.vue';
import { api, isAuthenticated } from '@/api';

const replace = vi.fn();

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace }),
}));

vi.mock('@/api', () => ({
  api: { get: vi.fn() },
  isAuthenticated: vi.fn(() => false),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function mountHome() {
  mount(Home);
  await flushPromises();
}

describe('Home redirect', () => {
  it('redirects to the CMS default routing-rule target when one exists', async () => {
    vi.mocked(api.get).mockResolvedValue([
      { match_type: 'default', target_slug: 'welcome', is_active: true, layer: 'middleware' },
    ]);
    await mountHome();
    expect(replace).toHaveBeenCalledWith('/welcome');
    expect(replace).not.toHaveBeenCalledWith('/login');
  });

  it('falls back to /dashboard for an authenticated user when no rule exists', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(isAuthenticated).mockReturnValue(true);
    await mountHome();
    expect(replace).toHaveBeenCalledWith('/dashboard');
    expect(replace).not.toHaveBeenCalledWith('/login');
  });

  it('falls back to the public default slug (not /login) for an anonymous visitor', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(isAuthenticated).mockReturnValue(false);
    await mountHome();
    expect(replace).toHaveBeenCalledWith('/home');
    expect(replace).not.toHaveBeenCalledWith('/login');
  });

  it('never redirects to /login even when the routing-rules call fails', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network'));
    vi.mocked(isAuthenticated).mockReturnValue(false);
    await mountHome();
    expect(replace).toHaveBeenCalledWith('/home');
    expect(replace).not.toHaveBeenCalledWith('/login');
  });
});
