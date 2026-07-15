import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMaintenanceStore } from '../../../src/stores/maintenance';

/**
 * The maintenance store is the fe-user single source of truth for the
 * app-wide "Technical works" state. It flips ON when a CMS API call is
 * license-blocked (HTTP 402) and OFF when CMS is reachable again.
 */
describe('useMaintenanceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('is inactive by default', () => {
    const store = useMaintenanceStore();
    expect(store.active).toBe(false);
  });

  it('activate() flips the maintenance state on', () => {
    const store = useMaintenanceStore();
    store.activate();
    expect(store.active).toBe(true);
  });

  it('clear() flips the maintenance state off again', () => {
    const store = useMaintenanceStore();
    store.activate();
    store.clear();
    expect(store.active).toBe(false);
  });
});
