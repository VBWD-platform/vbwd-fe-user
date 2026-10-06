/**
 * S152-11 spec 4 — one purchase across both renderers. In theme mode `/login`,
 * the shop, the cart and checkout are themed and `/dashboard` is the SPA; the
 * session (localStorage keys, D2) must survive every hand-off. In vue mode the
 * same flow runs on the SPA alone. Pays by invoice so it needs no Stripe keys;
 * the themed `/pay/stripe` leg is covered by booking-checkout.spec.ts (@stripe).
 */
import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { FRONTEND_MODE, expectRenderedBy, loginAdmin, loginTestUserInBrowser } from './frontend-mode-support';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
/** A demo-data product (shop populate_db), as in shop-shopping-flow.spec.ts. */
const PRODUCT_SLUG = 'usb-c-cable-2m';
const CONFIRMATION_URL = /\/checkout\/confirmation\?invoice_id=([0-9a-f-]+)/;

test.describe(`Hybrid hand-off: login → shop → checkout → dashboard (${FRONTEND_MODE})`, () => {
  let api: APIRequestContext;
  let adminToken: string;
  const createdInvoiceIds: string[] = [];

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: BASE_URL });
    adminToken = await loginAdmin(api);
  });

  test.afterAll(async () => {
    for (const invoiceId of createdInvoiceIds) {
      await api.delete(`/api/v1/admin/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }
    await api.dispose();
  });

  test('the session survives every renderer hand-off', async ({ page }) => {
    await page.goto('/login');
    await expectRenderedBy(page, FRONTEND_MODE);
    await loginTestUserInBrowser(page);
    await expectRenderedBy(page, 'vue');

    await page.goto(`/shop/product/${PRODUCT_SLUG}`);
    await expectRenderedBy(page, FRONTEND_MODE);
    await page.locator('[data-testid="product-detail-add-to-cart"]').click();

    await page.goto('/shop/cart');
    await expectRenderedBy(page, FRONTEND_MODE);
    await expect(page.locator('[data-testid="cart-item"]').first()).toBeVisible();
    await page.locator('[data-testid="shopping-cart-checkout"]').click();

    await page.waitForURL(/\/checkout\?source=shop/);
    await expectRenderedBy(page, FRONTEND_MODE);
    await completeCheckoutWithInvoice(page);
    await page.locator('[data-testid="confirm-checkout"]').click();

    await page.waitForURL(CONFIRMATION_URL);
    createdInvoiceIds.push(CONFIRMATION_URL.exec(page.url())?.[1] as string);
    await expect(page.locator('[data-testid="confirmation-banner"]')).toBeVisible();

    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
    await expectRenderedBy(page, 'vue');
    await expect(page.locator('[data-testid="profile-summary"]')).toBeVisible();
  });
});

async function completeCheckoutWithInvoice(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForSelector('[data-testid="billing-street"]');
  // A signed-in buyer's address comes read-only from the profile; fill only when editable.
  if (await page.locator('[data-testid="billing-street"]').isEditable()) {
    await page.fill('[data-testid="billing-first-name"]', 'Test');
    await page.fill('[data-testid="billing-last-name"]', 'Buyer');
    await page.fill('[data-testid="billing-street"]', '123 Test Street');
    await page.fill('[data-testid="billing-city"]', 'Test City');
    await page.fill('[data-testid="billing-zip"]', '12345');
    await page.locator('[data-testid="billing-country"]').selectOption({ index: 1 });
  }
  await page.locator('[data-testid="payment-method-invoice"]').click();
  await page.locator('[data-testid="terms-checkbox"] input[type="checkbox"]').check();
  await page.waitForSelector('[data-testid="confirm-checkout"]:not([disabled])');
}
