import { test, expect } from '@playwright/test';

test.describe('Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'TestPass123@');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('displays profile information', async ({ page }) => {
    await page.goto('/dashboard/profile');

    await expect(page.locator('[data-testid="profile-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-email"]')).toBeVisible();
  });

  test('can update profile name', async ({ page }) => {
    await page.goto('/dashboard/profile');

    await page.fill('[data-testid="name-input"]', 'New Name');
    await page.click('[data-testid="save-profile"]');

    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
  });

  test('can change password', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Change to new password
    await page.fill('[data-testid="current-password"]', 'TestPass123@');
    await page.fill('[data-testid="new-password"]', 'NewTestPass456@');
    await page.fill('[data-testid="confirm-password"]', 'NewTestPass456@');
    await page.click('[data-testid="change-password"]');

    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();

    // Wait for toast to disappear, then change back to original
    await page.waitForTimeout(3500);
    await page.fill('[data-testid="current-password"]', 'NewTestPass456@');
    await page.fill('[data-testid="new-password"]', 'TestPass123@');
    await page.fill('[data-testid="confirm-password"]', 'TestPass123@');
    await page.click('[data-testid="change-password"]');

    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
  });
});
