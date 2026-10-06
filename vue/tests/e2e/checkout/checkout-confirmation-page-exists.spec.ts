/**
 * Regression: /checkout/confirmation must resolve to the seeded CMS page
 * (CmsPage.vue with slug "checkout-confirmation"), not the CMS 404 view.
 *
 * The route is registered by the fe-user `checkout` plugin and loads
 * CmsPage.vue with slug "checkout-confirmation". On instances where the
 * CMS has no page for that slug (e.g. hotel.vbwd.cc before the fix),
 * CmsPage.vue rendered its built-in 404. The shared
 * `populate_checkout_cms()` seeder now creates the page on every
 * billing-completing vertical (shop, booking, …).
 */
import { test, expect } from '@playwright/test';

test.describe('Checkout confirmation page (CMS slug seeded)', () => {
  test('renders the confirmation view, not the CMS 404', async ({ page }) => {
    await page.goto('/checkout/confirmation?invoice_id=00000000-0000-0000-0000-000000000000');

    await expect(page.locator('[data-testid="checkout-confirmation"]')).toBeVisible({ timeout: 15000 });

    await expect(page.locator('.cms-page__not-found')).toHaveCount(0);
    await expect(page.locator('.cms-page__not-found-code')).toHaveCount(0);

    await expect(page.locator('[data-testid="confirmation-banner"]')).toBeVisible();
  });

  test('CMS API exposes the checkout-confirmation page', async ({ request }) => {
    const apiBase = (process.env.E2E_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
    // Pages are `cms_post` rows of type `page` since the legacy cms_page
    // endpoint was retired (S105).
    const response = await request.get(`${apiBase}/api/v1/cms/posts/checkout-confirmation`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.slug).toBe('checkout-confirmation');
    expect(body.type).toBe('page');
    expect(body.status).toBe('published');
    expect(body.layout_id).toBeTruthy();
  });
});
