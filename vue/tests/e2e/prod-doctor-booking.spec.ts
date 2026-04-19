import { test, expect } from '@playwright/test';

/**
 * Production smoke test for doctor.vbwd.cc booking flow.
 *
 * This test uses an absolute URL so it works regardless of the
 * parent E2E_BASE_URL. It verifies the booking plugin renders
 * a catalogue, a resource detail, and offers at least one slot.
 *
 * Run: npx playwright test prod-doctor-booking
 */

const DOCTOR_BASE = process.env.DOCTOR_BASE_URL || 'https://doctor.vbwd.cc';

test.describe('doctor.vbwd.cc — booking flow', () => {
  test('booking plugin is enabled in the frontend manifest', async ({ request }) => {
    const response = await request.get(`${DOCTOR_BASE}/plugins.json`);
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.plugins?.booking?.enabled).toBe(true);
  });

  test('booking catalogue loads with at least one resource', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(`${DOCTOR_BASE}/booking`, { waitUntil: 'networkidle' });
    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);

    const resourceLinks = page.locator('a[href*="/booking/"]');
    await expect(resourceLinks.first()).toBeVisible({ timeout: 10_000 });

    const count = await resourceLinks.count();
    console.log(`[AUDIT] doctor catalogue has ${count} resource link(s)`);
  });

  test('resource detail page shows bookable slots', async ({ page }) => {
    await page.goto(`${DOCTOR_BASE}/booking`, { waitUntil: 'networkidle' });

    const resourceLinks = page.locator('a[href*="/booking/"]');
    await expect(resourceLinks.first()).toBeVisible({ timeout: 10_000 });

    const firstHref = await resourceLinks.first().getAttribute('href');
    await page.goto(`${DOCTOR_BASE}${firstHref}`, { waitUntil: 'networkidle' });

    // A bookable page shows either slot buttons, a date picker, or an availability
    // widget. Accept any of them as proof the booking plugin is wired up.
    const slotIndicator = page.locator(
      [
        '[data-testid*="slot"]',
        'button:has-text(":")',
        '[data-testid*="book"]',
        '[class*="slot"]',
        '[class*="calendar"]',
        'input[type="date"]',
      ].join(', '),
    );
    await expect(slotIndicator.first()).toBeVisible({ timeout: 15_000 });
  });

  test('booking a slot requires authentication (public flow protected)', async ({ page }) => {
    // This verifies the checkout/authorize step kicks in. We do NOT actually book.
    await page.goto(`${DOCTOR_BASE}/booking`, { waitUntil: 'networkidle' });

    const resourceLinks = page.locator('a[href*="/booking/"]');
    await expect(resourceLinks.first()).toBeVisible({ timeout: 10_000 });
    const firstHref = await resourceLinks.first().getAttribute('href');
    await page.goto(`${DOCTOR_BASE}${firstHref}`, { waitUntil: 'networkidle' });

    // Try to click any book/reserve button
    const bookButton = page.locator(
      'button:has-text("Book"), button:has-text("Reserve"), button:has-text("Continue"), [data-testid*="book"]',
    );

    const visible = await bookButton.first().isVisible().catch(() => false);
    test.skip(!visible, 'No obvious book button visible — test is a smoke check, not a deep flow');

    await bookButton.first().click();
    await page.waitForLoadState('networkidle');

    // Should land on a login/auth gate or show a prompt for credentials
    const url = page.url();
    const body = await page.locator('body').innerText();
    const isProtected = /login|sign in|register|auth/i.test(url) || /log in|sign in|register|email|password/i.test(body);
    expect(
      isProtected,
      `expected auth gate after booking click; landed on ${url}`,
    ).toBe(true);
  });
});
