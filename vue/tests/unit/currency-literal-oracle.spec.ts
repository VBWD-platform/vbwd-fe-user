/**
 * S99.5 — regression oracle: no hard-coded currency *fallback* literals in the
 * storefront source.
 *
 * The S99 contract: there is ONE billing currency (the backend `default_currency`
 * setting, surfaced as `appConfig.defaultCurrency` and as fe-core's
 * `getOperatingCurrency()`), and a separate fe-user view-only display currency.
 * No source file may hard-code a `'USD'` / `'EUR'` fallback for a money render —
 * that was the historical USD/EUR split that rendered the same price with two
 * different symbols (token lines in `$` while the Total showed `€`).
 *
 * This oracle scans the fe-user source for the *fallback* shape
 *   `... || 'USD'`   /   `... || "EUR"`   (etc.)
 * and fails on any occurrence. It deliberately targets ONLY the `|| '<CUR>'`
 * fallback — the exact offender class — so the allowed literals are untouched:
 *   - a `<select>` / `<option value="EUR">` currency picker (a user choice),
 *   - a form's initial state default (`currency: 'EUR'` in a reactive form),
 *   - a `ref('EUR')` holding the user's currently-selected currency.
 * Those never use `|| '<CUR>'`.
 *
 * Locales, tests, dist and node_modules are excluded.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CURRENCY_CODES = 'USD|EUR|GBP|RUB|THB|MXN|KRW|JPY|CHF';
const FALLBACK_PATTERN = new RegExp(`\\|\\|\\s*['"](${CURRENCY_CODES})['"]`);

// Scan the storefront app + the bundled plugins.
const SCAN_ROOTS = [
  resolve(__dirname, '../../src'),
  resolve(__dirname, '../../../plugins'),
];

const SKIP_DIR = /(?:^|\/)(node_modules|dist|tests|__tests__|locales|\.git)(?:\/|$)/;
const SOURCE_EXT = /\.(ts|vue)$/;

function sourceFiles(dir: string): string[] {
  let found: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found; // a plugin dir may be absent in a given checkout
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (SKIP_DIR.test(full)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      found = found.concat(sourceFiles(full));
    } else if (SOURCE_EXT.test(entry) && !entry.endsWith('.spec.ts')) {
      found.push(full);
    }
  }
  return found;
}

function offences(): string[] {
  const hits: string[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of sourceFiles(root)) {
      const lines = readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, index) => {
        if (FALLBACK_PATTERN.test(line)) {
          hits.push(`${file}:${index + 1}  ${line.trim()}`);
        }
      });
    }
  }
  return hits;
}

describe('S99 currency-literal oracle (fe-user)', () => {
  it('has no hard-coded currency fallback (|| "USD"/"EUR") in storefront source', () => {
    const found = offences();
    expect(
      found,
      'Hard-coded currency fallback(s) found — resolve from the value\'s own ' +
        'currency or appConfig.defaultCurrency / getOperatingCurrency() instead:\n' +
        found.join('\n'),
    ).toEqual([]);
  });

  it('the oracle actually fires on the offender shape (self-check)', () => {
    expect(FALLBACK_PATTERN.test("currency: item.currency || 'USD'")).toBe(true);
    // ...and leaves the allowed literals (select option / form default / ref) alone.
    expect(FALLBACK_PATTERN.test("<option value=\"EUR\">EUR</option>")).toBe(false);
    expect(FALLBACK_PATTERN.test("const form = ref({ currency: 'EUR' })")).toBe(false);
    expect(FALLBACK_PATTERN.test("const selectedCurrency = ref('EUR')")).toBe(false);
  });
});
