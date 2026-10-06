/**
 * S152-11 spec 3 — themed CMS pages are complete HTML: with JavaScript disabled
 * the home page and a seeded page still show their title and body.
 */
import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import {
  CmsAdminFixtures,
  IS_THEME_MODE,
  THEME_ONLY_REASON,
  THEME_META_SELECTOR,
  loginAdmin,
  uniqueSlug,
} from './frontend-mode-support';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

test.describe('Themed CMS without JavaScript', () => {
  test.skip(!IS_THEME_MODE, THEME_ONLY_REASON);
  test.use({ javaScriptEnabled: false });

  let api: APIRequestContext;
  let cms: CmsAdminFixtures;
  const pageTitle = uniqueSlug('S152 no-JS page');
  const pageBody = uniqueSlug('Body rendered on the server');
  let pageSlug: string;

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: BASE_URL });
    cms = new CmsAdminFixtures(api, await loginAdmin(api));
    pageSlug = (await cms.post({ title: pageTitle, content_html: `<p>${pageBody}</p>` })).slug;
  });

  test.afterAll(async () => {
    await cms?.cleanup();
    await api?.dispose();
  });

  test('the home page renders its content without JavaScript', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator(THEME_META_SELECTOR)).toHaveCount(1);
    await expect(page.locator('.cms-page')).toBeVisible();
    expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(0);
  });

  test('a seeded page shows its title and body without JavaScript', async ({ page }) => {
    await page.goto(`/${pageSlug}`);

    await expect(page.locator('h1.cms-page__title')).toHaveText(pageTitle);
    await expect(page.locator('.cms-page__body')).toContainText(pageBody);
  });
});
