import { test, expect, type Page } from '@playwright/test';

const API = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';
// The booking form is a CMS page whose slug is the plugin's `bookingFormSlug` config.
const BOOKING_FORM_SLUG = 'booking-form';
const MONDAY = 1;

/** The next given weekday (0 = Sunday) strictly after today, as YYYY-MM-DD. */
function nextWeekday(targetDay: number): string {
  const now = new Date();
  const daysUntilTarget = (targetDay - now.getDay() + 7) % 7 || 7;
  const target = new Date(now);
  target.setDate(now.getDate() + daysUntilTarget);
  return target.toISOString().split('T')[0];
}

async function loginAsUser(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'TestPass123@');
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL('/dashboard');
}

async function getAdminToken(): Promise<string> {
  const resp = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'AdminPass123@',
    }),
  });
  const data = await resp.json();
  return data.access_token || data.token;
}

async function ensureTestResource(adminToken: string): Promise<string> {
  const slug = 'e2e-playwright-resource';

  // Check if resource exists
  const checkResp = await fetch(`${API}/booking/resources/${slug}`);
  if (checkResp.ok) return slug;

  // Create resource
  await fetch(`${API}/admin/booking/resources`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: 'E2E Playwright Resource',
      slug,
      capacity: 5,
      price: '50.00',
      currency: 'EUR',
      slot_duration_minutes: 30,
      is_active: true,
      availability: {
        schedule: {
          mon: [{ start: '09:00', end: '17:00' }],
          tue: [{ start: '09:00', end: '17:00' }],
          wed: [{ start: '09:00', end: '17:00' }],
          thu: [{ start: '09:00', end: '17:00' }],
          fri: [{ start: '09:00', end: '17:00' }],
          sat: [],
          sun: [],
        },
      },
    }),
  });

  return slug;
}

test.describe('Booking — Public Pages', () => {
  let resourceSlug: string;

  test.beforeAll(async () => {
    const token = await getAdminToken();
    resourceSlug = await ensureTestResource(token);
  });

  test('catalogue page loads and shows resources', async ({ page }) => {
    await page.goto('/booking');
    await page.waitForLoadState('networkidle');

    // Should show at least one resource link
    const resourceLinks = page.locator('a[href*="/booking/"]');
    await expect(resourceLinks.first()).toBeVisible({ timeout: 10000 });
  });

  test('resource detail page loads', async ({ page }) => {
    await page.goto(`/booking/${resourceSlug}`);
    await page.waitForLoadState('networkidle');

    // Should display resource name
    await expect(
      page.getByText('E2E Playwright Resource')
    ).toBeVisible({ timeout: 10000 });
  });

  test('resource detail shows price and availability section', async ({ page }) => {
    await page.goto(`/booking/${resourceSlug}`);
    await page.waitForLoadState('networkidle');

    // Price visible (formatted with the currency symbol, e.g. "€50.00")
    await expect(page.locator('[data-testid="price-amount"]').first()).toContainText('50.00', { timeout: 10000 });
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });

  test('booking form page loads for resource', async ({ page }) => {
    await page.goto(`/${BOOKING_FORM_SLUG}/${resourceSlug}`);
    await page.waitForLoadState('networkidle');

    // Should show booking form or resource name
    await expect(
      page.getByText('E2E Playwright Resource')
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Booking — Checkout Page', () => {
  let resourceSlug: string;

  test.beforeAll(async () => {
    const token = await getAdminToken();
    resourceSlug = await ensureTestResource(token);
  });

  test('checkout page loads with title', async ({ page }) => {
    // Navigate to checkout with query params (simulating form submission)
    await page.goto(`/booking/${resourceSlug}/book/pay`);
    await page.waitForLoadState('networkidle');

    // Checkout title should be visible
    await expect(
      page.locator('[data-testid="checkout-title"]')
    ).toBeVisible({ timeout: 10000 });
  });

  test('checkout page shows login prompt when not authenticated', async ({ page }) => {
    // The pay page needs a pending booking, created by the slot → form flow.
    await page.goto(`/booking/${resourceSlug}`);
    const dateInput = page.locator('input[type="date"]').first();
    await dateInput.waitFor({ timeout: 15000 });
    await dateInput.fill(nextWeekday(MONDAY));
    await dateInput.dispatchEvent('change');
    await page.locator('.booking-slot:not(.full)').first().click();
    await page.locator('.ghrm-cta-btn').click();
    await page.waitForURL(new RegExp(`/${BOOKING_FORM_SLUG}/${resourceSlug}`));
    await page.waitForLoadState('networkidle');
    await page.locator('.ghrm-cta-btn').click();
    await page.waitForURL(/\/book\/pay/);

    // Should show email/login block
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Booking — My Bookings (Authenticated)', () => {
  test('my bookings page loads after login', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/dashboard/bookings');
    await page.waitForLoadState('networkidle');

    // Should show bookings page (either table or "no bookings" message)
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('my bookings page requires authentication', async ({ page }) => {
    await page.goto('/dashboard/bookings');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/, { timeout: 10000 });
  });
});

test.describe('Booking — API Integration', () => {
  let resourceSlug: string;
  let userToken: string;

  test.beforeAll(async () => {
    const adminToken = await getAdminToken();
    resourceSlug = await ensureTestResource(adminToken);

    // Get user token
    const resp = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPass123@',
      }),
    });
    const data = await resp.json();
    userToken = data.access_token || data.token;
  });

  test('checkout API creates invoice', async () => {
    const resp = await fetch(`${API}/booking/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        resource_slug: resourceSlug,
        start_at: '2026-05-04T10:00:00',
        end_at: '2026-05-04T10:30:00',
      }),
    });

    expect(resp.status).toBe(201);
    const data = await resp.json();
    expect(data.invoice_id).toBeTruthy();
    expect(data.invoice_number).toMatch(/^BK-/);
  });

  test('checkout API rejects missing fields', async () => {
    const resp = await fetch(`${API}/booking/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ resource_slug: resourceSlug }),
    });

    expect(resp.status).toBe(400);
  });

  test('checkout API rejects nonexistent resource', async () => {
    const resp = await fetch(`${API}/booking/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        resource_slug: 'does-not-exist',
        start_at: '2026-05-04T10:00:00',
        end_at: '2026-05-04T10:30:00',
      }),
    });

    expect(resp.status).toBe(404);
  });

  test('public resources API returns list', async () => {
    const resp = await fetch(`${API}/booking/resources`);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    // Catalogue list wire contract: {items, total, page, per_page, pages}
    expect(data.items).toBeDefined();
    expect(data.items.length).toBeGreaterThan(0);
  });

  test('public availability API returns slots', async () => {
    const resp = await fetch(
      `${API}/booking/resources/${resourceSlug}/availability?date=${nextWeekday(MONDAY)}`
    );
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.slots).toBeDefined();
    expect(data.slots.length).toBeGreaterThan(0);
  });

  test('user bookings API requires auth', async () => {
    const resp = await fetch(`${API}/booking/bookings`);
    expect(resp.status).toBe(401);
  });

  test('user bookings API returns list', async () => {
    const resp = await fetch(`${API}/booking/bookings`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.bookings).toBeDefined();
  });
});
