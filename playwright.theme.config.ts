/**
 * S152 — the theme plugins' walkthrough specs (`walkthrough-<plugin>.spec.ts`, tagged
 * `@<plugin>`). They live in each theme plugin repo (`<repo>/tests/e2e/`), not in fe-user;
 * this config runs them with fe-user's Playwright against a running theme-mode stack.
 *
 * Usage (in vbwd-fe-user, the stack switched to VBWD_FRONTEND_MODE=theme):
 *   E2E_FRONTEND_MODE=theme npx playwright test -c playwright.theme.config.ts [--grep @theme_shop]
 * or from a theme repo: `bin/pre-commit-check.sh --e2e`.
 *
 * VBWD_THEME_PLUGINS_DIR: the directory holding the theme plugin repos
 * (default: the SDK layout's ../vbwd-backend/plugins). Repos match as `theme*` or
 * `vbwd-plugin-theme*` (a standalone clone).
 *
 * Module resolution: the specs sit outside this package, where Node cannot find
 * `@playwright/test`. tsconfig.theme-e2e.json maps it (and `@fe-user-e2e/*`, the shared
 * frontend-mode helpers) into this checkout, so one Playwright instance serves every spec.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { consentStorageState } from './vue/tests/e2e/infrastructure/consent-storage-state';

const FE_USER_ROOT = path.dirname(fileURLToPath(import.meta.url));
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:8080';
const themePluginsDir = path.resolve(
  FE_USER_ROOT,
  process.env.VBWD_THEME_PLUGINS_DIR || '../vbwd-backend/plugins',
);

export default defineConfig({
  testDir: themePluginsDir,
  testMatch: ['theme*/tests/e2e/**/*.spec.ts', 'vbwd-plugin-theme*/tests/e2e/**/*.spec.ts'],
  tsconfig: './tsconfig.theme-e2e.json',
  // Own output dir: Playwright empties it per run, so the parity run's results and the
  // walkthrough screenshots (test-results/walkthrough-<plugin>-<step>.png) survive.
  outputDir: path.join(FE_USER_ROOT, 'test-results', 'theme-walkthroughs'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  // A walkthrough is a whole journey (seed → many themed pages → cleanup).
  timeout: 180_000,
  reporter: 'list',

  globalSetup: './vue/tests/e2e/infrastructure/global-setup.ts',
  globalTeardown: './vue/tests/e2e/infrastructure/global-teardown.ts',

  use: {
    baseURL,
    storageState: consentStorageState(baseURL),
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer: the theme pages need the full stack (nginx router + api in theme mode).
});
