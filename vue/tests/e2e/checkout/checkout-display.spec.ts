import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToCheckout } from '../fixtures/checkout.fixtures';

test.describe('Checkout Page Display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('displays plan details in order summary', async ({ page }) => {
    await navigateToCheckout(page, 'pro');

    await expect(page.locator('[data-testid="order-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-price"]')).toBeVisible();
  });

  test('displays confirm button', async ({ page }) => {
    await navigateToCheckout(page, 'pro');

    await expect(page.locator('[data-testid="confirm-checkout"]')).toBeVisible();
    // Button is disabled until all requirements are met (billing, payment, terms)
    await expect(page.locator('[data-testid="confirm-checkout"]')).toBeDisabled();
  });

  test('shows loading state while fetching plan', async ({ page }) => {
    await page.route('**/api/v1/tarif-plans/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    await navigateToCheckout(page, 'pro');

    await expect(page.locator('[data-testid="checkout-loading"]')).toBeVisible();
  });

  test('shows error for invalid plan slug', async ({ page }) => {
    await navigateToCheckout(page, 'invalid-plan-slug');

    await expect(page.locator('[data-testid="checkout-error"]')).toBeVisible();
  });

  test('offers inline sign-in to an unauthenticated user', async ({ page }) => {
    // Clear all auth state (cookies and localStorage)
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Checkout keeps an anonymous visitor on the page and offers the inline
    // email block (login / sign-up) instead of detouring through /login, so the
    // checkout context is not lost.
    await page.goto('/dashboard/checkout/pro');

    await expect(page.locator('[data-testid="email-block"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-summary"]')).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/checkout\/pro$/);
  });
});
