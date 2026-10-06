/**
 * Playwright config for running e2e tests against the vbwd-platform Docker stack.
 * All services must already be running (make up in vbwd-platform).
 *
 * Usage:
 *   npx playwright test --config=playwright.platform.config.ts
 */
import { defineConfig, devices } from '@playwright/test';
import { consentStorageState } from './vue/tests/e2e/infrastructure/consent-storage-state';

const baseURL = 'http://localhost:8080';

export default defineConfig({
  // Host-app specs plus every plugin's own tests/e2e/ (plugins ship their own
  // coverage — S152-00), same match set as playwright.config.ts. The glob also
  // picks up vue/tests/e2e/frontend-mode/ (S152-11): those specs read
  // E2E_FRONTEND_MODE (default "vue") and skip their theme-only cases in vue mode.
  testDir: '.',
  testMatch: [
    'vue/tests/e2e/**/*.spec.ts',
    'plugins/*/tests/e2e/**/*.spec.ts',
  ],
  // `@prod` specs target the live production hosts, never the local stack.
  grepInvert: /@prod/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
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

  // No webServer — platform is already running via Docker
});
