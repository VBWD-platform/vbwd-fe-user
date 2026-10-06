import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'AdminPass123@';

async function readActiveSubscriptionId(page: Page): Promise<string> {
  const authToken = await page.evaluate(() => localStorage.getItem('auth_token'));
  const response = await page.request.get('/api/v1/user/subscriptions/active', {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const body = await response.json();
  return body.subscription.id;
}

/** Undo the cancellation through the admin API so the shared test user keeps an active plan. */
async function reactivateSubscription(request: APIRequestContext, subscriptionId: string): Promise<void> {
  const loginResponse = await request.post('/api/v1/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const loginBody = await loginResponse.json();
  const response = await request.post(`/api/v1/admin/subscriptions/${subscriptionId}/activate`, {
    headers: { Authorization: `Bearer ${loginBody.token ?? loginBody.access_token}` },
  });
  if (!response.ok()) {
    throw new Error(`could not re-activate subscription ${subscriptionId}: ${response.status()}`);
  }
}

test.describe('Subscription Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'TestPass123@');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('displays current subscription', async ({ page }) => {
    await page.goto('/dashboard/subscription');

    await expect(page.locator('[data-testid="plan-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-status"]')).toBeVisible();
  });

  test('can cancel subscription with confirmation', async ({ page }) => {
    const activeSubscriptionId = await readActiveSubscriptionId(page);
    try {
      await page.goto('/dashboard/subscription');
      await page.click('[data-testid="cancel-subscription"]');

      // Confirmation modal appears
      await expect(page.locator('[data-testid="cancel-modal"]')).toBeVisible();
      await page.click('[data-testid="confirm-cancel"]');

      await expect(page.locator('[data-testid="cancellation-notice"]')).toBeVisible();
    } finally {
      await reactivateSubscription(page.request, activeSubscriptionId);
    }
  });
});
