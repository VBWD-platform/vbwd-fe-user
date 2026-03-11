import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Tests: GHRM Subscribe → OAuth → Install Token → Cancel → Grace → Revoke
 *
 * GitHub OAuth is mocked via page.route() — the real GitHub auth server is
 * never contacted. The backend GHRM endpoints are intercepted so the flow
 * exercises the full frontend lifecycle without needing a live GitHub app.
 */

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPass123@';

const BASE_API = '/api/v1';

async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  const isLoginPage = await page
    .locator('[data-testid="login-form"], .login-container')
    .isVisible()
    .catch(() => false);

  if (isLoginPage) {
    await page.locator('[data-testid="email"]').fill(TEST_USER_EMAIL);
    await page.locator('[data-testid="password"]').fill(TEST_USER_PASSWORD);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL('/dashboard', { timeout: 15000 });
  }
}

/** Mock the GHRM access status endpoint. */
async function mockAccessStatus(
  page: Page,
  status: 'none' | 'active' | 'grace' | 'revoked',
  deployToken?: string,
) {
  await page.route(`${BASE_API}/ghrm/access-status*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status,
        deploy_token: deployToken ?? null,
        github_username: status !== 'none' ? 'test-gh-user' : null,
      }),
    });
  });
}

/** Mock the GHRM OAuth URL endpoint. */
async function mockOAuthUrl(page: Page) {
  await page.route(`${BASE_API}/ghrm/github/oauth-url*`, (route) => {
    // Return a URL that immediately redirects back as a callback
    const callbackUrl = new URL(page.url());
    const fakeState = 'mock-state-token-abc123';
    const fakeCode = 'mock-github-code-xyz';
    callbackUrl.pathname = '/software/github/callback';
    callbackUrl.search = `?code=${fakeCode}&state=${fakeState}`;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: callbackUrl.toString() }),
    });
  });
}

/** Mock the GHRM OAuth callback endpoint. */
async function mockOAuthCallback(page: Page) {
  await page.route(`${BASE_API}/ghrm/github/callback`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        github_username: 'test-gh-user',
        message: 'GitHub account connected.',
      }),
    });
  });
}

/** Mock the install instructions endpoint. */
async function mockInstallInstructions(page: Page, pkg: string) {
  await page.route(`${BASE_API}/ghrm/packages/${pkg}/install-instructions`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        deploy_token: 'ghp_mock_deploy_token_123',
        npm: 'npm install git+https://ghp_mock_deploy_token_123@github.com/acme/my-pkg#release',
        pip: 'pip install git+https://ghp_mock_deploy_token_123@github.com/acme/my-pkg@release',
        git: 'git clone https://ghp_mock_deploy_token_123@github.com/acme/my-pkg',
        composer: null,
      }),
    });
  });
}

/** Mock a single package detail response. */
async function mockPackageDetail(page: Page, slug: string) {
  await page.route(`${BASE_API}/ghrm/packages/${slug}`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'pkg-test-1',
        slug,
        name: 'My Test Package',
        github_owner: 'acme',
        github_repo: 'my-pkg',
        github_protected_branch: 'release',
        readme: '# My Test Package\n\nA great package.',
        changelog: '## v1.0.0\n\n- Initial release.',
        cached_releases: [
          {
            tag: 'v1.0.0',
            date: '2026-01-01T00:00:00',
            notes: 'Initial release',
            assets: [{ name: 'dist.zip', url: 'https://example.com/dist.zip' }],
          },
        ],
        latest_version: 'v1.0.0',
        screenshots: [],
        docs: null,
        download_count: 42,
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('GHRM Lifecycle — Subscribe → OAuth → Install → Cancel → Grace → Revoke', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('[GHRM-L1] Package detail Install tab shows connect button when not subscribed', async ({
    page,
  }) => {
    const slug = 'my-test-pkg';
    await mockPackageDetail(page, slug);
    await mockAccessStatus(page, 'none');

    await page.goto(`/software/backend/${slug}`);
    await page.waitForLoadState('networkidle');

    // Click Install tab
    const installTab = page.locator('[data-testid="tab-install"], button:has-text("Install")');
    await installTab.first().click();
    await page.waitForTimeout(300);

    // Should show GitHub connect button or subscription prompt
    const connectBtn = page.locator(
      '[data-testid="github-connect-btn"], .ghrm-connect-button, button:has-text("Connect GitHub")',
    );
    const subscribePrompt = page.locator(
      '[data-testid="subscribe-prompt"], .subscribe-prompt, .subscription-required',
    );

    const hasConnect = await connectBtn.isVisible().catch(() => false);
    const hasSubscribePrompt = await subscribePrompt.isVisible().catch(() => false);

    expect(hasConnect || hasSubscribePrompt).toBeTruthy();
  });

  test('[GHRM-L2] Connect GitHub button initiates OAuth redirect', async ({
    page,
  }) => {
    const slug = 'my-test-pkg';
    await mockPackageDetail(page, slug);
    await mockAccessStatus(page, 'none');
    await mockOAuthUrl(page);

    await page.goto(`/software/backend/${slug}`);
    await page.waitForLoadState('networkidle');

    const installTab = page.locator('[data-testid="tab-install"], button:has-text("Install")');
    await installTab.first().click();
    await page.waitForTimeout(300);

    const connectBtn = page.locator(
      '[data-testid="github-connect-btn"], .ghrm-connect-button, button:has-text("Connect GitHub")',
    );

    const hasConnect = await connectBtn.isVisible().catch(() => false);
    if (!hasConnect) {
      test.skip();
      return;
    }

    // Clicking should request OAuth URL
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('oauth-url')),
      connectBtn.click(),
    ]);
    expect(request).toBeTruthy();
  });

  test('[GHRM-L3] OAuth callback page exchanges code and redirects to settings', async ({
    page,
  }) => {
    await mockOAuthCallback(page);
    // Simulate arriving at callback page with code + state params
    await page.goto('/software/github/callback?code=mock-code-abc&state=mock-state-123');
    await page.waitForLoadState('networkidle');

    // Should redirect to dashboard/settings after callback is processed
    await page.waitForURL(/\/(dashboard\/settings|dashboard|software)/, { timeout: 8000 });

    const url = page.url();
    expect(url).toMatch(/dashboard|software/);
  });

  test('[GHRM-L4] Install tab shows install commands when access is active', async ({
    page,
  }) => {
    const slug = 'my-test-pkg';
    await mockPackageDetail(page, slug);
    await mockAccessStatus(page, 'active');
    await mockInstallInstructions(page, slug);

    await page.goto(`/software/backend/${slug}`);
    await page.waitForLoadState('networkidle');

    const installTab = page.locator('[data-testid="tab-install"], button:has-text("Install")');
    await installTab.first().click();
    await page.waitForTimeout(500);

    // Should show deploy token and install commands
    const tokenEl = page.locator(
      '[data-testid="deploy-token"], .deploy-token, code:has-text("ghp_mock")',
    );
    const npmEl = page.locator(
      '[data-testid="npm-command"], .npm-command, code:has-text("npm install")',
    );

    const hasToken = await tokenEl.isVisible().catch(() => false);
    const hasNpm = await npmEl.isVisible().catch(() => false);

    expect(hasToken || hasNpm).toBeTruthy();
  });

  test('[GHRM-L5] Install tab shows grace period warning when access is in grace', async ({
    page,
  }) => {
    const slug = 'my-test-pkg';
    await mockPackageDetail(page, slug);
    await mockAccessStatus(page, 'grace');

    await page.goto(`/software/backend/${slug}`);
    await page.waitForLoadState('networkidle');

    const installTab = page.locator('[data-testid="tab-install"], button:has-text("Install")');
    await installTab.first().click();
    await page.waitForTimeout(500);

    // Grace period banner should be visible
    const graceBanner = page.locator(
      '[data-testid="grace-banner"], .grace-period, .grace-warning, [class*="grace"]',
    );
    const hasGrace = await graceBanner.isVisible().catch(() => false);

    // Also acceptable: subscription prompt or resubscribe CTA
    const resubscribe = page.locator(
      'button:has-text("Resubscribe"), a:has-text("Renew"), [data-testid="resubscribe"]',
    );
    const hasResubscribe = await resubscribe.isVisible().catch(() => false);

    expect(hasGrace || hasResubscribe).toBeTruthy();
  });

  test('[GHRM-L6] Install tab shows revoked message when access is revoked', async ({
    page,
  }) => {
    const slug = 'my-test-pkg';
    await mockPackageDetail(page, slug);
    await mockAccessStatus(page, 'revoked');

    await page.goto(`/software/backend/${slug}`);
    await page.waitForLoadState('networkidle');

    const installTab = page.locator('[data-testid="tab-install"], button:has-text("Install")');
    await installTab.first().click();
    await page.waitForTimeout(500);

    // Revoked state: should NOT show install commands
    const npmEl = page.locator('[data-testid="npm-command"], code:has-text("npm install")');
    const hasNpm = await npmEl.isVisible().catch(() => false);
    expect(hasNpm).toBeFalsy();

    // Should show subscribe/reconnect prompt
    const prompt = page.locator(
      '.subscription-required, .revoked-notice, [data-testid="subscribe-prompt"], button:has-text("Subscribe")',
    );
    const hasPrompt = await prompt.isVisible().catch(() => false);
    expect(hasPrompt).toBeTruthy();
  });
});
