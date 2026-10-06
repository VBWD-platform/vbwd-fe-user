/**
 * S152-01b — theme route-coverage oracle (decisions D11 + D7).
 *
 * Installs EVERY fe-user plugin the way the app does (real `pluginLoader` +
 * `PluginRegistry.installAll` + the real core router), regardless of var
 * enablement — the e2e `theme-coverage.spec.ts` applies enablement later. It
 * collects each public route (path pattern + owning plugin; core routes are
 * owned by "core") and compares that set against the checked-in
 * `vue/tests/e2e/theme-route-coverage.json`.
 *
 * Excluded: routes under the SPA-only prefixes (D7, segment-aware), redirect-only
 * routes, and the whole tuktuk plugin. Ownership is deterministic: a later
 * registration wins, exactly like the router (a plugin route named `home`
 * replaces the core home, so `/` is owned by cms).
 *
 * Regenerate after adding/removing a public route (existing samples are kept;
 * new entries get a placeholder sample to replace with a seeded URL):
 *
 *   UPDATE_THEME_COVERAGE=1 npx vitest run vue/tests/unit/theme-route-coverage.spec.ts
 *
 * `theme-coverage-pending.json` lists routes whose theme adapter ships in S153.
 * It is hand-curated; every entry must exist in the coverage file.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { PluginRegistry, PlatformSDK } from 'vbwd-view-component';
import type { IPlugin, IPlatformSDK, IRouteConfig, PluginManifest } from 'vbwd-view-component';
import type { RouteRecordNormalized, RouteRecordRaw, Router } from 'vue-router';
import repositoryManifest from '../../../plugins/plugins.json';

const SPA_ONLY_PREFIXES = ['/dashboard', '/tuktuk'];
const EXCLUDED_PLUGINS = ['tuktuk'];
const CORE_OWNER = 'core';
const CORE_REGISTRATION_INDEX = -1;
const OWNER_META_KEY = '__themeCoverageOwner';
const REGISTRATION_META_KEY = '__themeCoverageRegistrationIndex';
const PLACEHOLDER_PARAM_VALUE = 'sample';
const UPDATE_COMMAND = 'UPDATE_THEME_COVERAGE=1 npx vitest run vue/tests/unit/theme-route-coverage.spec.ts';
const PLUGIN_INSTALL_TIMEOUT_MS = 60000;
const MANIFEST_FILE_NAME = 'plugins.json';

const COVERAGE_FILE = resolve(__dirname, '../e2e/theme-route-coverage.json');
const PENDING_FILE = resolve(__dirname, '../e2e/theme-coverage-pending.json');

// Keys only — the loader below imports the modules; this just lists plugin dirs.
const pluginDirectoryIndexFiles = Object.keys(import.meta.glob('../../../plugins/*/index.ts'));
const pluginDirectoryNames = pluginDirectoryIndexFiles
  .map(indexFile => indexFile.split('/').slice(-2, -1)[0])
  .sort();
const manifestPluginNames = Object.keys((repositoryManifest as PluginManifest).plugins).sort();
// The checked-in coverage describes the FULL plugin set. A partial checkout (the
// host CI clones a subset of the plugin repos) cannot reproduce it, so the oracle
// runs only where every manifest plugin is checked out (the SDK / a full install).
const isFullPluginCheckout = manifestPluginNames.every(name => pluginDirectoryNames.includes(name));

interface CoverageEntry {
  plugin: string;
  path: string;
  sample: string;
}

interface PendingEntry {
  plugin: string;
  path: string;
}

function entryKey(entry: PendingEntry): string {
  return `${entry.plugin} ${entry.path}`;
}

function sortEntries<T extends PendingEntry>(entries: T[]): T[] {
  return [...entries].sort((left, right) => entryKey(left).localeCompare(entryKey(right)));
}

function isUnderSpaOnlyPrefix(path: string): boolean {
  return SPA_ONLY_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

function isRedirectOnly(record: RouteRecordNormalized): boolean {
  return Boolean(record.redirect) && Object.keys(record.components ?? {}).length === 0;
}

function allPluginsEnabledManifest(): PluginManifest {
  const manifest = repositoryManifest as PluginManifest;
  return {
    plugins: Object.fromEntries(
      Object.entries(manifest.plugins).map(([name, entry]) => [name, { ...entry, enabled: true }])
    ),
  };
}

/** Stamps owner + registration order onto a route and its children. */
function tagRoute(route: IRouteConfig, owner: string, registrationIndex: number): IRouteConfig {
  return {
    ...route,
    meta: { ...route.meta, [OWNER_META_KEY]: owner, [REGISTRATION_META_KEY]: registrationIndex },
    children: (route.children as IRouteConfig[] | undefined)?.map(child =>
      tagRoute(child, owner, registrationIndex)
    ),
  };
}

/**
 * Wraps each plugin's install so routes it adds are attributed to it, then
 * installs in the registry's own (dependency) order — same as the factory.
 */
async function collectPluginRoutes(plugins: IPlugin[]): Promise<IRouteConfig[]> {
  const registry = new PluginRegistry();
  const sdk = new PlatformSDK();
  const ownedRoutes: IRouteConfig[] = [];

  for (const plugin of plugins) {
    registry.register({
      ...plugin,
      install: async (installSdk: IPlatformSDK) => {
        const routeCountBefore = installSdk.getRoutes().length;
        await plugin.install?.(installSdk);
        for (const route of installSdk.getRoutes().slice(routeCountBefore)) {
          ownedRoutes.push(tagRoute(route, plugin.name, ownedRoutes.length));
        }
      },
    });
  }
  await registry.installAll(sdk);
  return ownedRoutes;
}

function ownerOf(record: RouteRecordNormalized): string {
  return (record.meta[OWNER_META_KEY] as string | undefined) ?? CORE_OWNER;
}

function registrationIndexOf(record: RouteRecordNormalized): number {
  return (record.meta[REGISTRATION_META_KEY] as number | undefined) ?? CORE_REGISTRATION_INDEX;
}

/** One entry per path pattern; on a duplicate pattern the later registration wins. */
function publicRouteOwners(router: Router): Map<string, string> {
  const ownerByPath = new Map<string, string>();
  const recordsInRegistrationOrder = [...router.getRoutes()].sort(
    (left, right) => registrationIndexOf(left) - registrationIndexOf(right)
  );
  for (const record of recordsInRegistrationOrder) {
    const owner = ownerOf(record);
    if (EXCLUDED_PLUGINS.includes(owner) || isUnderSpaOnlyPrefix(record.path) || isRedirectOnly(record)) {
      continue;
    }
    ownerByPath.set(record.path, owner);
  }
  return ownerByPath;
}

function placeholderSample(pathPattern: string): string {
  const concretePath = pathPattern.replace(/:[A-Za-z_]+(\([^)]*\))?[?*+]?/g, PLACEHOLDER_PARAM_VALUE);
  return concretePath === '' ? '/' : concretePath;
}

function readJsonFile<T>(filePath: string): T[] {
  return existsSync(filePath) ? (JSON.parse(readFileSync(filePath, 'utf8')) as T[]) : [];
}

function sampleMatchesPattern(router: Router, entry: CoverageEntry): boolean {
  const resolved = router.resolve(entry.sample);
  const leafRecord = resolved.matched[resolved.matched.length - 1];
  return leafRecord?.path === entry.path;
}

describe.skipIf(!isFullPluginCheckout)('S152 D11 — theme route-coverage oracle', () => {
  let router: Router;
  let expectedEntries: PendingEntry[];
  let checkedInEntries: CoverageEntry[];
  let loadedPluginCount = 0;

  beforeAll(async () => {
    // Transport-level stub: only the runtime manifest answers; every other
    // request fails like an offline backend, so plugins use their defaults.
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).endsWith(MANIFEST_FILE_NAME)) {
        return { ok: true, json: () => Promise.resolve(allPluginsEnabledManifest()) };
      }
      throw new TypeError(`offline: ${String(url)}`);
    }));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { getEnabledPlugins } = await import('@/utils/pluginLoader');
    router = (await import('@/router')).default;
    const plugins = await getEnabledPlugins();
    loadedPluginCount = plugins.length;
    for (const route of await collectPluginRoutes(plugins)) {
      router.addRoute(route as RouteRecordRaw);
    }

    expectedEntries = sortEntries(
      [...publicRouteOwners(router)].map(([path, plugin]) => ({ plugin, path }))
    );
    checkedInEntries = readJsonFile<CoverageEntry>(COVERAGE_FILE);

    if (process.env.UPDATE_THEME_COVERAGE) {
      const existingSamples = new Map(checkedInEntries.map(entry => [entryKey(entry), entry.sample]));
      checkedInEntries = expectedEntries.map(entry => ({
        ...entry,
        sample: existingSamples.get(entryKey(entry)) ?? placeholderSample(entry.path),
      }));
      writeFileSync(COVERAGE_FILE, `${JSON.stringify(checkedInEntries, null, 2)}\n`);
    }
  }, PLUGIN_INSTALL_TIMEOUT_MS);

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('SPA-only prefixes are segment-aware (D7)', () => {
    expect(isUnderSpaOnlyPrefix('/dashboard')).toBe(true);
    expect(isUnderSpaOnlyPrefix('/dashboard/plans')).toBe(true);
    expect(isUnderSpaOnlyPrefix('/tuktuk/chat')).toBe(true);
    expect(isUnderSpaOnlyPrefix('/dashboards-x')).toBe(false);
  });

  it('every plugin directory is listed in the repository manifest and loads', () => {
    expect(pluginDirectoryNames).toEqual(manifestPluginNames);
    expect(loadedPluginCount).toBe(manifestPluginNames.length);
  });

  it(`checked-in coverage file is up to date (regenerate: ${UPDATE_COMMAND})`, () => {
    const checkedInKeys = sortEntries(checkedInEntries).map(entryKey);
    expect(checkedInKeys).toEqual(expectedEntries.map(entryKey));
  });

  it('never lists SPA-only, redirect-only or tuktuk routes', () => {
    for (const entry of checkedInEntries) {
      expect(isUnderSpaOnlyPrefix(entry.path), entry.path).toBe(false);
      expect(EXCLUDED_PLUGINS, entry.path).not.toContain(entry.plugin);
    }
  });

  it('every sample URL resolves to its own route pattern', () => {
    const mismatched = checkedInEntries
      .filter(entry => !sampleMatchesPattern(router, entry))
      .map(entry => `${entry.sample} -> expected ${entry.path}`);
    expect(mismatched).toEqual([]);
  });

  it('every pending (S153) entry exists in the coverage file', () => {
    expect(existsSync(PENDING_FILE)).toBe(true);
    const coverageKeys = new Set(checkedInEntries.map(entryKey));
    const orphans = readJsonFile<PendingEntry>(PENDING_FILE)
      .map(entryKey)
      .filter(key => !coverageKeys.has(key));
    expect(orphans).toEqual([]);
  });
});
