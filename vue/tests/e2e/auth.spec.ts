import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard/profile');
    await expect(page).toHaveURL(/.*login/);
  });

  test('can login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'TestPass123@');
    await page.click('[data-testid="login-button"]');

    await expect(page).toHaveURL('/dashboard');
  });

  test('shows error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('can logout', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'TestPass123@');
    await page.click('[data-testid="login-button"]');

    // Then logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');

    await expect(page).toHaveURL(/.*login/);
  });
});
