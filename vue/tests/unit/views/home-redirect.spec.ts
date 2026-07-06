/**
 * Home.vue is now an INERT host fallback for `/` (S120).
 *
 * The CMS plugin owns `/` at runtime (it registers a `/` route named `home`
 * that overrides this record and renders the home CMS post in place). Home.vue
 * only renders when the CMS plugin is absent, and it performs NO client
 * redirect — in particular it must NEVER bounce a visitor to the legacy
 * `/home` slug (the source of the soft-404). The authenticated `/` →
 * `/dashboard` redirect moved to the router's `authNavigationGuard`
 * (see vue/tests/unit/router/home-auth-guard.spec.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Home from '../../../src/views/Home.vue';

const replace = vi.fn();

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Home — inert fallback (no client redirect)', () => {
  it('performs no client redirect (never bounces to /home or /login)', async () => {
    mount(Home);
    await flushPromises();
    expect(replace).not.toHaveBeenCalled();
  });
});
