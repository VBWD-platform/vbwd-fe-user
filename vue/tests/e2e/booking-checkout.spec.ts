/**
 * Booking Checkout E2E — full payment flow with Stripe test card.
 *
 * Scenarios:
 * 1. New user registers on checkout page and pays
 * 2. Already logged-in user books and pays
 * 3. Existing user logs in on checkout page and pays
 * 4. Logged-in user books and pays by Invoice (no Stripe) — the same
 *    resource → slot → form → pay → confirmation chain, run without keys.
 *
 * After payment the SPA lands on `/checkout/confirmation?invoice_id=…`
 * (Stripe: via `/pay/stripe/success`, which polls then redirects). The
 * booking card there is the BookingConfirmationDetails section the booking
 * plugin registers into the confirmation page — there is no
 * `/booking/success` redirect (S152 16b: the old assertions waited for one and
 * never ran).
 *
 * Prerequisites:
 * - Backend running with booking + stripe plugins enabled
 * - Stripe test mode configured
 * - Demo data populated (dr-smith resource exists)
 *
 * Tagged `@stripe`: scenarios 1–3 redirect to the real hosted Stripe
 * Checkout, so the suite is skipped unless Stripe test keys are configured
 * (STRIPE_TEST_SECRET_KEY set — the CI stack writes them into the stripe
 * plugin's sandbox config from secrets).
 *
 * Run:
 *   STRIPE_TEST_SECRET_KEY=sk_test_... npx playwright test vue/tests/e2e/booking-checkout.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';

const STRIPE_TEST_KEYS_PRESENT = Boolean(process.env.STRIPE_TEST_SECRET_KEY);
const STRIPE_SKIP_REASON =
  'STRIPE_TEST_SECRET_KEY is not set — the hosted Stripe Checkout redirect cannot happen without Stripe test keys';

const RESOURCE_SLUG = 'dr-smith';
const BOOKING_FORM_SLUG = 'booking-form';

const STRIPE_CARD = {
  number: '4111111111111111',
  expiry: '1130',
  cvc: '123',
  name: 'Marc Muster',
  city: 'Frankfurt',
  zip: '60386',
  street: 'Hugo Junkers 3',
};

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@vbwd-test.local`;
}

async function selectSlotAndBookNow(page: Page) {
  await page.goto(`/booking/${RESOURCE_SLUG}`);

  // Wait for the CMS page + widget to fully render (async widget loading)
  await page.waitForTimeout(3000);

  // Pick a future date (next Monday)
  const dateInput = page.locator('input[type="date"]').first();
  await dateInput.waitFor({ timeout: 15000 });

  const nextMonday = getNextWeekday(1);
  await dateInput.fill(nextMonday);
  await dateInput.dispatchEvent('change');

  // Wait for slots to load from API
  await page.waitForTimeout(2000);

  // Click first available slot
  const slot = page.locator('.booking-slot:not(.full)').first();
  await slot.waitFor({ timeout: 10000 });
  await slot.click();

  // Click Book Now
  const bookNowButton = page.locator('.ghrm-cta-btn');
  await expect(bookNowButton).toBeEnabled({ timeout: 5000 });
  await bookNowButton.click();

  // Should navigate to booking form
  await page.waitForURL(new RegExp(`/${BOOKING_FORM_SLUG}/${RESOURCE_SLUG}`), { timeout: 10000 });
}

async function fillBookingFormAndConfirm(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Fill ALL visible text/number inputs in the booking form (custom fields)
  const textInputs = page.locator('.booking-form__field input[type="text"]');
  const textCount = await textInputs.count();
  for (let i = 0; i < textCount; i++) {
    await textInputs.nth(i).fill('E2E test value');
  }

  const numberInputs = page.locator('.booking-form__field input[type="number"]');
  const numberCount = await numberInputs.count();
  for (let i = 0; i < numberCount; i++) {
    await numberInputs.nth(i).fill('2');
  }

  // Check any checkboxes
  const checkboxes = page.locator('.booking-form__checkbox input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  for (let i = 0; i < checkboxCount; i++) {
    await checkboxes.nth(i).check();
  }

  // Fill notes
  const notesField = page.locator('textarea');
  if (await notesField.isVisible().catch(() => false)) {
    await notesField.fill('E2E test booking');
  }

  // Click Confirm Booking
  await page.click('.ghrm-cta-btn');

  // Should navigate to checkout page
  await page.waitForURL(/\/book\/pay/, { timeout: 15000 });
}

const STRIPE_METHOD_LABEL = 'Pay with Stripe';
const INVOICE_METHOD_LABEL = 'Invoice';
const CONFIRMATION_URL = /\/checkout\/confirmation\?invoice_id=/;

async function fillCheckoutAndPay(page: Page, paymentMethodLabel: string = STRIPE_METHOD_LABEL) {
  await page.waitForLoadState('networkidle');

  // Wait for billing address block
  await page.waitForSelector('[data-testid="billing-address-block"]', { timeout: 10000 }).catch(() => {});
  await page.waitForSelector('[data-testid="billing-street"]', { timeout: 5000 }).catch(() => {});

  // Fill billing address — all required fields
  const firstNameField = page.locator('[data-testid="billing-first-name"]');
  if (await firstNameField.isVisible().catch(() => false)) {
    await firstNameField.fill(STRIPE_CARD.name.split(' ')[0]);
  }
  const lastNameField = page.locator('[data-testid="billing-last-name"]');
  if (await lastNameField.isVisible().catch(() => false)) {
    await lastNameField.fill(STRIPE_CARD.name.split(' ')[1] || 'Test');
  }
  const streetField = page.locator('[data-testid="billing-street"]');
  if (await streetField.isVisible().catch(() => false)) {
    await streetField.fill(STRIPE_CARD.street);
    await page.fill('[data-testid="billing-city"]', STRIPE_CARD.city);
    await page.fill('[data-testid="billing-zip"]', STRIPE_CARD.zip);
    const countrySelect = page.locator('[data-testid="billing-country"]');
    if (await countrySelect.isVisible().catch(() => false)) {
      await countrySelect.selectOption({ index: 1 });
    }
  }

  // Wait for payment methods
  await page.waitForSelector('[data-testid="payment-methods-block"]', { timeout: 10000 }).catch(() => {});
  await page.waitForSelector('[data-testid="payment-methods-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

  // Select the payment method (Stripe by default)
  const methodRadio = page.locator(`text=${paymentMethodLabel}`).first().locator('..');
  if (await methodRadio.isVisible().catch(() => false)) {
    await methodRadio.click();
  } else if (paymentMethodLabel === STRIPE_METHOD_LABEL) {
    // Fallback: click the Stripe radio button directly
    const stripeInput = page.locator('input[type="radio"]').filter({ hasText: /stripe/i });
    if (await stripeInput.count() > 0) {
      await stripeInput.click();
    }
  }

  // Accept terms
  const termsCheckbox = page.locator('[data-testid="terms-checkbox"] input[type="checkbox"]');
  if (await termsCheckbox.isVisible().catch(() => false)) {
    await termsCheckbox.check();
  }

  // Click Pay Now
  const payButton = page.locator('.pay-button');
  await expect(payButton).toBeEnabled({ timeout: 10000 });
  await payButton.click();
}

async function fillStripeCheckout(page: Page) {
  // Wait for Stripe redirect (external domain)
  const isStripeRedirect = await page
    .waitForURL(/checkout\.stripe\.com/, { timeout: 30000 })
    .then(() => true)
    .catch(() => false);

  if (!isStripeRedirect) {
    console.log('No Stripe redirect — current URL:', page.url());
    return;
  }

  console.log('Stripe Checkout page loaded');
  await page.waitForTimeout(3000);

  // Fill email if visible
  const emailField = page.locator('input[name="email"], #email').first();
  if (await emailField.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailField.fill('e2e-booking@vbwd.test');
  }

  // Select "Card" payment method
  // Stripe Checkout uses a complex UI — need to click on the Card text
  await page.getByText('Card', { exact: true }).first().click({ force: true });
  console.log('Clicked Card option');
  await page.waitForTimeout(3000);

  // Fill card number
  const cardNumberField = page.getByPlaceholder('1234 1234 1234 1234');
  await cardNumberField.waitFor({ timeout: 15000 });
  await cardNumberField.click();
  await page.keyboard.type(STRIPE_CARD.number, { delay: 30 });
  console.log('Typed card number');
  await page.waitForTimeout(500);

  // Click expiry field explicitly and type
  const expiryField = page.getByPlaceholder('MM / YY');
  await expiryField.click();
  await page.keyboard.type(STRIPE_CARD.expiry, { delay: 30 });
  console.log('Typed expiry');
  await page.waitForTimeout(500);

  // Click CVC field explicitly and type
  const cvcField = page.getByPlaceholder('CVC');
  await cvcField.click();
  await page.keyboard.type(STRIPE_CARD.cvc, { delay: 30 });
  console.log('Typed CVC');

  // Cardholder name
  const nameField = page.getByPlaceholder('Full name on card');
  if (await nameField.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nameField.fill(STRIPE_CARD.name);
    console.log('Filled cardholder name');
  }

  // Country — select Germany
  const countrySelect = page.getByRole('combobox', { name: 'Country or region' });
  if (await countrySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await countrySelect.selectOption('Germany');
    console.log('Selected country');
  }

  await page.waitForTimeout(1000);

  // Click the main Pay button (not "Pay with Link/Klarna/etc")
  const payButton = page.locator('button.SubmitButton, button[data-testid="hosted-payment-submit-button"]').first();
  if (await payButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await payButton.click();
  } else {
    // Fallback: the last Pay button in main content area
    await page.locator('main button:has-text("Pay")').last().click();
  }
  console.log('Clicked Stripe Pay button');

  // Wait for redirect back from Stripe (can take up to 90s in sandbox)
  await page.waitForURL(
    url => !url.toString().includes('checkout.stripe.com'),
    { timeout: 90000 }
  );
  console.log('Returned from Stripe:', page.url());
}

/**
 * The real post-payment page: the shared checkout confirmation with the
 * booking plugin's BookingConfirmationDetails section. Custom fields appear
 * once the booking exists (paid); a pending invoice shows the line metadata.
 */
async function expectBookingConfirmation(page: Page, options: { paid: boolean }) {
  await page.waitForURL(CONFIRMATION_URL, { timeout: 60000 });
  const confirmation = page.locator('[data-testid="checkout-confirmation"]');
  await expect(confirmation.locator('[data-testid="confirmation-banner"]')).toBeVisible({ timeout: 15000 });

  // Invoice details: BK- invoice number + status badge + amount
  await expect(confirmation.locator('.confirmation-mono')).toHaveText(/^BK-/);
  await expect(confirmation.locator('.status-badge').first()).toBeVisible();
  await expect(confirmation.getByText('50.00').first()).toBeVisible();

  // BookingConfirmationDetails section (resource + booking details)
  const bookingSection = confirmation.locator('.booking-price').locator('xpath=ancestor::div[contains(@class,"card")][1]');
  await expect(bookingSection.locator('.resource-name-link')).toContainText('Dr. Smith', { timeout: 15000 });
  // Operating currency, never "undefined" (S85.1 dropped resource.currency)
  await expect(bookingSection.locator('.booking-price')).toHaveText(/^50 EUR\//);
  await expect(bookingSection.getByText(/Date & time/i)).toBeVisible();
  await expect(bookingSection.getByText('E2E test booking')).toBeVisible();
  if (options.paid) {
    // Custom fields from the form (filled by fillBookingFormAndConfirm)
    await expect(bookingSection.getByText('Symptoms')).toBeVisible();
  }
}

function getNextWeekday(targetDay: number): string {
  const now = new Date();
  const daysUntilTarget = (targetDay - now.getDay() + 7) % 7 || 7;
  const target = new Date(now);
  target.setDate(now.getDate() + daysUntilTarget);
  return target.toISOString().split('T')[0];
}

// ── Console log capture ──────────────────────────────────────────────────────

function captureConsoleLogs(page: Page) {
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[browser ${type}] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    console.log(`[browser error] ${error.message}`);
  });
}

// ── Scenario 1: New user registers and books ────────────────────────────────

test.describe('Booking Checkout — New User Registration', { tag: '@stripe' }, () => {
  test.skip(!STRIPE_TEST_KEYS_PRESENT, STRIPE_SKIP_REASON);

  test('new user registers on checkout, fills Stripe, and completes booking', async ({ page }) => {
    captureConsoleLogs(page);
    const email = uniqueEmail('booking-new');

    // 1. Browse resource → select slot → Book Now
    await selectSlotAndBookNow(page);

    // 2. Fill booking form → Confirm Booking → navigate to checkout
    await fillBookingFormAndConfirm(page);

    // 3. On checkout: enter email for registration
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ timeout: 10000 });
    await emailInput.fill(email);

    // Trigger email check (blur or button)
    const checkButton = page.locator('[data-testid="email-check-btn"]');
    if (await checkButton.isVisible().catch(() => false)) {
      await checkButton.click();
    } else {
      await emailInput.press('Tab');
    }
    await page.waitForTimeout(1500);

    // Fill both password fields for new user registration
    const createPassword = page.locator('input[type="password"]').first();
    await createPassword.waitFor({ timeout: 5000 });
    await createPassword.fill('TestBooking123@');

    const confirmPassword = page.locator('input[type="password"]').nth(1);
    if (await confirmPassword.isVisible().catch(() => false)) {
      await confirmPassword.fill('TestBooking123@');
    }

    // Wait for button to enable after password validation
    await page.waitForTimeout(500);

    // Click Sign Up
    const signUpButton = page.locator('button:has-text("Sign Up")').first();
    await expect(signUpButton).toBeEnabled({ timeout: 5000 });
    await signUpButton.click();

    // Wait for authentication
    await page.waitForTimeout(2000);

    // 4. Fill checkout requirements and pay
    await fillCheckoutAndPay(page);

    // 5. Fill Stripe hosted checkout
    await fillStripeCheckout(page);

    // 6. Verify success
    // Verify we landed on the success page
    expect(page.url()).toContain('/pay/stripe/success');
  });
});

// ── Scenario 2: Logged-in user books ─────────────────────────────────────────

test.describe('Booking Checkout — Logged-in User', { tag: '@stripe' }, () => {
  test.skip(!STRIPE_TEST_KEYS_PRESENT, STRIPE_SKIP_REASON);

  test('logged-in user selects slot, fills form, pays via Stripe, sees the confirmation with booking details', async ({ page }) => {
    captureConsoleLogs(page);
    // 1. Login first
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="email"]').fill('test@example.com');
    await page.locator('[data-testid="password"]').fill('TestPass123@');
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // 2. Browse resource → select slot → Book Now
    await selectSlotAndBookNow(page);

    // 3. Fill booking form → Confirm Booking
    await fillBookingFormAndConfirm(page);

    // 4. On checkout: EmailBlock should show user as already authenticated
    await page.waitForLoadState('networkidle');

    // 5. Fill checkout requirements and pay
    await fillCheckoutAndPay(page);

    // 6. Fill Stripe hosted checkout
    await fillStripeCheckout(page);

    // 7. Stripe returns to /pay/stripe/success, which polls the session then
    //    redirects to /checkout/confirmation with the booking section.
    await expectBookingConfirmation(page, { paid: true });
  });
});

// ── Scenario 3: Existing user logs in on checkout ────────────────────────────

test.describe('Booking Checkout — Existing User Login on Checkout', { tag: '@stripe' }, () => {
  test.skip(!STRIPE_TEST_KEYS_PRESENT, STRIPE_SKIP_REASON);

  test('existing user logs in on checkout page and pays via Stripe', async ({ page }) => {
    captureConsoleLogs(page);
    // 1. Browse resource → select slot → Book Now (not logged in)
    await selectSlotAndBookNow(page);

    // 2. Fill booking form → Confirm Booking
    await fillBookingFormAndConfirm(page);

    // 3. On checkout: enter existing user email
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ timeout: 10000 });
    await emailInput.fill('test@example.com');

    // Trigger email check
    const checkButton = page.locator('[data-testid="email-check-btn"]');
    if (await checkButton.isVisible().catch(() => false)) {
      await checkButton.click();
    } else {
      await emailInput.press('Tab');
    }
    await page.waitForTimeout(1500);

    // Enter password for existing user login
    const passwordField = page.locator('input[type="password"]').first();
    await passwordField.waitFor({ timeout: 5000 });
    await passwordField.fill('TestPass123@');

    // Click Login
    const loginButton = page.locator('button:has-text("Log In"), button:has-text("Login"), button:has-text("Sign In")').first();
    await expect(loginButton).toBeEnabled({ timeout: 5000 });
    await loginButton.click();

    // Wait for authentication
    await page.waitForTimeout(2000);

    // 4. Fill checkout requirements and pay
    await fillCheckoutAndPay(page);

    // 5. Fill Stripe hosted checkout
    await fillStripeCheckout(page);

    // 6. Verify success
    // Verify we landed on the success page
    expect(page.url()).toContain('/pay/stripe/success');
  });
});

// ── Scenario 4: Logged-in user pays by Invoice (no Stripe keys needed) ──────

test.describe('Booking Checkout — Logged-in User, Invoice payment', () => {
  test('logged-in user books, pays by invoice, sees the confirmation with booking details', async ({ page }) => {
    captureConsoleLogs(page);
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="email"]').fill('test@example.com');
    await page.locator('[data-testid="password"]').fill('TestPass123@');
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    await selectSlotAndBookNow(page);
    await fillBookingFormAndConfirm(page);
    await fillCheckoutAndPay(page, INVOICE_METHOD_LABEL);

    await expectBookingConfirmation(page, { paid: false });
  });
});
