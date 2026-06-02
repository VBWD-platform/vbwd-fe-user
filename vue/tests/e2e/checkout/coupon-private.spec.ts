import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser } from '../fixtures/checkout.fixtures';

// The real private subscription checkout route (the navigateToCheckout helper's
// `/checkout/pro` is stale — the route is /dashboard/checkout/:planSlug).
const CHECKOUT_URL = '/dashboard/checkout/pro';

/** Extract the first numeric (money) value from a testid's text. */
async function moneyOf(page: Page, testid: string): Promise<number> {
  const text = (await page.locator(`[data-testid="${testid}"]`).first().textContent()) || '';
  const match = text.replace(/,/g, '').match(/[\d.]+/);
  return match ? Number(match[0]) : NaN;
}

test.describe('Coupon — private subscription checkout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('coupon input is visible and SUB30 reduces the total ~30%', async ({ page }) => {
    await page.goto(CHECKOUT_URL);
    await expect(page.locator('[data-testid="order-summary"]')).toBeVisible();

    // §2b regression guard: the coupon input exists in the private checkout.
    await expect(page.locator('[data-testid="coupon-input"]')).toBeVisible();

    const before = await moneyOf(page, 'order-total');
    expect(before).toBeGreaterThan(0);

    await page.fill('[data-testid="coupon-input"]', 'SUB30');
    await page.click('[data-testid="coupon-apply"]');

    // The discount row appears and the total drops by ~30%.
    await expect(page.locator('[data-testid="order-discount"]')).toBeVisible({ timeout: 10000 });
    const after = await moneyOf(page, 'order-total');
    expect(after).toBeLessThan(before);
    expect(after).toBeCloseTo(before * 0.7, 1);
  });

  test('a bogus code shows an error and leaves the total unchanged', async ({ page }) => {
    await page.goto(CHECKOUT_URL);
    const before = await moneyOf(page, 'order-total');

    await page.fill('[data-testid="coupon-input"]', 'NOTACODE123');
    await page.click('[data-testid="coupon-apply"]');

    await expect(page.locator('[data-testid="coupon-error"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="order-discount"]')).toHaveCount(0);
    expect(await moneyOf(page, 'order-total')).toBeCloseTo(before, 2);
  });
});
