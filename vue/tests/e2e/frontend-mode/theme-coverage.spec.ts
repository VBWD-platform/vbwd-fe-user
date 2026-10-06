/**
 * S152-11 spec 2 — the D11 coverage oracle on a running stack. Every public route
 * of every fe-user plugin the stack enables (`theme-route-coverage.json`, kept
 * fresh by the vitest generator) must come back themed, except the routes S153
 * still owns (`theme-coverage-pending.json`) — and those must NOT be themed yet,
 * so the pending file is drained as adapters land.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  enabledFeUserPlugins,
  planThemeCoverage,
  type CoverageEntry,
  type PendingEntry,
} from './frontend-mode-contract';
import { IS_THEME_MODE, THEME_ONLY_REASON, containsThemeMeta, fetchNavigationHtml } from './frontend-mode-support';

function readCoverageFile<T>(fileName: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../${fileName}`, import.meta.url)), 'utf-8')) as T;
}

test.describe('Theme route coverage (D11)', () => {
  test.skip(!IS_THEME_MODE, THEME_ONLY_REASON);

  test('every enabled public route is themed; every pending one is not yet', async ({ request }) => {
    const manifestResponse = await request.get('/plugins.json');
    expect(manifestResponse.ok()).toBe(true);
    const plan = planThemeCoverage(
      readCoverageFile<CoverageEntry[]>('theme-route-coverage.json'),
      readCoverageFile<PendingEntry[]>('theme-coverage-pending.json'),
      enabledFeUserPlugins(await manifestResponse.json()),
    );
    expect(plan.mustBeThemed.length).toBeGreaterThan(0);

    for (const entry of plan.mustBeThemed) {
      const html = await fetchNavigationHtml(request, entry.sample);
      expect.soft(containsThemeMeta(html), `${entry.plugin} ${entry.path} (${entry.sample}) is not themed`).toBe(true);
    }
    for (const entry of plan.mustNotBeThemedYet) {
      const html = await fetchNavigationHtml(request, entry.sample);
      expect
        .soft(containsThemeMeta(html), `${entry.plugin} ${entry.path} is themed: remove it from theme-coverage-pending.json`)
        .toBe(false);
    }
  });
});
