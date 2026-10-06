import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './fixtures/checkout.fixtures';

test.describe('Tokens Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('displays page title', async ({ page }) => {
    await page.goto('/dashboard/tokens');
    await expect(page.locator('h1')).toContainText(/token/i);
  });

  test('displays available token bundles', async ({ page }) => {
    await page.goto('/dashboard/tokens');
    await expect(page.locator('[data-testid^="token-bundle-card-"]').first()).toBeVisible();
  });

  test('shows token amount for each bundle', async ({ page }) => {
    await page.goto('/dashboard/tokens');
    const card = page.locator('[data-testid^="token-bundle-card-"]').first();
    await expect(card.locator('[data-testid="token-amount"]')).toBeVisible();
  });

  test('shows price for each bundle', async ({ page }) => {
    await page.goto('/dashboard/tokens');
    const card = page.locator('[data-testid^="token-bundle-card-"]').first();
    await expect(card.locator('[data-testid="token-price"]')).toBeVisible();
  });

  test('can add token bundle to cart', async ({ page }) => {
    await page.goto('/dashboard/tokens');
    const addButton = page.locator('[data-testid^="add-to-cart-token-"]').first();
    await addButton.click();

    // Cart icon should show item count
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');
  });

  test('can navigate back to plans', async ({ page }) => {
    await page.goto('/dashboard/tokens');
    await page.click('[data-testid="back-to-plans"]');
    await expect(page).toHaveURL('/dashboard/plans');
  });

  test('can navigate to plans via breadcrumb', async ({ page }) => {
    await page.goto('/dashboard/tokens');
    await page.click('[data-testid="breadcrumb-plans"]');
    await expect(page).toHaveURL('/dashboard/plans');
  });
});
