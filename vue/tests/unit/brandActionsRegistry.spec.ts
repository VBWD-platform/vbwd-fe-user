/**
 * TDD: brandActionsRegistry — a generic, CMS-agnostic seam that lets plugins
 * inject small brand-area actions (e.g. a Home link) into the sidebar logo
 * block. Core reads this registry; it never names any specific plugin.
 *
 * Covers: register/unregister keyed by id, getAll() ordering by `order`
 * (default 100), and dedup by id (re-register replaces).
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { brandActionsRegistry } from '../../src/plugins/brandActionsRegistry';

const StubComponent = { template: '<span />' };

describe('brandActionsRegistry', () => {
  beforeEach(() => {
    brandActionsRegistry.unregister('test-a');
    brandActionsRegistry.unregister('test-b');
    brandActionsRegistry.unregister('test-c');
  });

  it('registers an action and returns it from getAll()', () => {
    brandActionsRegistry.register({ id: 'test-a', component: StubComponent });
    const all = brandActionsRegistry.getAll();
    expect(all.some((action) => action.id === 'test-a')).toBe(true);
  });

  it('unregister removes the action by id', () => {
    brandActionsRegistry.register({ id: 'test-a', component: StubComponent });
    brandActionsRegistry.unregister('test-a');
    const all = brandActionsRegistry.getAll();
    expect(all.some((action) => action.id === 'test-a')).toBe(false);
  });

  it('dedups by id — re-registering the same id replaces, not duplicates', () => {
    brandActionsRegistry.register({ id: 'test-a', component: StubComponent });
    brandActionsRegistry.register({ id: 'test-a', component: StubComponent, order: 5 });
    const matches = brandActionsRegistry.getAll().filter((action) => action.id === 'test-a');
    expect(matches).toHaveLength(1);
    expect(matches[0].order).toBe(5);
  });

  it('getAll() sorts ascending by order (default 100)', () => {
    brandActionsRegistry.register({ id: 'test-a', component: StubComponent, order: 200 });
    brandActionsRegistry.register({ id: 'test-b', component: StubComponent, order: 10 });
    brandActionsRegistry.register({ id: 'test-c', component: StubComponent }); // default 100
    const ordered = brandActionsRegistry
      .getAll()
      .filter((action) => ['test-a', 'test-b', 'test-c'].includes(action.id))
      .map((action) => action.id);
    expect(ordered).toEqual(['test-b', 'test-c', 'test-a']);
  });

  describe('brand href — the optional URL the brand name should link to', () => {
    beforeEach(() => {
      brandActionsRegistry.setBrandHref(null);
    });

    it('getBrandHref() is null by default (no brand link registered)', () => {
      expect(brandActionsRegistry.getBrandHref()).toBeNull();
    });

    it('setBrandHref() then getBrandHref() round-trips the URL', () => {
      brandActionsRegistry.setBrandHref('/?public_home=1');
      expect(brandActionsRegistry.getBrandHref()).toBe('/?public_home=1');
    });

    it('setBrandHref(null) resets the brand href back to null', () => {
      brandActionsRegistry.setBrandHref('/?public_home=1');
      brandActionsRegistry.setBrandHref(null);
      expect(brandActionsRegistry.getBrandHref()).toBeNull();
    });
  });
});
