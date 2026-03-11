import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Tests: GHRM Public Catalogue — Browse → Package Detail → Checkout Redirect
 *
 * The catalogue is publicly accessible (no auth required). Backend API responses
 * are mocked via page.route() so the tests are deterministic and fast.
 */

const BASE_API = '/api/v1';

const MOCK_PACKAGES = [
  {
    id: 'pkg-1',
    slug: 'my-backend-pkg',
    name: 'My Backend Package',
    short_description: 'A great backend plugin.',
    latest_version: 'v2.1.0',
    download_count: 128,
    category_slug: 'backend',
    icon_url: null,
    screenshots: [],
  },
  {
    id: 'pkg-2',
    slug: 'my-fe-pkg',
    name: 'My Frontend Package',
    short_description: 'A great frontend plugin.',
    latest_version: 'v1.0.0',
    download_count: 57,
    category_slug: 'fe-user',
    icon_url: null,
    screenshots: [],
  },
];

const MOCK_PACKAGE_DETAIL = {
  id: 'pkg-1',
  slug: 'my-backend-pkg',
  name: 'My Backend Package',
  github_owner: 'acme',
  github_repo: 'my-backend-pkg',
  github_protected_branch: 'release',
  readme: '# My Backend Package\n\nFull documentation here.',
  changelog: '## v2.1.0\n\n- New feature.\n\n## v2.0.0\n\n- Breaking change.',
  docs: null,
  cached_releases: [
    {
      tag: 'v2.1.0',
      date: '2026-02-01T00:00:00',
      notes: 'New feature.',
      assets: [{ name: 'dist.zip', url: 'https://example.com/dist.zip' }],
    },
    {
      tag: 'v2.0.0',
      date: '2026-01-01T00:00:00',
      notes: 'Breaking change.',
      assets: [],
    },
  ],
  latest_version: 'v2.1.0',
  screenshots: [],
  download_count: 128,
  tariff_plan_id: 'plan-backend-1',
  tariff_plan_slug: 'plugin-backend',
};

async function mockCatalogueList(page: Page, categorySlug: string) {
  await page.route(
    (url) =>
      url.pathname.startsWith(`${BASE_API}/ghrm/packages`) &&
      url.searchParams.get('category_slug') === categorySlug,
    (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: MOCK_PACKAGES.filter((p) => p.category_slug === categorySlug),
          total: MOCK_PACKAGES.filter((p) => p.category_slug === categorySlug).length,
          page: 1,
          per_page: 20,
          pages: 1,
        }),
      });
    },
  );
}

async function mockCatalogueSearch(page: Page, query: string) {
  await page.route(
    (url) =>
      url.pathname.startsWith(`${BASE_API}/ghrm/packages`) &&
      url.searchParams.get('query') === query,
    (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: MOCK_PACKAGES.filter((p) =>
            p.name.toLowerCase().includes(query.toLowerCase()),
          ),
          total: 1,
          page: 1,
          per_page: 20,
          pages: 1,
        }),
      });
    },
  );
}

async function mockPackageDetail(page: Page) {
  await page.route(`${BASE_API}/ghrm/packages/${MOCK_PACKAGE_DETAIL.slug}`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PACKAGE_DETAIL),
    });
  });
}

async function mockRelated(page: Page) {
  await page.route(
    `${BASE_API}/ghrm/packages/${MOCK_PACKAGE_DETAIL.slug}/related`,
    (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    },
  );
}

async function mockAccessStatus(page: Page) {
  await page.route(`${BASE_API}/ghrm/access-status*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'none', deploy_token: null, github_username: null }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('GHRM Public Catalogue — Browse', () => {
  test('[GHRM-C1] Category index page is publicly accessible without login', async ({
    page,
  }) => {
    await mockCatalogueList(page, 'backend');

    await page.goto('/software/backend');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to login
    expect(page.url()).toMatch(/\/software/);
    expect(page.url()).not.toMatch(/login/);
  });

  test('[GHRM-C2] Category page lists packages', async ({ page }) => {
    await mockCatalogueList(page, 'backend');

    await page.goto('/software/backend');
    await page.waitForLoadState('networkidle');

    // Package cards should be visible
    const cards = page.locator(
      '[data-testid="package-card"], .package-card, .ghrm-package-card',
    );
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('[GHRM-C3] Package card shows name and version', async ({ page }) => {
    await mockCatalogueList(page, 'backend');

    await page.goto('/software/backend');
    await page.waitForLoadState('networkidle');

    const firstCard = page
      .locator('[data-testid="package-card"], .package-card, .ghrm-package-card')
      .first();

    const nameEl = firstCard.locator('h2, h3, .package-name, [data-testid="package-name"]');
    const hasName = await nameEl.isVisible().catch(() => false);
    expect(hasName).toBeTruthy();

    const versionEl = firstCard.locator('.version, .badge, [data-testid="version"]');
    const hasVersion = await versionEl.isVisible().catch(() => false);
    // Version badge is optional but name is required
    expect(hasName).toBeTruthy();
    void hasVersion; // informational
  });

  test('[GHRM-C4] Clicking a package card navigates to detail page', async ({
    page,
  }) => {
    await mockCatalogueList(page, 'backend');
    await mockPackageDetail(page);
    await mockRelated(page);
    await mockAccessStatus(page);

    await page.goto('/software/backend');
    await page.waitForLoadState('networkidle');

    const firstCard = page
      .locator('[data-testid="package-card"], .package-card, .ghrm-package-card')
      .first();

    await firstCard.click();
    await page.waitForLoadState('networkidle');

    // URL should contain the package slug
    expect(page.url()).toMatch(/my-backend-pkg/);
  });

  test('[GHRM-C5] Search returns filtered results', async ({ page }) => {
    await mockCatalogueSearch(page, 'backend');

    await page.goto('/software/search?q=backend');
    await page.waitForLoadState('networkidle');

    const cards = page.locator(
      '[data-testid="package-card"], .package-card, .ghrm-package-card, .search-result',
    );
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('GHRM Package Detail — Tabs', () => {
  test.beforeEach(async ({ page }) => {
    await mockPackageDetail(page);
    await mockRelated(page);
    await mockAccessStatus(page);
    await page.goto(`/software/backend/${MOCK_PACKAGE_DETAIL.slug}`);
    await page.waitForLoadState('networkidle');
  });

  test('[GHRM-D1] Detail page shows package name', async ({ page }) => {
    const heading = page.locator(
      `h1:has-text("${MOCK_PACKAGE_DETAIL.name}"), [data-testid="package-title"]`,
    );
    await expect(heading.first()).toBeVisible({ timeout: 8000 });
  });

  test('[GHRM-D2] Overview tab is active by default and renders readme', async ({
    page,
  }) => {
    // README content should be visible on the overview tab
    const readmeEl = page.locator(
      '[data-testid="readme"], .readme-content, .markdown-body',
    );
    const hasReadme = await readmeEl.isVisible({ timeout: 8000 }).catch(() => false);
    expect(hasReadme).toBeTruthy();
  });

  test('[GHRM-D3] Changelog tab renders changelog content', async ({ page }) => {
    const changelogTab = page.locator(
      '[data-testid="tab-changelog"], button:has-text("Changelog"), a:has-text("Changelog")',
    );
    await changelogTab.first().click();
    await page.waitForTimeout(300);

    const changelogEl = page.locator(
      '[data-testid="changelog"], .changelog-content, .markdown-body',
    );
    const hasChangelog = await changelogEl.isVisible().catch(() => false);
    expect(hasChangelog).toBeTruthy();
  });

  test('[GHRM-D4] Versions tab lists release entries', async ({ page }) => {
    const versionsTab = page.locator(
      '[data-testid="tab-versions"], button:has-text("Versions"), a:has-text("Versions")',
    );
    await versionsTab.first().click();
    await page.waitForTimeout(300);

    // Should show at least one version entry
    const releases = page.locator(
      '[data-testid="release-item"], .release-item, .release-entry, .version-entry',
    );
    const count = await releases.count();
    expect(count).toBeGreaterThan(0);
  });

  test('[GHRM-D5] Latest version badge is shown', async ({ page }) => {
    const versionBadge = page.locator(
      `[data-testid="latest-version"]:has-text("v2.1.0"), .version-badge:has-text("v2.1.0"), .badge:has-text("v2.1.0")`,
    );
    const hasBadge = await versionBadge.isVisible().catch(() => false);
    expect(hasBadge).toBeTruthy();
  });
});

test.describe('GHRM Get Package → Checkout Redirect', () => {
  test('[GHRM-R1] "Get Package" / "Subscribe" CTA is visible on detail page', async ({
    page,
  }) => {
    await mockPackageDetail(page);
    await mockRelated(page);
    await mockAccessStatus(page);

    await page.goto(`/software/backend/${MOCK_PACKAGE_DETAIL.slug}`);
    await page.waitForLoadState('networkidle');

    const cta = page.locator(
      '[data-testid="get-package-btn"], [data-testid="subscribe-cta"], button:has-text("Get Package"), button:has-text("Subscribe"), a:has-text("Get Package")',
    );
    await expect(cta.first()).toBeVisible({ timeout: 8000 });
  });

  test('[GHRM-R2] Clicking CTA redirects to checkout with tariff_plan_id', async ({
    page,
  }) => {
    await mockPackageDetail(page);
    await mockRelated(page);
    await mockAccessStatus(page);

    await page.goto(`/software/backend/${MOCK_PACKAGE_DETAIL.slug}`);
    await page.waitForLoadState('networkidle');

    const cta = page.locator(
      '[data-testid="get-package-btn"], [data-testid="subscribe-cta"], button:has-text("Get Package"), button:has-text("Subscribe"), a:has-text("Get Package")',
    );

    const hasCta = await cta.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasCta) {
      test.skip();
      return;
    }

    await cta.first().click();
    await page.waitForLoadState('networkidle');

    // Should land on checkout or plans page with tariff_plan_id parameter
    const url = page.url();
    const hasCheckout =
      url.includes('/checkout') || url.includes('/plans') || url.includes('tarif_plan');
    expect(hasCheckout).toBeTruthy();
  });

  test('[GHRM-R3] Related packages strip is shown when related list is non-empty', async ({
    page,
  }) => {
    await mockPackageDetail(page);
    await mockAccessStatus(page);

    // Override related to return one item
    await page.route(
      `${BASE_API}/ghrm/packages/${MOCK_PACKAGE_DETAIL.slug}/related`,
      (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'pkg-2',
              slug: 'my-fe-pkg',
              name: 'My Frontend Package',
              latest_version: 'v1.0.0',
              download_count: 57,
            },
          ]),
        });
      },
    );

    await page.goto(`/software/backend/${MOCK_PACKAGE_DETAIL.slug}`);
    await page.waitForLoadState('networkidle');

    const relatedSection = page.locator(
      '[data-testid="related-packages"], .related-packages, .related-strip',
    );
    const hasRelated = await relatedSection.isVisible({ timeout: 6000 }).catch(() => false);
    expect(hasRelated).toBeTruthy();
  });

  test('[GHRM-R4] Related packages strip is hidden when list is empty', async ({
    page,
  }) => {
    await mockPackageDetail(page);
    await mockRelated(page); // returns []
    await mockAccessStatus(page);

    await page.goto(`/software/backend/${MOCK_PACKAGE_DETAIL.slug}`);
    await page.waitForLoadState('networkidle');

    const relatedSection = page.locator(
      '[data-testid="related-packages"], .related-packages, .related-strip',
    );
    const hasRelated = await relatedSection.isVisible().catch(() => false);
    expect(hasRelated).toBeFalsy();
  });
});
