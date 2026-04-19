import { test, expect } from '@playwright/test';

/**
 * Production audit of CMS plugin on vbwd.cc.
 *
 * Verifies both frontend (manifest + pluginLoader) and backend (public CMS API).
 *
 * Run: E2E_BASE_URL=https://vbwd.cc npx playwright test prod-cms-plugin
 */

test.describe('vbwd.cc — CMS plugin', () => {
  test('user /plugins.json has cms enabled', async ({ request }) => {
    const response = await request.get('/plugins.json');
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.plugins?.cms?.enabled).toBe(true);
  });

  test('frontend pluginLoader loads cms plugin', async ({ page }) => {
    const loadedPluginNames: string[] = [];
    const pluginErrors: string[] = [];

    page.on('console', (msg) => {
      const match = msg.text().match(/Loaded enabled plugin:\s*([\w-]+)/);
      if (match) loadedPluginNames.push(match[1]);
      if (msg.type() === 'error' && /plugin|cms/i.test(msg.text())) {
        pluginErrors.push(msg.text());
      }
    });
    page.on('pageerror', (error) => pluginErrors.push(error.message));

    await page.goto('/', { waitUntil: 'networkidle' });

    expect(pluginErrors, pluginErrors.join('\n')).toHaveLength(0);
    expect(loadedPluginNames).toContain('cms');
  });

  test('backend CMS API /api/v1/cms/pages is registered', async ({ request }) => {
    // Public endpoint — should return 200 with a list (possibly empty), NOT "Not found".
    const response = await request.get('/api/v1/cms/pages', {
      failOnStatusCode: false,
    });

    const body = await response.text();
    console.log(`[AUDIT] /api/v1/cms/pages → ${response.status()}: ${body.substring(0, 200)}`);

    expect(
      response.status(),
      `if 404 the backend cms plugin is not registered in production; response: ${body}`,
    ).toBe(200);

    const data = JSON.parse(body);
    expect(data).toHaveProperty('pages');
  });

  test('frontend renders a CMS page by slug if any exist', async ({ request, page }) => {
    const listResponse = await request.get('/api/v1/cms/pages', { failOnStatusCode: false });
    test.skip(listResponse.status() !== 200, 'Backend CMS not available — skipping slug render test');

    const { pages = [] } = await listResponse.json();
    test.skip(!pages.length, 'No CMS pages published — skipping slug render test');

    const firstSlug = pages[0].slug;
    await page.goto(`/${firstSlug}`, { waitUntil: 'networkidle' });
    // CMS pages typically render title in an h1 or the content area
    await expect(page.locator('body')).toContainText(pages[0].title ?? firstSlug);
  });
});
