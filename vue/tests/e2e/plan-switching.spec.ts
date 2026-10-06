import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToCheckout, fillCheckoutRequirements } from './fixtures/checkout.fixtures';

test.describe('Plan Selection and Switching', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('displays available plans', async ({ page }) => {
    await page.goto('/dashboard/plans');

    // Wait for plans to load
    await page.waitForSelector('[data-testid="plans-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Should show plans grid
    await expect(page.locator('[data-testid="tariff-plan-grid"]')).toBeVisible();
  });

  test('shows plan details with price', async ({ page }) => {
    await page.goto('/dashboard/plans');
    await page.waitForSelector('[data-testid="plans-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Check for plan cards
    const planCards = page.locator('[data-testid^="tariff-plan-card-"]');
    await expect(planCards.first()).toBeVisible();

    // Each plan should have a price
    await expect(page.locator('.tariff-plan-card__price').first()).toBeVisible();
  });

  test('can select a plan and navigate to checkout', async ({ page }) => {
    await page.goto('/dashboard/plans');
    await page.waitForSelector('[data-testid="plans-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Click select button on first non-current plan
    const selectButton = page.locator('[data-testid^="select-plan-"]:not([disabled])').first();
    await selectButton.click();

    // Should navigate to checkout
    await expect(page).toHaveURL(/\/checkout\//);
  });

  test('checkout page shows order summary', async ({ page }) => {
    await page.goto('/dashboard/plans');
    await page.waitForSelector('[data-testid="plans-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Select a plan
    const selectButton = page.locator('[data-testid^="select-plan-"]:not([disabled])').first();
    await selectButton.click();

    // Wait for checkout page
    await page.waitForURL(/\/checkout\//);

    // Should show order summary
    await expect(page.locator('[data-testid="order-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-price"]')).toBeVisible();
  });

  test('checkout page has confirm button', async ({ page }) => {
    await navigateToCheckout(page, 'pro');

    // Wait for loading to complete
    await page.waitForSelector('[data-testid="checkout-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    await expect(page.locator('[data-testid="confirm-checkout"]')).toBeVisible();
    // Enabled once the billing / payment / terms requirements are met.
    await fillCheckoutRequirements(page);
    await expect(page.locator('[data-testid="confirm-checkout"]')).toBeEnabled();
  });

  test('completing checkout creates invoice', async ({ page }) => {
    await navigateToCheckout(page, 'pro');
    await page.waitForSelector('[data-testid="checkout-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    await fillCheckoutRequirements(page);

    // Click confirm
    await page.click('[data-testid="confirm-checkout"]');

    // Wait for checkout to complete
    await page.waitForSelector('[data-testid="checkout-success"]', { timeout: 15000 });

    // Should show invoice number
    await expect(page.locator('[data-testid="invoice-number"]')).toBeVisible();
    const invoiceNumber = await page.locator('[data-testid="invoice-number"]').textContent();
    expect(invoiceNumber).toContain('INV-');
  });

  test('checkout success shows subscription status', async ({ page }) => {
    await navigateToCheckout(page, 'pro');
    await page.waitForSelector('[data-testid="checkout-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    await fillCheckoutRequirements(page);

    await page.click('[data-testid="confirm-checkout"]');
    await page.waitForSelector('[data-testid="checkout-success"]', { timeout: 15000 });

    // Should show subscription status as pending
    await expect(page.locator('[data-testid="subscription-status"]')).toBeVisible();
  });

  test('checkout success shows payment required message', async ({ page }) => {
    await navigateToCheckout(page, 'pro');
    await page.waitForSelector('[data-testid="checkout-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    await fillCheckoutRequirements(page);

    await page.click('[data-testid="confirm-checkout"]');
    await page.waitForSelector('[data-testid="checkout-success"]', { timeout: 15000 });

    await expect(page.locator('[data-testid="payment-required-message"]')).toBeVisible();
  });

  test('checkout success shows invoice line items', async ({ page }) => {
    await navigateToCheckout(page, 'pro');
    await page.waitForSelector('[data-testid="checkout-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    await fillCheckoutRequirements(page);

    await page.click('[data-testid="confirm-checkout"]');
    await page.waitForSelector('[data-testid="checkout-success"]', { timeout: 15000 });

    await expect(page.locator('[data-testid="invoice-line-items"]')).toBeVisible();
  });

  test('can navigate to invoice after checkout', async ({ page }) => {
    await navigateToCheckout(page, 'pro');
    await page.waitForSelector('[data-testid="checkout-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    await fillCheckoutRequirements(page);

    await page.click('[data-testid="confirm-checkout"]');
    await page.waitForSelector('[data-testid="checkout-success"]', { timeout: 15000 });

    // Click view invoice button
    await page.click('[data-testid="view-invoice-btn"]');

    // Should navigate to invoices page
    await expect(page).toHaveURL(/\/dashboard\/invoice\//);
  });

  test('new invoice appears in invoices list after checkout', async ({ page }) => {
    // First complete a checkout
    await navigateToCheckout(page, 'pro');
    await page.waitForSelector('[data-testid="checkout-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    await fillCheckoutRequirements(page);

    await page.click('[data-testid="confirm-checkout"]');
    await page.waitForSelector('[data-testid="checkout-success"]', { timeout: 15000 });

    // Get the invoice number
    const invoiceNumberText = await page.locator('[data-testid="invoice-number"]').textContent();
    const invoiceNumber = invoiceNumberText?.replace('Invoice: ', '').trim();

    // Navigate to invoices page
    await page.goto('/dashboard/subscription/invoices');
    await page.waitForSelector('[data-testid="invoices-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Search for the invoice
    if (invoiceNumber) {
      await page.fill('[data-testid="invoice-search"]', invoiceNumber);
      await page.waitForTimeout(500);

      // Should find the invoice
      await expect(page.locator(`text=${invoiceNumber}`)).toBeVisible();
    }
  });
});

test.describe('Plan Switching with Token Bundles', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('can add token bundle to checkout', async ({ page }) => {
    await navigateToCheckout(page, 'pro');
    await page.waitForSelector('[data-testid="checkout-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Add token bundle if available
    const bundleSection = page.locator('[data-testid="token-bundles-section"]');
    const hasBundles = await bundleSection.isVisible().catch(() => false);

    if (hasBundles) {
      // Use .first() to handle duplicate test data
      await page.locator('[data-testid="token-bundle-1000"]').first().click();

      // Verify bundle appears in order
      const orderSummary = page.locator('[data-testid="order-summary"]');
      const hasBundle = await orderSummary.locator('[data-testid^="line-item-token-bundle-"]').first().isVisible();
      expect(hasBundle).toBe(true);
    }
  });

  test('invoice includes token bundle after checkout with bundle', async ({ page }) => {
    await navigateToCheckout(page, 'pro');
    await page.waitForSelector('[data-testid="checkout-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Add token bundle if available
    const bundleSection = page.locator('[data-testid="token-bundles-section"]');
    const hasBundles = await bundleSection.isVisible().catch(() => false);

    if (hasBundles) {
      await page.locator('[data-testid="token-bundle-1000"]').first().click();
    }

    await fillCheckoutRequirements(page);

    // Complete checkout
    await page.click('[data-testid="confirm-checkout"]');
    await page.waitForSelector('[data-testid="checkout-success"]', { timeout: 15000 });

    // Invoice should have line items
    await expect(page.locator('[data-testid="invoice-line-items"]')).toBeVisible();

    if (hasBundles) {
      // Should include token bundle line item
      await expect(page.locator('[data-testid="invoice-line-item-token_bundle"]')).toBeVisible();
    }
  });
});
