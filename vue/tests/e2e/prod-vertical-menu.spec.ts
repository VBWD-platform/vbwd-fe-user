import { test, expect } from '@playwright/test';

/**
 * Assert each vertical's header menu has the items the instance-seed.json
 * specifies (sprint 24). Runs against either a single vertical (via
 * E2E_BASE_URL) or the public prod URLs directly.
 *
 *   E2E_BASE_URL=https://doctor.vbwd.cc npx playwright test prod-vertical-menu
 *   (or)
 *   npx playwright test prod-vertical-menu     # uses absolute URLs below
 */

type VerticalExpectations = {
  domain: string;
  requiredTopLevel: string[];        // order-agnostic
  demoSubmenu?: string[];             // for 'main' only
};

const DEFAULTS: Record<string, VerticalExpectations> = {
  main: {
    domain: 'https://vbwd.cc',
    requiredTopLevel: ['Home', 'Features', 'Demo', 'About', 'Pricing', 'Blog'],
    demoSubmenu: ['Software store', 'Hotel', 'Clinic', 'Shop', 'Blog', 'SaaS'],
  },
  doctor: {
    domain: 'https://doctor.vbwd.cc',
    requiredTopLevel: ['Home', 'Features', 'Book Doctor', 'About', 'Pricing', 'Blog'],
  },
  hotel: {
    domain: 'https://hotel.vbwd.cc',
    requiredTopLevel: ['Home', 'Features', 'Book a Room', 'About', 'Pricing', 'Blog'],
  },
  shop: {
    domain: 'https://shop.vbwd.cc',
    requiredTopLevel: ['Home', 'Features', 'Shop', 'About', 'Pricing', 'Blog'],
  },
  ghrm: {
    domain: 'https://ghrm.vbwd.cc',
    requiredTopLevel: ['Home', 'Features', 'Software', 'About', 'Pricing', 'Blog'],
  },
  saas: {
    domain: 'https://saas.vbwd.cc',
    requiredTopLevel: ['Home', 'Features', 'Tarif plans', 'About', 'Pricing', 'Blog'],
  },
};

// Allow overriding a single vertical via env vars (e.g. for local smoke tests)
const SINGLE = process.env.VERTICAL;
const targets = SINGLE
  ? { [SINGLE]: { ...DEFAULTS[SINGLE], domain: process.env.E2E_BASE_URL ?? DEFAULTS[SINGLE].domain } }
  : DEFAULTS;

for (const [vertical, exp] of Object.entries(targets)) {
  test.describe(`vertical menu — ${vertical}`, { tag: '@prod' }, () => {
    test(`${exp.domain} header exposes expected items`, async ({ page }) => {
      const navLabels: string[] = [];
      await page.goto(exp.domain + '/', { waitUntil: 'networkidle' });

      // Collect top-level menu labels. The CMS menu widget renders a <nav>
      // containing <a> elements (or <button> for submenu parents).
      const labels = await page
        .locator('header nav a, header nav button, nav[data-testid*="header"] a')
        .allInnerTexts()
        .catch(() => []);
      for (const l of labels) navLabels.push(l.trim());

      console.log(`[AUDIT] ${vertical} header labels:`, navLabels);

      for (const needed of exp.requiredTopLevel) {
        expect.soft(navLabels.some((l) => l.includes(needed)),
          `${vertical}: "${needed}" not found in header. Got: ${navLabels.join(' | ')}`,
        ).toBe(true);
      }

      if (exp.demoSubmenu) {
        // Hover/click the Demo item to expose its submenu
        const demo = page.locator('header nav').locator('text=Demo').first();
        await demo.hover().catch(() => {});
        await demo.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
        const submenuLabels = await page
          .locator('header nav ul ul a, header nav [role="menu"] a')
          .allInnerTexts()
          .catch(() => []);
        console.log(`[AUDIT] ${vertical} Demo submenu:`, submenuLabels);
        for (const sub of exp.demoSubmenu) {
          expect.soft(submenuLabels.some((l) => l.includes(sub)),
            `main: Demo submenu missing "${sub}"`,
          ).toBe(true);
        }
      }
    });
  });
}
