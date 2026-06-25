/**
 * Sprint 10 (FE) — Subscription/shop agnosticism oracle for the core user app.
 *
 * After Sprint 07 (nav/i18n) + Sprint 10 (checkout), core fe-user owns no
 * subscription or shop business logic. The checkout store is generic and drives
 * plugin-registered CheckoutSources; subscription/shop state + endpoints live in
 * their plugins.
 *
 * Sprint 11 closed the invoice-DTO part of the former D4 residual: core invoice
 * DTOs carry NO `subscription_*` / `tarif_plan_id` fields (the backend invoice
 * no longer FKs subscription/plan). Remaining D4 residuals (decision-locked —
 * NOT violations): tokens stay core, so the core router may host
 * `/dashboard/tokens` + `/dashboard/subscription/invoices` with `subscription.*`
 * permission names (a backend permission namespace, optional S8).
 *
 * If this test fails, core re-acquired a subscription/shop coupling — move it to
 * the owning plugin (register a CheckoutSource) instead of relaxing assertions.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const SRC = resolve(__dirname, '../../src');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|vue)$/.test(entry)) out.push(full);
  }
  return out;
}
const allCoreFiles = walk(SRC);

describe('core fe-user checkout is plugin-agnostic (Sprint 10 oracle)', () => {
  it('exposes the checkout source registry', () => {
    expect(existsSync(join(SRC, 'registries/checkoutSourceRegistry.ts'))).toBe(true);
    expect(read('registries/checkoutSourceRegistry.ts')).toContain('checkoutSourceRegistry');
  });

  it('core checkout store owns no subscription or shop logic', () => {
    const store = read('stores/checkout.ts');
    // Subscription endpoints / state
    expect(store).not.toMatch(/\/user\/checkout/);
    expect(store).not.toMatch(/\/tarif-plans/);
    expect(store).not.toMatch(/loadPlan/);
    expect(store).not.toMatch(/selectedBundles/);
    expect(store).not.toMatch(/selectedAddons/);
    expect(store).not.toMatch(/loadOptions/);
    // Shop endpoints / state
    expect(store).not.toMatch(/\/shop\/cart\/checkout/);
    expect(store).not.toMatch(/loadFromShopCart/);
    expect(store).not.toMatch(/shopItems/);
    expect(store).not.toMatch(/vbwd_shop_cart/);
  });

  it('core checkout store delegates to the registry', () => {
    const store = read('stores/checkout.ts');
    expect(store).toContain('checkoutSourceRegistry');
    expect(store).toContain('loadForContext');
  });

  it('core invoice store carries no subscription/plan metadata (Sprint 11)', () => {
    const store = read('stores/invoices.ts');
    expect(store).not.toContain('subscription_id');
    expect(store).not.toContain('tarif_plan_id');
  });

  it('no core file imports a subscription / shop / checkout plugin store', () => {
    // Scoped to Sprint 10 domains. The generic plugin loader
    // (`import.meta.glob('plugins/*/index.ts')`) and core registries under
    // `@/plugins/*` are not couplings; an unrelated tarot re-export is out of
    // scope. We forbid only importing a subscription/shop/checkout plugin's
    // internals into core.
    const offenders: string[] = [];
    for (const file of allCoreFiles) {
      const text = readFileSync(file, 'utf8');
      if (
        /from\s+['"][^'"]*plugins\/(subscription|shop|checkout)\//.test(text) ||
        /from\s+['"][^'"]*subscription\/stores\//.test(text) ||
        /from\s+['"][^'"]*shop\/stores\//.test(text)
      ) {
        offenders.push(file.replace(SRC, 'src'));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('core router hosts no plan/checkout/subscription-management routes', () => {
    const router = read('router/index.ts');
    // These belong to the subscription / checkout plugins.
    expect(router).not.toMatch(/\/dashboard\/plans/);
    expect(router).not.toMatch(/\/dashboard\/add-ons/);
    expect(router).not.toMatch(/\/checkout/);
    expect(router).not.toMatch(/tarif-plans/);
    // D4 residual: /dashboard/subscription/invoices + /dashboard/tokens are
    // allowed (invoices + tokens stay core), so we do NOT forbid the substring
    // "subscription" wholesale here.
  });
});
