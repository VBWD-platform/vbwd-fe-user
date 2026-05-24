import { test, expect } from '@playwright/test';

/**
 * Flash-of-dashboard regression + login-only-for-the-inner-world
 * (sprints 2026-05-23/01 and /02).
 *
 * A user logs in, closes the window, and re-opens after their JWT has
 * expired. The token still lives in localStorage. We assert:
 *   1. A protected route (/dashboard) refuses the stale session and lands
 *      on /login WITHOUT ever painting the dashboard (no flash).
 *   2. The public root (/) NEVER bounces to /login — it resolves via CMS
 *      routing rules / the public default slug.
 */

/** Build a decodable JWT-shaped string with the given payload (unsigned). */
function makeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`;
}

const expiredJwt = () =>
  makeJwt({ exp: Math.floor(Date.now() / 1000) - 3600, sub: 'u-1' });

async function loginThenExpireToken(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'TestPass123@');
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL('/dashboard');

  // Simulate re-opening after the JWT has expired.
  await page.evaluate((token) => {
    localStorage.setItem('auth_token', token);
  }, expiredJwt());
}

test.describe('Stale session', () => {
  test('protected route with an expired token → /login, dashboard never paints', async ({ page }) => {
    await loginThenExpireToken(page);

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('dashboard-root')).toHaveCount(0);

    // The stale session was purged, not merely hidden.
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeNull();
  });

  test('public root with an expired token → never /login', async ({ page }) => {
    await loginThenExpireToken(page);

    await page.goto('/');

    // The homepage resolves to a public page (CMS rule or default slug);
    // it must not bounce the visitor to the login screen.
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByTestId('dashboard-root')).toHaveCount(0);
  });
});
