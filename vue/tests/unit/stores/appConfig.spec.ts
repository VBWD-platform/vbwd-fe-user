import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAppConfigStore } from '../../../src/stores/appConfig';

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

// Spy on the fe-core operating-currency accessor so we can assert appConfig
// feeds it the configured default_currency (S99.2 wiring).
vi.mock('vbwd-view-component', () => ({
  setOperatingCurrency: vi.fn(),
}));

import { api } from '@/api';
import { setOperatingCurrency } from 'vbwd-view-component';

/**
 * S93 — the app-config store is the fe's single source of truth for the global
 * operating currency (and the price-display modes). It reads the public
 * `/config` endpoint once and exposes `defaultCurrency`.
 */
describe('useAppConfigStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('defaultCurrency falls back to EUR before the config is loaded', () => {
    const store = useAppConfigStore();
    expect(store.defaultCurrency).toBe('EUR');
  });

  it('load() fetches /config and exposes the global currency + modes', async () => {
    vi.mocked(api.get).mockResolvedValue({
      default_currency: 'USD',
      prices_display_mode: 'netto',
      prices_mode_in_db: 'BRUTTO',
    });

    const store = useAppConfigStore();
    await store.load();

    expect(api.get).toHaveBeenCalledWith('/config');
    expect(store.defaultCurrency).toBe('USD');
    expect(store.pricesDisplayMode).toBe('netto');
    expect(store.pricesModeInDb).toBe('BRUTTO');
  });

  it('load() fetches at most once (cached)', async () => {
    vi.mocked(api.get).mockResolvedValue({
      default_currency: 'EUR',
      prices_display_mode: 'brutto',
      prices_mode_in_db: 'NETTO',
    });

    const store = useAppConfigStore();
    await store.load();
    await store.load();

    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('keeps the EUR default when the fetch fails (never breaks checkout)', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network'));

    const store = useAppConfigStore();
    await store.load();

    expect(store.defaultCurrency).toBe('EUR');
  });

  // S99.2 — appConfig is the fe-user feed for fe-core's process-global operating
  // currency accessor: once /config loads, the shared accessor must match it so
  // every fe-core formatter (formatMoney default) renders the billing currency.
  it('load() feeds default_currency to fe-core setOperatingCurrency', async () => {
    vi.mocked(api.get).mockResolvedValue({
      default_currency: 'USD',
      prices_display_mode: 'brutto',
      prices_mode_in_db: 'NETTO',
    });

    const store = useAppConfigStore();
    await store.load();

    expect(setOperatingCurrency).toHaveBeenCalledWith('USD');
  });

  // S99.4 — appConfig is also the fe-user feed for the view-only display-currency
  // switcher: /config now publishes the base currency, the active set, and the
  // per-currency cross-rates (S99.0b). appConfig exposes them so the
  // displayCurrency store can convert at the render boundary.
  it('exposes empty currency catalog defaults before the config is loaded', () => {
    const store = useAppConfigStore();
    expect(store.baseCurrency).toBe('EUR');
    expect(store.activeCurrencies).toEqual([]);
    expect(store.currencyRates).toEqual({});
  });

  it('load() exposes base_currency, active_currencies and currency_rates', async () => {
    vi.mocked(api.get).mockResolvedValue({
      default_currency: 'EUR',
      prices_display_mode: 'brutto',
      prices_mode_in_db: 'NETTO',
      base_currency: 'EUR',
      active_currencies: ['EUR', 'USD'],
      currency_rates: { EUR: '1', USD: '1.1' },
    });

    const store = useAppConfigStore();
    await store.load();

    expect(store.baseCurrency).toBe('EUR');
    expect(store.activeCurrencies).toEqual(['EUR', 'USD']);
    expect(store.currencyRates).toEqual({ EUR: '1', USD: '1.1' });
  });

  it('keeps catalog defaults when the new keys are absent (back-compat)', async () => {
    vi.mocked(api.get).mockResolvedValue({
      default_currency: 'EUR',
      prices_display_mode: 'brutto',
      prices_mode_in_db: 'NETTO',
    });

    const store = useAppConfigStore();
    await store.load();

    expect(store.activeCurrencies).toEqual([]);
    expect(store.currencyRates).toEqual({});
  });
});
