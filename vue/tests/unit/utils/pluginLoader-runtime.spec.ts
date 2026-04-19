/**
 * Unit tests for runtime plugin manifest loading logic.
 *
 * pluginLoader.ts uses Vite-specific features (import.meta.glob, @plugins alias)
 * that cannot run in a pure vitest context. These tests validate the runtime
 * manifest loading logic by testing fetchPluginManifest directly and verifying
 * the integration contract.
 *
 * The actual pluginLoader integration is tested via the existing
 * pluginLoader-named-export.spec.ts and E2E tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchPluginManifest } from 'vbwd-view-component';
import type { PluginManifest, PluginManifestEntry } from 'vbwd-view-component';

describe('Runtime plugin manifest loading (fe-user)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchPluginManifest returns runtime manifest when fetch succeeds', async () => {
    const runtimeManifest: PluginManifest = {
      plugins: {
        'runtime-plugin': { enabled: true, version: '2.0.0', source: 'local' },
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(runtimeManifest),
    } as Response);

    const result = await fetchPluginManifest('/plugins.json');

    expect(result).toEqual(runtimeManifest);
    expect(result.plugins['runtime-plugin'].enabled).toBe(true);
  });

  it('fetchPluginManifest returns fallback when fetch fails', async () => {
    const buildTimeFallback: PluginManifest = {
      plugins: {
        'build-time-plugin': { enabled: true, version: '1.0.0', source: 'local' },
      },
    };

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await fetchPluginManifest('/plugins.json', buildTimeFallback);

    expect(result).toEqual(buildTimeFallback);
  });

  it('runtime manifest overrides build-time manifest', async () => {
    const buildTimeFallback: PluginManifest = {
      plugins: {
        taro: { enabled: true, version: '1.0.0', source: 'local' },
        booking: { enabled: true, version: '1.0.0', source: 'local' },
      },
    };

    const runtimeManifest: PluginManifest = {
      plugins: {
        taro: { enabled: true, version: '1.0.0', source: 'local' },
        booking: { enabled: false, version: '1.0.0', source: 'local' },
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(runtimeManifest),
    } as Response);

    const result = await fetchPluginManifest('/plugins.json', buildTimeFallback);

    // Runtime manifest disables booking, build-time had it enabled
    expect(result.plugins['booking'].enabled).toBe(false);
    expect(result.plugins['taro'].enabled).toBe(true);
  });

  it('enabled plugin names are derived from runtime manifest', async () => {
    const manifest: PluginManifest = {
      plugins: {
        'plugin-a': { enabled: true, version: '1.0.0', source: 'local' },
        'plugin-b': { enabled: false, version: '1.0.0', source: 'local' },
        'plugin-c': { enabled: true, version: '1.0.0', source: 'local' },
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(manifest),
    } as Response);

    const result = await fetchPluginManifest('/plugins.json');

    const enabledNames = new Set(
      Object.entries(result.plugins)
        .filter(([, config]) => (config as PluginManifestEntry).enabled)
        .map(([name]) => name),
    );

    expect(enabledNames).toEqual(new Set(['plugin-a', 'plugin-c']));
    expect(enabledNames.has('plugin-b')).toBe(false);
  });

  it('empty runtime manifest results in no enabled plugins', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ plugins: {} }),
    } as Response);

    const result = await fetchPluginManifest('/plugins.json');

    expect(Object.keys(result.plugins)).toHaveLength(0);
  });

  it('returns empty manifest when both fetch fails and no fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await fetchPluginManifest('/plugins.json');

    expect(result).toEqual({ plugins: {} });
  });
});
