import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';
import router from '../../../src/router';

const SRC = resolve(__dirname, '../../../src');

/**
 * S52.7 — the permission-gated "Manage API" page + nav item.
 */
describe('router: /dashboard/api-keys (Manage API)', () => {
  it('requires auth and the manage_api user permission', () => {
    const route = router.resolve('/dashboard/api-keys');
    expect(route.name).toBe('manage-api');
    expect(route.meta.requiresAuth).toBe(true);
    expect(route.meta.requiredUserPermission).toBe('manage_api');
  });
});

describe('UserLayout: Manage API nav item', () => {
  const layout = readFileSync(resolve(SRC, 'layouts/UserLayout.vue'), 'utf8');

  it('renders a permission-gated Manage API link immediately before Profile', () => {
    const manageIndex = layout.indexOf("to=\"/dashboard/api-keys\"");
    const profileIndex = layout.indexOf("to=\"/dashboard/profile\"");
    expect(manageIndex).toBeGreaterThan(-1);
    expect(profileIndex).toBeGreaterThan(-1);
    // Manage-API link appears before the Profile link in the dropdown.
    expect(manageIndex).toBeLessThan(profileIndex);
  });

  it('gates the Manage API link on the manage_api permission', () => {
    expect(layout).toMatch(/v-if="hasUserPermission\('manage_api'\)"/);
    expect(layout).toMatch(/\$t\('nav\.manage_api'\)/);
  });
});
