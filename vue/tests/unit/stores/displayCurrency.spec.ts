/**
 * S99.4 — view-only display-currency store.
 *
 * The storefront user may pick a currency to SEE prices in. The choice is:
 *   - defaulted to the billing currency (appConfig.defaultCurrency),
 *   - persisted in localStorage (D7),
 *   - reset to billing if the chosen currency is later deactivated (D7),
 *   - applied only at the render boundary via `convert()` (D8) — it never
 *     reaches the checkout payload or an invoice (the core hard rule).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/api', () => ({
  api: { get: vi.fn() },
}));
vi.mock('vbwd-view-component', () => ({
  setOperatingCurrency: vi.fn(),
}));

import { api } from '@/api';
import { useAppConfigStore } from '@/stores/appConfig';
import { useDisplayCurrencyStore } from '@/stores/displayCurrency';

const STORAGE_KEY = 'vbwd_display_currency';

/** Seed appConfig as if `/config` had already loaded with the given catalog. */
async function seedConfig(opts: {
  billing: string;
  base: string;
  active: string[];
  rates: Record<string, string>;
}): Promise<void> {
  vi.mocked(api.get).mockResolvedValue({
    default_currency: opts.billing,
    prices_display_mode: 'brutto',
    prices_mode_in_db: 'NETTO',
    base_currency: opts.base,
    active_currencies: opts.active,
    currency_rates: opts.rates,
  });
  await useAppConfigStore().load();
}

describe('useDisplayCurrencyStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('defaults the display currency to the billing currency', async () => {
    await seedConfig({ billing: 'EUR', base: 'EUR', active: ['EUR', 'USD'], rates: { EUR: '1', USD: '1.1' } });
    const store = useDisplayCurrencyStore();
    expect(store.code).toBe('EUR');
  });

  it('convert() is identity when display == billing', async () => {
    await seedConfig({ billing: 'EUR', base: 'EUR', active: ['EUR', 'USD'], rates: { EUR: '1', USD: '1.1' } });
    const store = useDisplayCurrencyStore();
    expect(store.convert(100)).toBe(100);
  });

  it('switching the display currency converts via the cross-rate', async () => {
    await seedConfig({ billing: 'EUR', base: 'EUR', active: ['EUR', 'USD'], rates: { EUR: '1', USD: '1.1' } });
    const store = useDisplayCurrencyStore();
    store.setCurrency('USD');
    expect(store.code).toBe('USD');
    // billing EUR → base EUR → display USD: rate = USD/EUR = 1.1
    expect(store.convert(100)).toBeCloseTo(110, 6);
  });

  it('converts via a non-base billing currency (cross-rate billing→base→display)', async () => {
    // billing USD, base EUR, display GBP: rate = GBP/USD = 0.8 / 1.1
    await seedConfig({
      billing: 'USD',
      base: 'EUR',
      active: ['EUR', 'USD', 'GBP'],
      rates: { EUR: '1', USD: '1.1', GBP: '0.8' },
    });
    const store = useDisplayCurrencyStore();
    store.setCurrency('GBP');
    expect(store.convert(110)).toBeCloseTo(80, 6);
  });

  it('persists the choice to localStorage', async () => {
    await seedConfig({ billing: 'EUR', base: 'EUR', active: ['EUR', 'USD'], rates: { EUR: '1', USD: '1.1' } });
    const store = useDisplayCurrencyStore();
    store.setCurrency('USD');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('USD');
  });

  it('restores the persisted choice on init', async () => {
    localStorage.setItem(STORAGE_KEY, 'USD');
    await seedConfig({ billing: 'EUR', base: 'EUR', active: ['EUR', 'USD'], rates: { EUR: '1', USD: '1.1' } });
    const store = useDisplayCurrencyStore();
    expect(store.code).toBe('USD');
  });

  it('falls back to billing when the persisted choice is no longer active', async () => {
    localStorage.setItem(STORAGE_KEY, 'GBP');
    await seedConfig({ billing: 'EUR', base: 'EUR', active: ['EUR', 'USD'], rates: { EUR: '1', USD: '1.1' } });
    const store = useDisplayCurrencyStore();
    // GBP deactivated → display reverts to billing EUR, identity conversion.
    expect(store.code).toBe('EUR');
    expect(store.convert(100)).toBe(100);
  });

  it('isConverting is true only when display differs from billing', async () => {
    await seedConfig({ billing: 'EUR', base: 'EUR', active: ['EUR', 'USD'], rates: { EUR: '1', USD: '1.1' } });
    const store = useDisplayCurrencyStore();
    expect(store.isConverting).toBe(false);
    store.setCurrency('USD');
    expect(store.isConverting).toBe(true);
  });

  it('hasSwitcher is true only with >= 2 active currencies', async () => {
    await seedConfig({ billing: 'EUR', base: 'EUR', active: ['EUR'], rates: { EUR: '1' } });
    expect(useDisplayCurrencyStore().hasSwitcher).toBe(false);
  });

  it('hasSwitcher is true with two active currencies', async () => {
    await seedConfig({ billing: 'EUR', base: 'EUR', active: ['EUR', 'USD'], rates: { EUR: '1', USD: '1.1' } });
    expect(useDisplayCurrencyStore().hasSwitcher).toBe(true);
  });
});
