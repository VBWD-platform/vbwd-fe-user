import { test, expect, type Page, request as pwRequest } from '@playwright/test';
import { loginAsTestUser } from '../fixtures/checkout.fixtures';

/**
 * §5.3 cross-app proof (API-in-beforeAll variant, per the locked decision): an
 * admin-created discount + coupon reaches the buyer's checkout and reduces the
 * price. The admin injection is done through the authenticated admin API (more
 * CI-robust than UI sequencing); redemption is via the user checkout UI.
 */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const CODE = 'E2ETEST25';
const CHECKOUT_URL = '/dashboard/checkout/pro';

async function moneyOf(page: Page, testid: string): Promise<number> {
  const text = (await page.locator(`[data-testid="${testid}"]`).first().textContent()) || '';
  const match = text.replace(/,/g, '').match(/[\d.]+/);
  return match ? Number(match[0]) : NaN;
}

test.describe('Coupon — admin-injected discount reaches the buyer', () => {
  test.beforeAll(async () => {
    const ctx = await pwRequest.newContext({ baseURL: BASE });
    const login = await ctx.post('/api/v1/auth/login', {
      data: { email: 'admin@example.com', password: 'AdminPass123@' },
    });
    const token = (await login.json()).token as string;
    const headers = { Authorization: `Bearer ${token}` };

    // Create the discount (idempotent across runs: a duplicate slug just errors,
    // and we fall back to looking it up).
    let discountId: string | undefined;
    const created = await ctx.post('/api/v1/admin/discounts', {
      headers,
      data: {
        name: 'E2E Test 25',
        slug: 'e2e-test-25',
        discount_type: 'PERCENTAGE',
        value: 25,
        scope: 'GLOBAL',
        is_active: true,
      },
    });
    if (created.ok()) {
      const body = await created.json();
      discountId = body.discount?.id ?? body.id;
    } else {
      const list = await (await ctx.get('/api/v1/admin/discounts', { headers })).json();
      discountId = (list.discounts || []).find((d: { slug: string; id: string }) => d.slug === 'e2e-test-25')?.id;
    }
    expect(discountId, 'admin discount injection failed').toBeTruthy();

    // Create the coupon bound to it (ignore a duplicate-code error on re-runs).
    await ctx.post('/api/v1/admin/coupons', {
      headers,
      data: { code: CODE, discount_id: discountId },
    });
    await ctx.dispose();
  });

  test('redeeming the admin-created code drops the total ~25%', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto(CHECKOUT_URL);
    await expect(page.locator('[data-testid="order-summary"]')).toBeVisible();

    const before = await moneyOf(page, 'order-total');
    expect(before).toBeGreaterThan(0);

    await page.fill('[data-testid="coupon-input"]', CODE);
    await page.click('[data-testid="coupon-apply"]');

    await expect(page.locator('[data-testid="order-discount"]')).toBeVisible({ timeout: 10000 });
    const after = await moneyOf(page, 'order-total');
    expect(after).toBeCloseTo(before * 0.75, 1);
  });
});
