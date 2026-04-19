import { test, expect } from '@playwright/test';

/**
 * Production smoke test for the user-app plugin loader.
 *
 * Reproduces the reported issue:
 *   "SyntaxError: The requested module '.../vbwd-view-component.js'
 *    does not provide an export named 'fetchPluginManifest'"
 *
 * Run against production:
 *   E2E_BASE_URL=https://vbwd.cc npx playwright test plugins-prod
 */
test.describe('user plugins load cleanly in production', () => {
  test('/ has no fatal JS errors and fetches plugins.json', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const manifestResponses: Array<{ url: string; status: number }> = [];
    page.on('response', (response) => {
      if (response.url().endsWith('/plugins.json')) {
        manifestResponses.push({ url: response.url(), status: response.status() });
      }
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    const allErrors = [...pageErrors, ...consoleErrors];

    const moduleExportErrors = allErrors.filter((message) =>
      /does not provide an export named|fetchPluginManifest/i.test(message),
    );
    expect(moduleExportErrors, `module-export errors:\n${moduleExportErrors.join('\n')}`).toHaveLength(0);

    const pluginLoaderErrors = allErrors.filter((message) =>
      /pluginLoader|PluginRegistry|Failed to load plugin/i.test(message),
    );
    expect(pluginLoaderErrors, `plugin-loader errors:\n${pluginLoaderErrors.join('\n')}`).toHaveLength(0);

    expect(manifestResponses.length, 'plugins.json was never requested').toBeGreaterThan(0);
    for (const response of manifestResponses) {
      expect(response.status, response.url).toBe(200);
    }
  });
});
