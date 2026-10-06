import { Page } from '@playwright/test';

export const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPass123@',
};

export async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', TEST_USER.email);
  await page.fill('[data-testid="password"]', TEST_USER.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

/**
 * A complete billing profile for the test user. For an authenticated buyer the
 * checkout shows the billing address read-only from `/user/details`, so the
 * profile itself must be complete (other specs, e.g. profile.spec.ts, edit it).
 */
const TEST_USER_BILLING_DETAILS = {
  first_name: 'Test',
  last_name: 'User',
  address_line_1: '123 Test Street',
  city: 'Test City',
  postal_code: '12345',
  country: 'DE',
};

async function ensureBillingDetailsForSignedInUser(page: Page): Promise<void> {
  const authToken = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!authToken) return;
  const response = await page.request.put('/api/v1/user/details', {
    headers: { Authorization: `Bearer ${authToken}` },
    data: TEST_USER_BILLING_DETAILS,
  });
  if (!response.ok()) {
    throw new Error(`could not set test user billing details: ${response.status()} ${await response.text()}`);
  }
}

export async function navigateToCheckout(page: Page, planSlug: string = 'pro'): Promise<void> {
  await ensureBillingDetailsForSignedInUser(page);
  await page.goto(`/dashboard/checkout/${planSlug}`);
}

export async function selectPlanFromList(page: Page): Promise<void> {
  await page.goto('/dashboard/plans');
  await page.click('[data-testid^="select-plan-"]');
  await page.waitForURL(/\/checkout\//);
}

/**
 * Fill out checkout form requirements to enable the confirm button
 * Requirements: billing address, payment method, terms acceptance
 *
 * Note: Requires payment methods to be configured in admin panel.
 * If no payment methods exist, this will throw an error.
 */
export async function fillCheckoutRequirements(page: Page): Promise<void> {
  // Wait for checkout form to load
  await page.waitForSelector('[data-testid="order-summary"]');

  // Wait for billing address block to load (it fetches countries async)
  await page.waitForSelector('[data-testid="billing-address-block"]');
  await page.waitForSelector('[data-testid="billing-street"]', { timeout: 5000 });

  // An authenticated buyer's address is read-only (taken from the profile, see
  // navigateToCheckout); an anonymous buyer fills the required fields.
  if (await page.locator('[data-testid="billing-street"]').isEditable()) {
    await page.fill('[data-testid="billing-first-name"]', 'Test');
    await page.fill('[data-testid="billing-last-name"]', 'User');
    await page.fill('[data-testid="billing-street"]', '123 Test Street');
    await page.fill('[data-testid="billing-city"]', 'Test City');
    await page.fill('[data-testid="billing-zip"]', '12345');
    await page.locator('[data-testid="billing-country"]').selectOption({ index: 1 });
  }

  // Wait for payment methods block to finish loading
  await page.waitForSelector('[data-testid="payment-methods-block"]');
  // Wait for loading indicator to disappear
  await page.waitForSelector('[data-testid="payment-methods-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

  // Select first payment method if available
  const paymentMethod = page.locator('[data-testid^="payment-method-"]').first();
  const paymentMethodCount = await page.locator('[data-testid^="payment-method-"]').count();
  if (paymentMethodCount > 0) {
    await paymentMethod.click();
  }

  // Accept terms checkbox
  const termsCheckbox = page.locator('[data-testid="terms-checkbox"] input[type="checkbox"]');
  await termsCheckbox.check();

  // Wait for button to be enabled (with longer timeout for async validation)
  await page.waitForSelector('[data-testid="confirm-checkout"]:not([disabled])', { timeout: 10000 });
}
