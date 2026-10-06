/**
 * S152-11 — pure helpers behind the frontend-mode e2e specs
 * (vue/tests/e2e/frontend-mode/). They decide which mode a run asserts and which
 * coverage samples the theme leg must find themed, so they are unit-tested here.
 */
import { describe, it, expect } from 'vitest';
import {
  readFrontendMode,
  enabledFeUserPlugins,
  planThemeCoverage,
  CORE_OWNER,
} from '../e2e/frontend-mode/frontend-mode-contract';

describe('readFrontendMode', () => {
  it('defaults to vue when unset or blank', () => {
    expect(readFrontendMode(undefined)).toBe('vue');
    expect(readFrontendMode('   ')).toBe('vue');
  });

  it('accepts vue and theme, trimmed and case-insensitive', () => {
    expect(readFrontendMode(' Theme ')).toBe('theme');
    expect(readFrontendMode('VUE')).toBe('vue');
  });

  it('refuses any other value instead of silently testing the wrong mode', () => {
    expect(() => readFrontendMode('twig')).toThrow(/E2E_FRONTEND_MODE/);
  });
});

describe('enabledFeUserPlugins', () => {
  it('lists the enabled plugins of the fe-user manifest plus fe-user core', () => {
    const manifest = {
      plugins: {
        shop: { enabled: true },
        ghrm: { enabled: false },
        cms: { enabled: true },
      },
    };

    expect(enabledFeUserPlugins(manifest)).toEqual(new Set(['shop', 'cms', CORE_OWNER]));
  });

  it('treats a manifest without plugins as core only', () => {
    expect(enabledFeUserPlugins({})).toEqual(new Set([CORE_OWNER]));
  });
});

describe('planThemeCoverage', () => {
  const coverage = [
    { plugin: 'shop', path: '/shop', sample: '/shop' },
    { plugin: 'shop', path: '/shop/cart', sample: '/shop/cart' },
    { plugin: 'ghrm', path: '/software', sample: '/software' },
    { plugin: 'landing1', path: '/landing1', sample: '/landing1' },
    { plugin: CORE_OWNER, path: '/login', sample: '/login' },
  ];
  const pending = [
    { plugin: 'shop', path: '/shop/cart' },
    { plugin: 'landing1', path: '/landing1' },
  ];

  it('asserts every enabled, non-pending sample as themed', () => {
    const plan = planThemeCoverage(coverage, pending, new Set(['shop', CORE_OWNER, 'landing1']));

    expect(plan.mustBeThemed.map((entry) => entry.sample)).toEqual(['/shop', '/login']);
  });

  it('asserts enabled pending samples as NOT themed yet, so S153 must drain the file', () => {
    const plan = planThemeCoverage(coverage, pending, new Set(['shop', CORE_OWNER, 'landing1']));

    expect(plan.mustNotBeThemedYet.map((entry) => entry.sample)).toEqual(['/shop/cart', '/landing1']);
  });

  it('ignores routes of plugins the stack has disabled', () => {
    const plan = planThemeCoverage(coverage, pending, new Set([CORE_OWNER]));

    expect(plan.mustBeThemed.map((entry) => entry.sample)).toEqual(['/login']);
    expect(plan.mustNotBeThemedYet).toEqual([]);
  });
});
