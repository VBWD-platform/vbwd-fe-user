/**
 * Standalone Playwright screenshot capture for the S101.3 walkthrough.
 * Runs OUTSIDE the host Playwright config (no global-setup) — these are public,
 * auth-free pharmacy storefront routes. Usage:
 *   node plugins/shop-pharma/tests/e2e/capture-screenshots.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const OUT = process.env.OUT_DIR ||
  '/Users/dantweb/dantweb/vbwd-sdk-2/docs/dev_log/20260622/walkthrough/s101';

async function waitForApp(page, url, selector) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector(selector, { timeout: 30000 });
  // Wait for all <img> to finish decoding so screenshots show the artwork.
  await page.waitForFunction(
    () => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0),
    { timeout: 15000 },
  ).catch(() => { /* tolerate a slow/missing asset — screenshot anyway */ });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

try {
  // (a) class-segmented catalogue
  await waitForApp(page, `${BASE}/pharmacy`, '[data-testid="pharmacy-catalogue"]');
  await page.waitForSelector('[data-testid="pharmacy-segment-OTC"]', { timeout: 30000 });
  await page.screenshot({ path: `${OUT}/01-catalogue-class-segmented.png`, fullPage: true });
  console.log('captured 01-catalogue-class-segmented.png');

  // (b) OTC product page (region logo + leaflet + gates)
  await waitForApp(page, `${BASE}/pharmacy/p/aspirin-100mg`, '[data-testid="pharmacy-product"]');
  await page.waitForSelector('[data-testid="pharmacy-product-region-logo"]', { timeout: 30000 });
  await page.screenshot({ path: `${OUT}/02-otc-product-page.png`, fullPage: true });
  console.log('captured 02-otc-product-page.png');

  // (c) RX product page — BLOCKED / prescription required
  await waitForApp(page, `${BASE}/pharmacy/p/amoxicillin-suspension`, '[data-testid="pharmacy-product"]');
  await page.waitForSelector('[data-testid="pharmacy-product-rx-block"]', { timeout: 30000 });
  await page.screenshot({ path: `${OUT}/03-rx-product-blocked.png`, fullPage: true });
  console.log('captured 03-rx-product-blocked.png');
} finally {
  if (consoleErrors.length) {
    console.log('CONSOLE ERRORS:\n' + consoleErrors.join('\n'));
  } else {
    console.log('No console errors.');
  }
  await browser.close();
}
