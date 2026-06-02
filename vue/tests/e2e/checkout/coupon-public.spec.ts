import { test, expect, type Page } from '@playwright/test';

/**
 * §5.1 — the public (anonymous) checkout shows a working coupon input that
 * reduces the displayed total. The public checkout drives the agnostic CORE
 * checkout store (not the subscription plugin store directly).
 */
const PUBLIC_CHECKOUT_URL = '/checkout?tarif_plan_id=pro';

async function moneyOf(page: Page, testid: string): Promise<number> {
  const text = (await page.locator(`[data-testid="${testid}"]`).first().textContent()) || '';
  const match = text.replace(/,/g, '').match(/[\d.]+/);
  return match ? Number(match[0]) : NaN;
}

test.describe('Coupon — public (anonymous) checkout', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('coupon input is visible and SUMMER2026 reduces the total ~20%', async ({ page }) => {
    await page.goto(PUBLIC_CHECKOUT_URL);
    await expect(page.locator('[data-testid="order-summary"]')).toBeVisible({ timeout: 10000 });

    // §2b regression guard: the coupon input exists in the public checkout.
    await expect(page.locator('[data-testid="coupon-input"]')).toBeVisible();

    const before = await moneyOf(page, 'order-total');
    expect(before).toBeGreaterThan(0);

    await page.fill('[data-testid="coupon-input"]', 'SUMMER2026');
    await page.click('[data-testid="coupon-apply"]');

    await expect(page.locator('[data-testid="order-discount"]')).toBeVisible({ timeout: 10000 });
    const after = await moneyOf(page, 'order-total');
    expect(after).toBeCloseTo(before * 0.8, 1);
  });

  test('a bogus code shows an error; clearing returns to the original total', async ({ page }) => {
    await page.goto(PUBLIC_CHECKOUT_URL);
    await expect(page.locator('[data-testid="coupon-input"]')).toBeVisible({ timeout: 10000 });
    const before = await moneyOf(page, 'order-total');

    await page.fill('[data-testid="coupon-input"]', 'NOTACODE123');
    await page.click('[data-testid="coupon-apply"]');
    await expect(page.locator('[data-testid="coupon-error"]')).toBeVisible({ timeout: 10000 });
    expect(await moneyOf(page, 'order-total')).toBeCloseTo(before, 2);
  });
});
