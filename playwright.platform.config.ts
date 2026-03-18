/**
 * Playwright config for running e2e tests against the vbwd-platform Docker stack.
 * All services must already be running (make up in vbwd-platform).
 *
 * Usage:
 *   npx playwright test --config=playwright.platform.config.ts
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './vue/tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',

  globalSetup: './vue/tests/e2e/infrastructure/global-setup.ts',
  globalTeardown: './vue/tests/e2e/infrastructure/global-teardown.ts',

  use: {
    baseURL: 'http://localhost:8080',
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
