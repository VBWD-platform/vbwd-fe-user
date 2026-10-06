import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { loginAsTestUser, navigateToCheckout, fillCheckoutRequirements } from '../fixtures/checkout.fixtures';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'AdminPass123@';

/** The backend's checkout error for a plan that exists but is not purchasable. */
const INACTIVE_PLAN_ERROR = 'Plan is not active';

test.describe('Checkout Submission', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await navigateToCheckout(page, 'pro');
    await fillCheckoutRequirements(page);
  });

  test('creates pending subscription on confirm', async ({ page }) => {
    await page.click('[data-testid="confirm-checkout"]');

    await expect(page.locator('[data-testid="checkout-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscription-status"]')).toHaveText('Pending');
  });

  test('shows invoice number after checkout', async ({ page }) => {
    await page.click('[data-testid="confirm-checkout"]');

    await expect(page.locator('[data-testid="invoice-number"]')).toBeVisible();
    await expect(page.locator('[data-testid="invoice-number"]')).toContainText('INV-');
  });

  test('shows payment required message', async ({ page }) => {
    await page.click('[data-testid="confirm-checkout"]');

    await expect(page.locator('[data-testid="payment-required-message"]')).toBeVisible();
  });

  test('shows invoice line items after checkout', async ({ page }) => {
    // Note: fillCheckoutRequirements already called in beforeEach
    await page.click('[data-testid="token-bundle-1000"]');
    await page.click('[data-testid="addon-priority-support"]');
    await page.click('[data-testid="confirm-checkout"]');

    const lineItems = page.locator('[data-testid^="invoice-line-item-"]');
    await expect(lineItems).toHaveCount(3); // subscription + bundle + addon
  });

  test('shows loading state during submission', async ({ page }) => {
    // Delay only (the request still reaches the real backend); a no-op where the
    // checkout POST is made server-side.
    await page.route('**/api/v1/user/checkout', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    await page.click('[data-testid="confirm-checkout"]');

    // Button shows "Processing..." text during submission
    await expect(page.locator('[data-testid="confirm-checkout"]')).toContainText('Processing');
  });

  test('disables confirm button during submission', async ({ page }) => {
    await page.route('**/api/v1/user/checkout', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });

    await page.click('[data-testid="confirm-checkout"]');

    await expect(page.locator('[data-testid="confirm-checkout"]')).toBeDisabled();
  });
});

/**
 * The error case is provoked from REAL backend state, not a browser mock, so the
 * same spec holds when the checkout POST is made server-side (S152-07): a plan is
 * created and then deactivated through the admin API, so it still resolves by
 * slug but the backend rejects buying it. Teardown deletes the plan.
 */
test.describe('Checkout Submission — backend rejects an inactive plan', () => {
  let api: APIRequestContext;
  let adminToken: string;
  let inactivePlanId: string | undefined;
  const inactivePlanSlug = `s152-e2e-inactive-plan-${Date.now()}`;

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: BASE_URL });
    const loginResponse = await api.post('/api/v1/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const loginBody = await loginResponse.json();
    adminToken = loginBody.token ?? loginBody.access_token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    const createResponse = await api.post('/api/v1/admin/tarif-plans/', {
      headers: adminHeaders,
      data: {
        name: 'S152 E2E Inactive Plan',
        slug: inactivePlanSlug,
        price: 9.99,
        billing_period: 'monthly',
        is_active: true,
      },
    });
    if (!createResponse.ok()) {
      throw new Error(`plan create failed: ${createResponse.status()} ${await createResponse.text()}`);
    }
    inactivePlanId = (await createResponse.json()).plan.id;

    const deactivateResponse = await api.post(
      `/api/v1/admin/tarif-plans/${inactivePlanId}/deactivate`,
      { headers: adminHeaders },
    );
    if (!deactivateResponse.ok()) {
      throw new Error(`plan deactivate failed: ${deactivateResponse.status()} ${await deactivateResponse.text()}`);
    }
  });

  test.afterAll(async () => {
    if (inactivePlanId) {
      await api.delete(`/api/v1/admin/tarif-plans/${inactivePlanId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }
    await api.dispose();
  });

  test('handles API error gracefully', async ({ page }) => {
    await loginAsTestUser(page);
    await navigateToCheckout(page, inactivePlanSlug);
    await fillCheckoutRequirements(page);

    await page.click('[data-testid="confirm-checkout"]');

    await expect(page.locator('[data-testid="checkout-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="checkout-error"]')).toContainText(INACTIVE_PLAN_ERROR);
  });
});
