/**
 * S152-11 spec 5 — R7/D12 access levels on a CMS page. A seeded layout holds an
 * upsell widget visible only to the anonymous `new` level and a gated widget for
 * the `logged-in` level. Anonymous visitors see the upsell; the test user sees the
 * gated content; the anonymous page source never contains it. Same spec in both
 * modes: the cms API filters by the caller's token for either renderer.
 */
import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import {
  CmsAdminFixtures,
  FRONTEND_MODE,
  accessLevelIdsBySlug,
  fetchNavigationHtml,
  loginAdmin,
  loginTestUserInBrowser,
  uniqueSlug,
} from './frontend-mode-support';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const ANONYMOUS_LEVEL_SLUG = 'new';
const DEFAULT_USER_LEVEL_SLUG = 'logged-in';

test.describe(`Access-level regions on a CMS page (${FRONTEND_MODE})`, () => {
  let api: APIRequestContext;
  let cms: CmsAdminFixtures;
  let pageSlug: string;
  const upsellText = uniqueSlug('S152 upsell');
  const gatedText = uniqueSlug('S152 gated content');

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: BASE_URL });
    const adminToken = await loginAdmin(api);
    cms = new CmsAdminFixtures(api, adminToken);
    const levelIds = await accessLevelIdsBySlug(api, adminToken);
    const upsell = await cms.htmlWidget(`<p data-testid="s152-upsell">${upsellText}</p>`);
    const gated = await cms.htmlWidget(`<p data-testid="s152-gated">${gatedText}</p>`);
    const layout = await cms.layout(
      [
        { name: 'main', type: 'content' },
        { name: 'upsell', type: 'header' },
        { name: 'gated', type: 'header' },
      ],
      [
        { widget_id: upsell.id, area_name: 'upsell', sort_order: 0, required_access_level_ids: [levelIds[ANONYMOUS_LEVEL_SLUG]] },
        { widget_id: gated.id, area_name: 'gated', sort_order: 0, required_access_level_ids: [levelIds[DEFAULT_USER_LEVEL_SLUG]] },
      ],
    );
    pageSlug = (await cms.post({ layout_id: layout.id, content_html: '<p>S152 access page</p>' })).slug;
  });

  test.afterAll(async () => {
    await cms?.cleanup();
    await api?.dispose();
  });

  test('an anonymous visitor sees the upsell, not the gated content', async ({ page }) => {
    await page.goto(`/${pageSlug}`);

    await expect(page.locator('[data-testid="s152-upsell"]')).toHaveText(upsellText);
    await expect(page.locator('[data-testid="s152-gated"]')).toHaveCount(0);
  });

  test('a user holding the level sees the gated content instead', async ({ page }) => {
    await loginTestUserInBrowser(page);
    await page.goto(`/${pageSlug}`);

    await expect(page.locator('[data-testid="s152-gated"]')).toHaveText(gatedText);
    await expect(page.locator('[data-testid="s152-upsell"]')).toHaveCount(0);
  });

  test('the anonymous page source never contains the gated content', async ({ request }) => {
    const html = await fetchNavigationHtml(request, `/${pageSlug}`);

    expect(html).not.toContain(gatedText);
  });
});
