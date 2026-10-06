/**
 * S152-11 — pure helpers shared by the frontend-mode e2e specs. No Playwright
 * import, so vitest unit-tests them (vue/tests/unit/frontend-mode-contract.spec.ts).
 */

export type FrontendMode = 'vue' | 'theme';

const FRONTEND_MODES: readonly FrontendMode[] = ['vue', 'theme'];

/** fe-user core (e.g. `/login`) — always enabled; matches the coverage file's owner. */
export const CORE_OWNER = 'core';

/** The mode a run asserts: `E2E_FRONTEND_MODE`, default `vue` (mirrors the backend switch). */
export function readFrontendMode(rawValue: string | undefined): FrontendMode {
  const normalised = (rawValue ?? '').trim().toLowerCase();
  if (normalised === '') return 'vue';
  if ((FRONTEND_MODES as readonly string[]).includes(normalised)) {
    return normalised as FrontendMode;
  }
  throw new Error(`E2E_FRONTEND_MODE must be one of ${FRONTEND_MODES.join(', ')}; got '${rawValue}'`);
}

export interface FeUserPluginManifest {
  plugins?: Record<string, { enabled?: boolean }>;
}

/** Names of the plugins the stack's fe-user manifest enables, plus fe-user core. */
export function enabledFeUserPlugins(manifest: FeUserPluginManifest): Set<string> {
  const enabledNames = Object.entries(manifest.plugins ?? {})
    .filter(([, entry]) => entry.enabled === true)
    .map(([pluginName]) => pluginName);
  return new Set([...enabledNames, CORE_OWNER]);
}

export interface CoverageEntry {
  plugin: string;
  path: string;
  sample: string;
}

export interface PendingEntry {
  plugin: string;
  path: string;
}

export interface ThemeCoveragePlan {
  /** Enabled, not pending: must carry `<meta name="vbwd-frontend" content="theme">`. */
  mustBeThemed: CoverageEntry[];
  /** Enabled and pending (S153): must NOT be themed yet — a themed one must leave the file. */
  mustNotBeThemedYet: CoverageEntry[];
}

/** D11: split the coverage samples of the enabled plugins by `theme-coverage-pending.json`. */
export function planThemeCoverage(
  coverage: CoverageEntry[],
  pending: PendingEntry[],
  enabledPlugins: Set<string>,
): ThemeCoveragePlan {
  const pendingKeys = new Set(pending.map((entry) => `${entry.plugin} ${entry.path}`));
  const enabledCoverage = coverage.filter((entry) => enabledPlugins.has(entry.plugin));
  const isPending = (entry: CoverageEntry) => pendingKeys.has(`${entry.plugin} ${entry.path}`);
  return {
    mustBeThemed: enabledCoverage.filter((entry) => !isPending(entry)),
    mustNotBeThemedYet: enabledCoverage.filter(isPending),
  };
}
