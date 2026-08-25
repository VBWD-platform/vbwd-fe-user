import { test, expect } from '@playwright/test';

/**
 * Proves the address data (State/Region AND Zip/PostCode) is stored correctly:
 * fill the profile address form, save, reload, and assert BOTH values persisted
 * (round-tripped through PUT then GET /api/v1/user/details).
 */
test.describe('Profile address — State/Region persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'TestPass123@');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('saves and persists State/Region and Zip/PostCode across reload', async ({ page }) => {
    await page.goto('/dashboard/profile');

    const state = `TestState-${Date.now()}`;
    const postCode = `${Math.floor(10000 + Math.random() * 89999)}`;

    await page.fill('[data-testid="state-input"]', state);
    await page.fill('[data-testid="postal-code-input"]', postCode);
    await page.fill('[data-testid="city-input"]', 'Los Angeles');

    await page.click('[data-testid="save-profile"]');
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();

    // Reload — the form repopulates from GET /user/profile, proving storage.
    await page.reload();
    await expect(page.locator('[data-testid="state-input"]')).toHaveValue(state);
    await expect(page.locator('[data-testid="postal-code-input"]')).toHaveValue(postCode);
  });
});
