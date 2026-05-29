import { describe, it, expect } from 'vitest';
import router from '../../../src/router';

/**
 * The home route (`/`) is a redirect bouncer whose template is an empty
 * `<div/>`. `App.vue` paints `UserLayout` chrome around any route that is
 * not marked layout-free, so without `noLayout: true` an authenticated
 * visitor at `/` sees a flash of dashboard chrome around nothing while
 * `Home.vue` resolves its synchronous redirect.
 *
 * `App.vue` already short-circuits on `route.meta.noLayout === true`
 * (App.vue:39), so pinning the flag here guards the fix against a future
 * router refactor silently dropping it.
 *
 * See docs/dev_log/20260528/sprints/s29-fe-user-home-no-chrome-flash.md.
 */
describe('router: home route meta', () => {
  it('marks `/` as noLayout so App.vue does not paint chrome around the redirect bouncer', () => {
    const route = router.resolve('/');
    expect(route.meta.noLayout).toBe(true);
    expect(route.meta.requiresAuth).toBe(false);
  });
});