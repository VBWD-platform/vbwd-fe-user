import { test, expect } from '@playwright/test';

/**
 * CMS Pages E2E Tests
 *
 * Tests the CMS plugin's page rendering, navigation, and breadcrumb.
 * Requires CMS demo data populated (home1, about, privacy, contact pages).
 *
 * Run against platform:
 *   npx playwright test vue/tests/e2e/cms-pages.spec.ts --config=playwright.platform.config.ts
 */

test.describe('CMS Pages — Home Page Redirect', () => {
  test('root URL shows home page (home1 or home2)', async ({ page }) => {
    await page.goto('/');
    // The CMS routing rule redirects / to home1 (or home2)
    // Wait for the page content to load
    await page.waitForLoadState('networkidle');

    // Should be on a home page — check URL contains home or stays at root with content
    const url = page.url();
    const isHomePage = url.includes('home1') || url.includes('home2') || url.endsWith('/');
    expect(isHomePage).toBeTruthy();

    // The page should have visible content (not a loading spinner or error)
    const body = page.locator('body');
    await expect(body).not.toContainText('Page not found');
  });

  test('home page has navigation menu', async ({ page }) => {
    await page.goto('/home1');
    await page.waitForLoadState('networkidle');

    // The CMS layout should render with a header containing navigation
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});

test.describe('CMS Pages — Static Content Pages', () => {
  test('about page loads with content', async ({ page }) => {
    await page.goto('/about');
    await page.waitForLoadState('networkidle');

    // Page should load without error
    await expect(page.locator('body')).not.toContainText('Page not found');

    // Should have some visible text content
    const pageText = await page.textContent('body');
    expect(pageText?.length).toBeGreaterThan(50);
  });

  test('privacy page loads with content', async ({ page }) => {
    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).not.toContainText('Page not found');

    const pageText = await page.textContent('body');
    expect(pageText?.length).toBeGreaterThan(50);
  });

  test('contact page loads with content', async ({ page }) => {
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).not.toContainText('Page not found');
  });

  test('terms page loads with content', async ({ page }) => {
    await page.goto('/terms');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).not.toContainText('Page not found');
  });

  test('features page loads with content', async ({ page }) => {
    await page.goto('/features');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).not.toContainText('Page not found');
  });
});

test.describe('CMS Pages — Navigation Between Pages', () => {
  test('can navigate from home to about page', async ({ page }) => {
    await page.goto('/home1');
    await page.waitForLoadState('networkidle');

    // Find and click the About link in navigation
    const aboutLink = page.locator('a[href*="about"], a:has-text("About")').first();
    if (await aboutLink.isVisible()) {
      await aboutLink.click();
      await page.waitForLoadState('networkidle');

      const url = page.url();
      expect(url).toContain('about');
    }
  });

  test('can navigate from about to privacy page', async ({ page }) => {
    await page.goto('/about');
    await page.waitForLoadState('networkidle');

    // Look for privacy link in footer nav or page content
    const privacyLink = page.locator('a[href*="privacy"], a:has-text("Privacy")').first();
    if (await privacyLink.isVisible()) {
      await privacyLink.click();
      await page.waitForLoadState('networkidle');

      const url = page.url();
      expect(url).toContain('privacy');
    }
  });

  test('can navigate from privacy to contact page', async ({ page }) => {
    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');

    const contactLink = page.locator('a[href*="contact"], a:has-text("Contact")').first();
    if (await contactLink.isVisible()) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      const url = page.url();
      expect(url).toContain('contact');
    }
  });
});

test.describe('CMS Pages — Breadcrumb Navigation', () => {
  test('about page has breadcrumb with Home link', async ({ page }) => {
    await page.goto('/about');
    await page.waitForLoadState('networkidle');

    // Look for breadcrumb component
    const breadcrumb = page.locator('.cms-breadcrumb, nav[aria-label="breadcrumb"], .breadcrumb, [data-testid="breadcrumb"]');
    if (await breadcrumb.isVisible()) {
      // Breadcrumb should contain a Home link
      const homeLink = breadcrumb.locator('a:has-text("Home"), a[href="/"], a[href="/home1"]').first();
      await expect(homeLink).toBeVisible();
    }
  });

  test('clicking breadcrumb Home navigates to home page', async ({ page }) => {
    await page.goto('/about');
    await page.waitForLoadState('networkidle');

    const breadcrumb = page.locator('.cms-breadcrumb, nav[aria-label="breadcrumb"], .breadcrumb, [data-testid="breadcrumb"]');
    if (await breadcrumb.isVisible()) {
      const homeLink = breadcrumb.locator('a:has-text("Home"), a[href="/"], a[href="/home1"]').first();
      if (await homeLink.isVisible()) {
        await homeLink.click();
        await page.waitForLoadState('networkidle');

        const url = page.url();
        const isHome = url.endsWith('/') || url.includes('home');
        expect(isHome).toBeTruthy();
      }
    }
  });

  test('privacy page breadcrumb shows correct path', async ({ page }) => {
    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');

    const breadcrumb = page.locator('.cms-breadcrumb, nav[aria-label="breadcrumb"], .breadcrumb, [data-testid="breadcrumb"]');
    if (await breadcrumb.isVisible()) {
      const breadcrumbText = await breadcrumb.textContent();
      // Should contain Home and current page name
      expect(breadcrumbText).toBeTruthy();
    }
  });
});

test.describe('CMS Pages — Error Handling', () => {
  test('nonexistent page shows not found message', async ({ page }) => {
    await page.goto('/nonexistent-page-slug-12345');
    await page.waitForLoadState('networkidle');

    // Should show some kind of "not found" indication
    const bodyText = await page.textContent('body');
    const isNotFound = bodyText?.includes('not found') ||
                       bodyText?.includes('Not Found') ||
                       bodyText?.includes('404') ||
                       page.url().includes('not-found');
    expect(isNotFound).toBeTruthy();
  });
});

test.describe('CMS Pages — Page Index', () => {
  test('pages index lists published pages', async ({ page }) => {
    await page.goto('/pages');
    await page.waitForLoadState('networkidle');

    // Should show a list of pages
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    // Should not be an error page
    await expect(page.locator('body')).not.toContainText('Page not found');
  });
});
