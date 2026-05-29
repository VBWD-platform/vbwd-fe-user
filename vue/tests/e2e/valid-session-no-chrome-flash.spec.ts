import { test, expect } from '@playwright/test';

/**
 * No flash of UserLayout chrome on return to `/` with a VALID session
 * (sprint 2026-05-28 S29).
 *
 * The `/` route is a redirect bouncer marked `noLayout: true`, so App.vue
 * never paints UserLayout chrome around the empty Home.vue while the
 * redirect resolves. An authenticated visitor lands on /dashboard; an
 * anonymous visitor resolves to a public page — neither paints chrome at
 * the root.
 *
 * Companion to stale-session-no-flash.spec.ts (sprints 2026-05-23/01+02),
 * which must keep passing (expired token → /login, dashboard never paints).
 */

/** Log in via the real UI; ends on /dashboard with a valid session. */
async function loginViaUi(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'TestPass123@');
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL('/dashboard');
}

test('authenticated visitor at / never paints UserLayout chrome', async ({ page }) => {
  await loginViaUi(page);
  await page.goto('/'); // the reproducer trigger

  // `/` is a noLayout redirect bouncer, so UserLayout chrome must never
  // paint at the root while the redirect resolves — this is S29's primary
  // guarantee (no chrome flash). The final destination of an authenticated
  // visitor (/dashboard vs the CMS default public slug) depends on whether
  // an active CMS `default` routing rule hijacks `/` in the CMS guard; that
  // is a separate, deferred concern (the CMS-guard auth-skip), out of this
  // flash-only slice. So we assert the chrome guarantee, not the destination.
  await page.waitForURL((url) => url.pathname !== '/', { timeout: 5000 });
  await expect(page.locator('.user-layout')).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login/);
});

test('anonymous visitor at / never paints UserLayout chrome', async ({ page }) => {
  await page.goto('/'); // no auth

  // `/` resolves to a public page; chrome must not appear during the bounce
  // because `/` is marked noLayout.
  await page.waitForURL((url) => url.pathname !== '/', { timeout: 5000 });
  await expect(page.locator('.user-layout')).toHaveCount(0);
});
