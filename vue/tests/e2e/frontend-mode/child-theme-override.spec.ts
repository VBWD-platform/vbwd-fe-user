/**
 * S152-11 spec 7 — the child-theme contract on a running stack, with the
 * `theme_demo` fixture (vbwd-backend/plugins/theme/tests/fixtures/theme_demo,
 * copied to plugins/theme_demo and enabled — see plugins/theme/docs/writing-a-theme.md).
 * Skips unless that plugin is enabled. The spec activates the `demo` theme in the
 * theme config (read on every render, no restart) and restores the saved config.
 */
import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import {
  CmsAdminFixtures,
  IS_THEME_MODE,
  THEME_ONLY_REASON,
  backendPluginSavedConfig,
  isBackendPluginEnabled,
  loginAdmin,
} from './frontend-mode-support';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const DEMO_PLUGIN_NAME = 'theme_demo';
const DEMO_THEME_SLUG = 'demo';
const DEMO_PRIMARY_TOKEN = '--vbwd-color-primary: #0a7f6f;';

test.describe('Child theme override (theme_demo)', () => {
  test.skip(!IS_THEME_MODE, THEME_ONLY_REASON);

  let api: APIRequestContext;
  let adminToken: string;
  let cms: CmsAdminFixtures;
  let savedThemeConfig: Record<string, unknown> | undefined;
  let pageSlug: string;

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: BASE_URL });
    adminToken = await loginAdmin(api);
    if (!(await isBackendPluginEnabled(api, adminToken, DEMO_PLUGIN_NAME))) return;
    const headers = { Authorization: `Bearer ${adminToken}` };
    savedThemeConfig = await backendPluginSavedConfig(api, adminToken, 'theme');
    await api.put('/api/v1/admin/plugins/theme/config', {
      headers,
      data: { ...savedThemeConfig, active_theme: DEMO_THEME_SLUG },
    });
    cms = new CmsAdminFixtures(api, adminToken);
    pageSlug = (await cms.post({ content_html: '<p>S152 child theme page</p>' })).slug;
  });

  test.afterAll(async () => {
    if (savedThemeConfig) {
      await api.put('/api/v1/admin/plugins/theme/config', {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: savedThemeConfig,
      });
    }
    await cms?.cleanup();
    await api?.dispose();
  });

  test('the demo template override and token reach a CMS page', async ({ page, request }) => {
    test.skip(savedThemeConfig === undefined, `${DEMO_PLUGIN_NAME} is not enabled on this stack`);

    await page.goto(`/${pageSlug}`);

    await expect(page.locator('[data-testid="theme-demo-banner"]')).toBeVisible();
    const stylesheetUrl = await page.locator('link[rel="stylesheet"][href*="/_render/_theme/public/theme.css"]').getAttribute('href');
    const stylesheet = await (await request.get(stylesheetUrl as string)).text();
    expect(stylesheet).toContain(DEMO_PRIMARY_TOKEN);
  });
});
