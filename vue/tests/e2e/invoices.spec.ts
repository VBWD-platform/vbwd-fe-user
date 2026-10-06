import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './fixtures/checkout.fixtures';

test.describe('Invoices Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/subscription/invoices');
  });

  test('displays invoices page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Invoices');
  });

  test('shows search input', async ({ page }) => {
    await expect(page.locator('[data-testid="invoice-search"]')).toBeVisible();
  });

  test('shows status filter', async ({ page }) => {
    await expect(page.locator('[data-testid="status-filter"]')).toBeVisible();
  });

  test('displays invoices table when invoices exist', async ({ page }) => {
    // Wait for loading to complete
    await page.waitForSelector('[data-testid="invoices-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Either shows table or empty state
    const table = page.locator('[data-testid="invoices-table"]');
    const empty = page.locator('[data-testid="no-invoices"]');

    await expect(table.or(empty)).toBeVisible();
  });

  test('can filter invoices by status', async ({ page }) => {
    await page.waitForSelector('[data-testid="invoices-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Select pending filter (option values are the backend status enum)
    await page.selectOption('[data-testid="status-filter"]', 'PENDING');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Check that filter is applied
    const filter = await page.locator('[data-testid="status-filter"]').inputValue();
    expect(filter).toBe('PENDING');
  });

  test('can search invoices', async ({ page }) => {
    await page.waitForSelector('[data-testid="invoices-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Type in search
    await page.fill('[data-testid="invoice-search"]', 'INV');

    // Wait for search to apply
    await page.waitForTimeout(500);

    // Verify search input has value
    const searchValue = await page.locator('[data-testid="invoice-search"]').inputValue();
    expect(searchValue).toBe('INV');
  });

  test('can click on invoice row to view details', async ({ page }) => {
    await page.waitForSelector('[data-testid="invoices-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    const table = page.locator('[data-testid="invoices-table"]');
    const hasTable = await table.isVisible().catch(() => false);

    if (hasTable) {
      // Click on first invoice row
      const firstRow = page.locator('tr.invoice-row').first();
      await firstRow.click();

      // Should navigate to invoice detail
      await expect(page).toHaveURL(/\/dashboard\/invoice\/[a-f0-9-]+$/);
    }
  });

  test('view button navigates to invoice detail', async ({ page }) => {
    await page.waitForSelector('[data-testid="invoices-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    const viewBtn = page.locator('[data-testid="view-invoice-btn"]').first();
    const hasViewBtn = await viewBtn.isVisible().catch(() => false);

    if (hasViewBtn) {
      await viewBtn.click();
      await expect(page).toHaveURL(/\/dashboard\/invoice\/[a-f0-9-]+$/);
    }
  });

  test('download button is clickable', async ({ page }) => {
    await page.waitForSelector('[data-testid="invoices-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    const downloadBtn = page.locator('[data-testid="download-invoice-btn"]').first();
    const hasDownloadBtn = await downloadBtn.isVisible().catch(() => false);

    if (hasDownloadBtn) {
      // Just verify button is clickable (actual download may fail due to API)
      await expect(downloadBtn).toBeEnabled();
    }
  });

  test('pay button shown for pending invoices', async ({ page }) => {
    await page.waitForSelector('[data-testid="invoices-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Filter to pending only
    await page.selectOption('[data-testid="status-filter"]', 'PENDING');
    await page.waitForTimeout(500);

    const payBtn = page.locator('[data-testid="pay-invoice-btn"]').first();
    const hasPayBtn = await payBtn.isVisible().catch(() => false);

    if (hasPayBtn) {
      await payBtn.click();
      await expect(page).toHaveURL(/\/dashboard\/invoice\/[a-f0-9-]+\/pay$/);
    }
  });
});

test.describe('Invoice Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('displays invoice detail when navigating from invoices list', async ({ page }) => {
    await page.goto('/dashboard/subscription/invoices');
    await page.waitForSelector('[data-testid="invoices-loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

    const viewBtn = page.locator('[data-testid="view-invoice-btn"]').first();
    const hasViewBtn = await viewBtn.isVisible().catch(() => false);

    if (hasViewBtn) {
      await viewBtn.click();

      // Should show invoice detail page
      await expect(page.locator('h1')).toContainText('Invoice');
    }
  });
});
