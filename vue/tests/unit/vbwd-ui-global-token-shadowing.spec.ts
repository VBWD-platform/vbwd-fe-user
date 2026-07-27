/**
 * Regression oracle — the global `vbwd-ui.css` layer must never shadow a
 * `var(--token, fallback)` used outside it.
 *
 * `vue/src/assets/vbwd-ui.css` is imported globally and UNSCOPED in
 * `vue/src/factory.ts`, so anything it declares in `:root` becomes a document
 * wide value. Many pre-existing components (core, fe-core and plugins) consume
 * `--vbwd-*` names defensively as `var(--vbwd-x, <fallback>)` — some of them
 * chained into the CMS theme, e.g. `var(--vbwd-border, var(--color-border, …))`.
 * The moment the global layer *defines* one of those names, every one of those
 * fallbacks (and theme chains) goes dead and the component silently renders the
 * shared-layer colour instead of its own / the theme's.
 *
 * Therefore: the names declared in the `:root` block of `vbwd-ui.css` are
 * private to that file and MUST be prefixed so they cannot collide. If this
 * test fails, rename the token in `vbwd-ui.css` (and its uses inside that same
 * file) — do NOT edit the consuming components, their fallbacks are the point.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, join, relative } from 'path';

const REPO_ROOT = resolve(__dirname, '../../..');
const GLOBAL_LAYER = resolve(REPO_ROOT, 'vue/src/assets/vbwd-ui.css');

/** Everything the global layer can reach: core app, fe-core library, plugins. */
const SCAN_ROOTS = ['vue/src', 'vbwd-fe-core/src', 'plugins'];
const SCAN_EXTENSIONS = /\.(vue|css|ts|js)$/;
/** Never descend into build output, dependencies or git metadata. */
const PRUNED_DIRECTORIES = new Set(['node_modules', 'dist', '.git', 'coverage']);

function collectFiles(directory: string): string[] {
  const collected: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (PRUNED_DIRECTORIES.has(entry)) continue;
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) collected.push(...collectFiles(fullPath));
    else if (SCAN_EXTENSIONS.test(entry)) collected.push(fullPath);
  }
  return collected;
}

/** Custom properties declared in the `:root { … }` block of the global layer. */
function declaredRootTokens(cssText: string): string[] {
  const rootBlock = /:root\s*\{([^}]*)\}/.exec(cssText);
  if (!rootBlock) return [];
  return [...rootBlock[1].matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]);
}

/** Custom properties consumed as `var(--name, fallback)` in a file. */
function tokensConsumedWithFallback(fileText: string): string[] {
  return [...fileText.matchAll(/var\(\s*(--[\w-]+)\s*,/g)].map((match) => match[1]);
}

describe('vbwd-ui.css global token layer', () => {
  const globalLayerText = readFileSync(GLOBAL_LAYER, 'utf8');
  const globalTokens = declaredRootTokens(globalLayerText);

  it('declares its tokens in a :root block', () => {
    expect(existsSync(GLOBAL_LAYER)).toBe(true);
    expect(globalTokens.length).toBeGreaterThan(0);
  });

  it('shadows no `var(--token, fallback)` used elsewhere in the repo', () => {
    const globalTokenSet = new Set(globalTokens);
    const offenders: string[] = [];

    for (const scanRoot of SCAN_ROOTS) {
      const absoluteRoot = resolve(REPO_ROOT, scanRoot);
      if (!existsSync(absoluteRoot)) continue;
      for (const file of collectFiles(absoluteRoot)) {
        if (file === GLOBAL_LAYER) continue;
        for (const token of tokensConsumedWithFallback(readFileSync(file, 'utf8'))) {
          if (globalTokenSet.has(token)) {
            offenders.push(`${relative(REPO_ROOT, file)}: ${token}`);
          }
        }
      }
    }

    expect([...new Set(offenders)].sort()).toEqual([]);
  });
});
