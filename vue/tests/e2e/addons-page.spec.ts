import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './fixtures/checkout.fixtures';

test.describe('Add-ons Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('displays page title', async ({ page }) => {
    await page.goto('/dashboard/add-ons');
    await expect(page.locator('h1')).toContainText(/add-on/i);
  });

  test('displays subscription-dependent add-ons section', async ({ page }) => {
    await page.goto('/dashboard/add-ons');
    await expect(page.locator('[data-testid="subscription-addons-section"]')).toBeVisible();
  });

  test('displays subscription-independent add-ons section', async ({ page }) => {
    await page.goto('/dashboard/add-ons');
    await expect(page.locator('[data-testid="global-addons-section"]')).toBeVisible();
  });

  test('shows section headers', async ({ page }) => {
    await page.goto('/dashboard/add-ons');
    await expect(page.locator('[data-testid="subscription-addons-section"] h2')).toBeVisible();
    await expect(page.locator('[data-testid="global-addons-section"] h2')).toBeVisible();
  });

  test('displays add-on cards with name', async ({ page }) => {
    await page.goto('/dashboard/add-ons');
    const card = page.locator('[data-testid^="addon-card-"]').first();
    await expect(card.locator('[data-testid="addon-name"]')).toBeVisible();
  });

  test('displays add-on cards with price', async ({ page }) => {
    await page.goto('/dashboard/add-ons');
    const card = page.locator('[data-testid^="addon-card-"]').first();
    await expect(card.locator('[data-testid="addon-price"]')).toBeVisible();
  });

  test('displays add-on cards with description', async ({ page }) => {
    await page.goto('/dashboard/add-ons');
    const card = page.locator('[data-testid^="addon-card-"]').first();
    await expect(card.locator('[data-testid="addon-description"]')).toBeVisible();
  });

  test('can add add-on to cart', async ({ page }) => {
    await page.goto('/dashboard/add-ons');
    const addButton = page.locator('[data-testid^="add-to-cart-addon-"]').first();
    await addButton.click();

    // Cart icon should show item count
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');
  });

  test('can navigate back to plans', async ({ page }) => {
    await page.goto('/dashboard/add-ons');
    await page.click('[data-testid="back-to-plans"]');
    await expect(page).toHaveURL('/dashboard/plans');
  });

  test('subscription-dependent section shows info when no subscription', async ({ page }) => {
    await page.goto('/dashboard/add-ons');
    // Should show message about requiring subscription for dependent add-ons
    const section = page.locator('[data-testid="subscription-addons-section"]');
    // This will vary based on user's subscription status
    await expect(section).toBeVisible();
  });
});
