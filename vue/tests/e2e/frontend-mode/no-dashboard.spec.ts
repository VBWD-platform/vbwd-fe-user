/**
 * S152-11 spec 8 — R6/D7: the dashboard and the whole tuktuk plugin are always the
 * SPA, in both modes; the auth-only `/shop/orders` is themed in theme mode.
 */
import { test } from '@playwright/test';
import { FRONTEND_MODE, expectRenderedBy, loginTestUserInBrowser } from './frontend-mode-support';

const SPA_ONLY_PATHS = ['/dashboard', '/dashboard/profile', '/tuktuk'];

test.describe(`No dashboard in themed pages (${FRONTEND_MODE})`, () => {
  test.beforeEach(async ({ page }) => {
    await loginTestUserInBrowser(page);
  });

  for (const spaOnlyPath of SPA_ONLY_PATHS) {
    test(`${spaOnlyPath} is always the SPA`, async ({ page }) => {
      await page.goto(spaOnlyPath);

      await expectRenderedBy(page, 'vue');
    });
  }

  test('/shop/orders (logged in) follows the mode', async ({ page }) => {
    await page.goto('/shop/orders');

    await expectRenderedBy(page, FRONTEND_MODE);
  });
});
