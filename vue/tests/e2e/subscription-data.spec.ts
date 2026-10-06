/**
 * E2E Tests: Subscription & Invoice Data Visibility
 *
 * These tests verify that a user with an active subscription (test@example.com)
 * can see their subscription details and invoices correctly, and that the data
 * refreshes properly on page reload.
 */
import { test, expect, Page } from '@playwright/test';

// Test credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPass123@',
};

/**
 * Helper: Login as test user
 */
async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', TEST_USER.email);
  await page.fill('[data-testid="password"]', TEST_USER.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

/**
 * Helper: Wait for loading to complete
 */
async function waitForLoading(page: Page, testId: string): Promise<void> {
  // Wait for loading indicator to disappear (if present)
  const loadingSelector = `[data-testid="${testId}-loading"]`;
  try {
    await page.waitForSelector(loadingSelector, { state: 'hidden', timeout: 10000 });
  } catch {
    // Loading may have already finished
  }
}

test.describe('Subscription Data Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test.describe('Dashboard - Recent Invoices', () => {
    test('displays recent invoices on dashboard', async ({ page }) => {
      await page.goto('/dashboard');
      await waitForLoading(page, 'dashboard');

      // Verify recent invoices section is visible
      const invoicesCard = page.locator('[data-testid="recent-invoices"]');
      await expect(invoicesCard).toBeVisible();

      // Check if there are invoice items (user should have invoices)
      const invoiceItems = page.locator('[data-testid="invoice-item"]');
      const invoiceCount = await invoiceItems.count();

      // User should have at least one invoice
      expect(invoiceCount).toBeGreaterThan(0);

      // Verify invoice item has required data
      if (invoiceCount > 0) {
        const firstInvoice = invoiceItems.first();
        await expect(firstInvoice).toBeVisible();

        // Invoice should have invoice number and amount
        const invoiceNumber = firstInvoice.locator('.invoice-number');
        const invoiceAmount = firstInvoice.locator('.invoice-amount');

        await expect(invoiceNumber).toBeVisible();
        await expect(invoiceAmount).toBeVisible();

        const numberText = await invoiceNumber.textContent();
        expect(numberText).toBeTruthy();
        expect(numberText!.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Subscription Page - Full Details', () => {
    test('displays current subscription details', async ({ page }) => {
      await page.goto('/dashboard/subscription');
      await waitForLoading(page, 'subscription');

      // Verify current subscription card is visible
      const subscriptionCard = page.locator('[data-testid="current-subscription"]');
      await expect(subscriptionCard).toBeVisible();

      // Verify plan name
      const planName = page.locator('[data-testid="plan-name"]');
      await expect(planName).toBeVisible();
      const planNameText = await planName.textContent();
      expect(planNameText).toBeTruthy();
      expect(planNameText).not.toBe('No Plan');

      // Verify plan status
      const planStatus = page.locator('[data-testid="plan-status"]');
      await expect(planStatus).toBeVisible();
    });

    test('displays token balance card', async ({ page }) => {
      await page.goto('/dashboard/subscription');
      await waitForLoading(page, 'subscription');

      // Verify token balance card is visible
      const tokenCard = page.locator('[data-testid="token-balance-card"]');
      await expect(tokenCard).toBeVisible();

      // Verify token balance value is displayed
      const tokenBalance = page.locator('[data-testid="token-balance"]');
      await expect(tokenBalance).toBeVisible();
    });

    test('displays subscription management actions', async ({ page }) => {
      await page.goto('/dashboard/subscription');
      await waitForLoading(page, 'subscription');

      // Verify cancel subscription button exists
      const cancelBtn = page.locator('[data-testid="cancel-subscription"]');
      await expect(cancelBtn).toBeVisible();
    });
  });

  test.describe('Subscription Page - Invoices Table', () => {
    test('displays invoices table with data', async ({ page }) => {
      await page.goto('/dashboard/subscription');
      await waitForLoading(page, 'subscription');

      // Verify invoices section is visible
      const invoicesSection = page.locator('[data-testid="invoices-section"]');
      await expect(invoicesSection).toBeVisible();

      // Verify invoices table is visible
      const invoicesTable = page.locator('[data-testid="invoices-table"]');
      await expect(invoicesTable).toBeVisible();

      // Verify there are invoice rows
      const invoiceRows = page.locator('[data-testid="invoice-row"]');
      const rowCount = await invoiceRows.count();

      // User should have at least one invoice
      expect(rowCount).toBeGreaterThan(0);
    });

    test('invoice rows contain required data fields', async ({ page }) => {
      await page.goto('/dashboard/subscription');
      await waitForLoading(page, 'subscription');

      // Get the first invoice row
      const firstRow = page.locator('[data-testid="invoice-row"]').first();
      await expect(firstRow).toBeVisible();

      // Verify invoice number column
      const invoiceNumber = firstRow.locator('td').nth(0);
      const numberText = await invoiceNumber.textContent();
      expect(numberText).toBeTruthy();
      expect(numberText!.trim().length).toBeGreaterThan(0);

      // Verify date column
      const dateCell = firstRow.locator('td').nth(1);
      const dateText = await dateCell.textContent();
      expect(dateText).toBeTruthy();

      // Verify amount column
      const amountCell = firstRow.locator('td').nth(2);
      const amountText = await amountCell.textContent();
      expect(amountText).toBeTruthy();
      expect(amountText).toMatch(/[$€£]?\d+/); // Should contain currency/numbers

      // Verify status column
      const statusCell = firstRow.locator('td').nth(3);
      const statusText = await statusCell.textContent();
      expect(statusText?.toLowerCase()).toMatch(/paid|pending|overdue|draft/);
    });

    test('invoice search functionality works', async ({ page }) => {
      await page.goto('/dashboard/subscription');
      await waitForLoading(page, 'subscription');

      // Get initial invoice count
      const initialRows = page.locator('[data-testid="invoice-row"]');
      const initialCount = await initialRows.count();

      if (initialCount > 0) {
        // Get the first invoice number
        const firstInvoiceNumber = await initialRows.first().locator('td').nth(0).textContent();

        // Search for that invoice
        const searchInput = page.locator('[data-testid="invoice-search"]');
        await searchInput.fill(firstInvoiceNumber!.trim());

        // Wait for filter to apply
        await page.waitForTimeout(300);

        // Verify filtered results contain the searched invoice
        const filteredRows = page.locator('[data-testid="invoice-row"]');
        const filteredCount = await filteredRows.count();
        expect(filteredCount).toBeGreaterThan(0);
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
      }
    });

    test('invoice view action shows invoice details', async ({ page }) => {
      await page.goto('/dashboard/subscription');
      await waitForLoading(page, 'subscription');

      // Click view button on first invoice
      const viewButton = page.locator('[data-testid="view-invoice"]').first();
      await viewButton.click();

      // Viewing an invoice opens its detail page
      await expect(page).toHaveURL(/\/dashboard\/invoice\/[0-9a-f-]+$/);
    });

    test('invoices data persists after page reload', async ({ page }) => {
      await page.goto('/dashboard/subscription');
      await waitForLoading(page, 'subscription');

      // Wait for invoices table to be populated
      await page.waitForSelector('[data-testid="invoices-table"]', { timeout: 10000 });
      await page.waitForSelector('[data-testid="invoice-row"]', { timeout: 10000 });

      // Get initial invoice data
      const initialRows = page.locator('[data-testid="invoice-row"]');
      const initialCount = await initialRows.count();
      expect(initialCount).toBeGreaterThan(0);

      // Get first invoice number
      const firstInvoiceNumber = await initialRows.first().locator('td').nth(0).textContent();

      // Reload the page
      await page.reload();
      await waitForLoading(page, 'subscription');

      // Verify data persists (rows render once the invoices request resolves)
      const reloadedRows = page.locator('[data-testid="invoice-row"]');
      await expect(reloadedRows).toHaveCount(initialCount);

      // Verify first invoice is the same
      const reloadedFirstInvoice = await reloadedRows.first().locator('td').nth(0).textContent();
      expect(reloadedFirstInvoice).toBe(firstInvoiceNumber);
    });
  });

  test.describe('Data Consistency Across Pages', () => {

    test('invoice count is consistent between dashboard and subscription page', async ({ page }) => {
      // Get recent invoices count from dashboard (max 5)
      await page.goto('/dashboard');
      await waitForLoading(page, 'dashboard');

      const dashboardInvoices = page.locator('[data-testid="invoice-item"]');
      const dashboardCount = await dashboardInvoices.count();

      // Navigate to subscription page for full list
      await page.goto('/dashboard/subscription');
      await waitForLoading(page, 'subscription');

      const subscriptionInvoices = page.locator('[data-testid="invoice-row"]');
      const subscriptionCount = await subscriptionInvoices.count();

      // Dashboard shows max 5, subscription shows all
      // So subscription count should be >= dashboard count (unless pagination limits it)
      expect(subscriptionCount).toBeGreaterThanOrEqual(Math.min(dashboardCount, 5));
    });
  });

  test.describe('Error Handling', () => {
    test('handles loading state correctly', async ({ page }) => {
      // Navigate to subscription page
      await page.goto('/dashboard/subscription');

      // Either loading indicator should appear briefly, or content should be visible
      const loading = page.locator('[data-testid="subscription-loading"]');
      const content = page.locator('[data-testid="current-subscription"]');

      // Wait for either loading to finish or content to appear
      await expect(loading.or(content)).toBeVisible({ timeout: 1000 });

      // Eventually content should be visible
      await waitForLoading(page, 'subscription');
      await expect(content).toBeVisible();
    });
  });
});
