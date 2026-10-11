/**
 * Playwright Global Setup
 *
 * Runs before all E2E tests to:
 * 1. Seed test data in the backend database
 * 2. Wait for backend to be ready
 *
 * Environment Variables:
 *   TEST_DATA_SEED: When 'true', seeds test data (the seeder also grants the
 *                   test user the registration-default access level)
 *   VBWD_BACKEND_DIR: vbwd-backend checkout (default: sibling ../vbwd-backend)
 *   API_BASE_URL: Backend URL (default: http://localhost:5000/api/v1)
 */
import { runBackendFlaskCommand } from './backend-cli';

async function globalSetup() {
  console.log('Setting up E2E test environment...');

  // Seed test data in backend if configured
  if (process.env.TEST_DATA_SEED === 'true') {
    try {
      console.log('Seeding test data...');
      runBackendFlaskCommand('seed-test-data', 'TEST_DATA_SEED');
      console.log('Test data seeded successfully');
    } catch (error) {
      console.warn('Could not seed test data:', error);
      // Continue anyway - data may already exist
    }
  }

  // Wait for backend to be ready
  await waitForBackend();
}

async function waitForBackend(timeout = 30000): Promise<void> {
  const start = Date.now();
  const url = process.env.API_BASE_URL || 'http://localhost:5000/api/v1/health';

  console.log(`Waiting for backend at ${url}...`);

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log('Backend is ready');
        return;
      }
    } catch {
      // Backend not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.warn(`Backend not ready after ${timeout}ms, proceeding anyway`);
}

export default globalSetup;
