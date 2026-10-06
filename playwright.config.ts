import { defineConfig, devices } from '@playwright/test';
import { consentStorageState } from './vue/tests/e2e/infrastructure/consent-storage-state';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  // Host-app tests live under vue/tests/e2e; each plugin owns its own
  // tests/e2e/ folder (SOLID — plugins ship with their own coverage).
  testDir: '.',
  testMatch: [
    'vue/tests/e2e/**/*.spec.ts',
    'plugins/*/tests/e2e/**/*.spec.ts',
  ],
  fullyParallel: false,  // Run serially to avoid rate limiting
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,  // Single worker to avoid rate limiting on login endpoint
  reporter: 'list',

  // Global setup/teardown for test data management
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
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_BACKEND_URL: 'http://localhost:5000',
    },
  },
});
