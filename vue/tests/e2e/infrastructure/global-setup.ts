/**
 * Playwright Global Setup
 *
 * Runs before all E2E tests to:
 * 1. Seed test data in the backend database
 * 2. Wait for backend to be ready
 *
 * Environment Variables:
 *   TEST_DATA_SEED: When 'true', seeds test data
 *   API_BASE_URL: Backend URL (default: http://localhost:5000/api/v1)
 */
import { execSync } from 'child_process';

async function globalSetup() {
  console.log('Setting up E2E test environment...');

  // Seed test data in backend if configured
  if (process.env.TEST_DATA_SEED === 'true') {
    try {
      console.log('Seeding test data...');
      execSync(
        'cd ../../../vbwd-backend && TEST_DATA_SEED=true docker-compose exec -T api flask seed-test-data',
        {
          stdio: 'inherit',
          timeout: 30000,
        }
      );
      console.log('Test data seeded successfully');
    } catch (error) {
      console.warn('Could not seed test data:', error);
      // Continue anyway - data may already exist
    }
  }

  // Wait for backend to be ready
  await waitForBackend();

  await ensureTestUserHasDefaultAccessLevel();
}

const DEFAULT_USER_ACCESS_LEVEL_SLUG = 'logged-in';

async function loginThroughApi(apiBase: string, email: string, password: string) {
  const response = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`login failed for ${email}: ${response.status}`);
  }
  return response.json();
}

/**
 * Registration grants every new user the core `logged-in` access level, but the
 * backend test-data seeder creates the test user directly, so a seeded test user
 * holds no user permissions and every permission-guarded /dashboard/* route
 * bounces it. Grant the level through the admin API (idempotent: the backend
 * answers "already assigned" on repeat runs).
 */
async function ensureTestUserHasDefaultAccessLevel(): Promise<void> {
  const apiBase = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';
  try {
    const admin = await loginThroughApi(
      apiBase,
      process.env.ADMIN_EMAIL || 'admin@example.com',
      process.env.ADMIN_PASSWORD || 'AdminPass123@',
    );
    const testUser = await loginThroughApi(
      apiBase,
      process.env.TEST_USER_EMAIL || 'test@example.com',
      process.env.TEST_USER_PASSWORD || 'TestPass123@',
    );
    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token ?? admin.access_token}`,
    };

    const levelsResponse = await fetch(`${apiBase}/admin/access/levels`, { headers: adminHeaders });
    const { levels } = (await levelsResponse.json()) as { levels: { id: string; slug: string }[] };
    const defaultLevel = levels.find((level) => level.slug === DEFAULT_USER_ACCESS_LEVEL_SLUG);
    if (!defaultLevel) {
      console.warn(`Access level '${DEFAULT_USER_ACCESS_LEVEL_SLUG}' not found — is RBAC seeded?`);
      return;
    }

    const assignResponse = await fetch(
      `${apiBase}/admin/access/users/${testUser.user_id}/user-access-levels`,
      { method: 'POST', headers: adminHeaders, body: JSON.stringify({ level_id: defaultLevel.id }) },
    );
    console.log(`Test user '${DEFAULT_USER_ACCESS_LEVEL_SLUG}' access level: ${assignResponse.status}`);
  } catch (error) {
    console.warn('Could not ensure the test user access level:', error);
  }
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
