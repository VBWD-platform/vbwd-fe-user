import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToCheckout, fillCheckoutRequirements } from '../fixtures/checkout.fixtures';

test.describe('Post-Checkout Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await navigateToCheckout(page, 'pro');
    await fillCheckoutRequirements(page);
    await page.click('[data-testid="confirm-checkout"]');
    await page.waitForSelector('[data-testid="checkout-success"]');
  });

  test('can navigate to subscription page', async ({ page }) => {
    await page.click('[data-testid="view-subscription-btn"]');

    await expect(page).toHaveURL('/dashboard/subscription');
  });

  test('can navigate to invoices page', async ({ page }) => {
    await page.click('[data-testid="view-invoice-btn"]');

    await expect(page).toHaveURL(/\/dashboard\/invoice\//);
  });

  test('can go back to plans', async ({ page }) => {
    await page.click('[data-testid="back-to-plans-btn"]');

    await expect(page).toHaveURL('/dashboard/plans');
  });
});
