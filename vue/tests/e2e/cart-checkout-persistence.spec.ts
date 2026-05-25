import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './fixtures/checkout.fixtures';

// Regression: checkout selections (token bundles + add-ons) must persist via
// the shared cart store, so they survive navigation AND logout/login and stay
// in sync with the cart icon/popup.
//   plans -> select plan -> checkout -> add addons + bundles
//   -> cart icon shows count + popup shows items
//   -> navigate to invoices -> back -> selections still present
//   -> logout + login -> selections still present
test.describe('Cart / checkout persistence', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.evaluate(() => localStorage.removeItem('vbwd_cart'));
  });

  test('checkout selections persist across navigation', async ({ page }) => {
    // 1. plans list -> select first plan
    await page.goto('/dashboard/plans');
    await page.locator('[data-testid^="select-plan-"]').first().click();
    await page.waitForURL(/\/dashboard\/checkout\//);
    await expect(page.locator('[data-testid="token-bundles-section"], [data-testid="addons-section"]').first()).toBeVisible();

    // 2. add up to 2 token bundles + 3 add-ons
    const bundleCards = page.locator('[data-testid="token-bundles-section"] .option-card');
    const addonCards = page.locator('[data-testid="addons-section"] .addon-card');
    const nBundles = Math.min(2, await bundleCards.count());
    const nAddons = Math.min(3, await addonCards.count());
    for (let i = 0; i < nBundles; i++) await bundleCards.nth(i).click();
    for (let i = 0; i < nAddons; i++) await addonCards.nth(i).click();
    const expectedExtras = nBundles + nAddons;
    // The selected plan is also added to the cart, so the cart holds plan + extras.
    const expectedCart = expectedExtras + 1;

    // order summary line items (plan + extras)
    const lineItems = page.locator('[data-testid^="line-item-"]');
    await expect(lineItems).toHaveCount(expectedCart);

    // 3. cart icon badge shows the full count (plan + extras)
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText(String(expectedCart));

    // cart popup lists every line item, including the plan
    await page.click('[data-testid="cart-icon"]');
    await expect(page.locator('[data-testid="cart-dropdown"]')).toBeVisible();
    await expect(page.locator('[data-testid^="cart-item-"]')).toHaveCount(expectedCart);
    await page.click('[data-testid="cart-icon"]'); // close

    const checkoutUrl = page.url();

    // 4. navigate away (invoices) then back
    await page.goto('/dashboard/subscription/invoices');
    await page.waitForLoadState('networkidle');
    await page.goto(checkoutUrl);
    await page.waitForURL(/\/dashboard\/checkout\//);

    // selections survived: order summary + cart badge unchanged
    await expect(page.locator('[data-testid^="line-item-"]')).toHaveCount(expectedCart);
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText(String(expectedCart));

    // 5. survives logout/login (cart is persisted, not auth-scoped).
    // Simulate logout exactly as UserLayout.logout() does (auth keys only),
    // then log back in and confirm the cart is untouched.
    const cartBefore = await page.evaluate(() => localStorage.getItem('vbwd_cart'));
    await page.evaluate(() => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('user_id');
      localStorage.removeItem('user_permissions');
    });
    await loginAsTestUser(page);
    const cartAfter = await page.evaluate(() => localStorage.getItem('vbwd_cart'));
    expect(cartAfter).toBe(cartBefore);
    await page.goto(checkoutUrl);
    await page.waitForURL(/\/dashboard\/checkout\//);
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText(String(expectedCart));
  });
});
