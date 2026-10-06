/**
 * S152-11 spec 1 — the frontend-mode sentinel. The backend's mode (from
 * `VBWD_FRONTEND_MODE` in vbwd-backend/.env) must match the mode this run asserts
 * (`E2E_FRONTEND_MODE`, default `vue`). It also catches `theme` mode with the
 * theme plugin disabled, which core cannot detect (D10).
 */
import { test, expect } from '@playwright/test';
import { FRONTEND_MODE, IS_THEME_MODE, MODE_PROBE_PATH, expectRenderedBy } from './frontend-mode-support';

test.describe(`Frontend mode sentinel (${FRONTEND_MODE})`, () => {
  test('the mode probe matches the asserted mode', async ({ request }) => {
    const response = await request.get(MODE_PROBE_PATH);

    if (IS_THEME_MODE) {
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ mode: 'theme' });
      return;
    }
    // vue mode mounts no probe: the nginx `/_render/` location has no SPA
    // fallback, so the backend's 404 reaches the client.
    expect(response.status()).toBe(404);
  });

  test('a public page carries the theme meta only in theme mode', async ({ page }) => {
    // `/login` is owned by fe-user core, so it is themed whenever the mode is theme.
    await page.goto('/login');

    await expectRenderedBy(page, FRONTEND_MODE);
  });
});
