/**
 * Playwright Global Teardown
 *
 * Runs after all E2E tests to:
 * 1. Cleanup test data from the backend database (if configured)
 *
 * Environment Variables:
 *   TEST_DATA_CLEANUP: When 'true', removes test data after tests
 *   VBWD_BACKEND_DIR: vbwd-backend checkout (default: sibling ../vbwd-backend)
 */
import { runBackendFlaskCommand } from './backend-cli';

async function globalTeardown() {
  console.log('Cleaning up E2E test environment...');

  // Cleanup test data if configured
  if (process.env.TEST_DATA_CLEANUP === 'true') {
    try {
      console.log('Cleaning up test data...');
      runBackendFlaskCommand('cleanup-test-data', 'TEST_DATA_CLEANUP');
      console.log('Test data cleaned up successfully');
    } catch (error) {
      console.warn('Could not cleanup test data:', error);
    }
  } else {
    console.log('Keeping test data (TEST_DATA_CLEANUP != true)');
  }
}

export default globalTeardown;
