/**
 * Homepage (`/` and, via a router redirect, `/index.html`) fallback resolution.
 *
 * After the 2026-05-29 refactor, CMS middleware-layer routing rules (incl.
 * the `default` rule) are evaluated by the CMS plugin's router guard,
 * NOT by Home.vue. The guard runs as `router.beforeEach`, so when a rule
 * matches `/`, this view never mounts — its onMounted is the fallback
 * for when NO rule applies.
 *
 * Rules tested here (unchanged user-visible behaviour):
 *   - Authenticated visitor + no rule → /dashboard.
 *   - Anonymous visitor + no rule → DEFAULT_PUBLIC_SLUG.
 *   - The root must NEVER redirect to /login. Login is reserved for
 *     protected routes (router auth guard on `requiresAuth`).
 *
 * Rule-driven redirect cases are covered in
 * `vue/tests/unit/plugins/cms-routing-guard.spec.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Home from '../../../src/views/Home.vue';
import { isAuthenticated } from '@/api';

const replace = vi.fn();

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace }),
}));

vi.mock('@/api', () => ({
  isAuthenticated: vi.fn(() => false),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function mountHome() {
  mount(Home);
  await flushPromises();
}

describe('Home — fallback when no CMS routing rule fires', () => {
  it('falls back to /dashboard for an authenticated user', async () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);
    await mountHome();
    expect(replace).toHaveBeenCalledWith('/dashboard');
    expect(replace).not.toHaveBeenCalledWith('/login');
  });

  it('falls back to the public default slug (not /login) for an anonymous visitor', async () => {
    vi.mocked(isAuthenticated).mockReturnValue(false);
    await mountHome();
    expect(replace).toHaveBeenCalledWith('/home');
    expect(replace).not.toHaveBeenCalledWith('/login');
  });
});
