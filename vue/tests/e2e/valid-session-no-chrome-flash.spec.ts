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

/**
 * Record, from the first byte, whether UserLayout chrome is ever in the DOM
 * while the pathname is still `/`. The guarantee is about the root only — the
 * destination (/dashboard) legitimately has chrome.
 */
async function recordChromeAtRoot(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const flagged = window as unknown as { chromePaintedAtRoot: boolean };
    flagged.chromePaintedAtRoot = false;
    new MutationObserver(() => {
      if (window.location.pathname === '/' && document.querySelector('.user-layout')) {
        flagged.chromePaintedAtRoot = true;
      }
    }).observe(document, { childList: true, subtree: true });
  });
}

async function chromeWasPaintedAtRoot(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as { chromePaintedAtRoot: boolean }).chromePaintedAtRoot);
}

test('authenticated visitor at / never paints UserLayout chrome', async ({ page }) => {
  await loginViaUi(page);
  await recordChromeAtRoot(page);
  await page.goto('/'); // the reproducer trigger

  // `/` is a noLayout redirect bouncer for a signed-in visitor (→ /dashboard,
  // or the CMS default page when a `default` routing rule claims `/`). Either
  // way UserLayout chrome must never paint while the pathname is still `/`.
  await page.waitForLoadState('networkidle');
  expect(await chromeWasPaintedAtRoot(page)).toBe(false);
  await expect(page).not.toHaveURL(/\/login/);
});

test('anonymous visitor at / never paints UserLayout chrome', async ({ page }) => {
  await recordChromeAtRoot(page);
  await page.goto('/'); // no auth

  // An anonymous visitor gets the public CMS home rendered at `/` itself;
  // chrome must not appear at any point.
  await page.waitForLoadState('networkidle');
  expect(await chromeWasPaintedAtRoot(page)).toBe(false);
  await expect(page.locator('.user-layout')).toHaveCount(0);
});
