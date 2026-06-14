import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAppConfigStore } from '../../../src/stores/appConfig';

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '@/api';

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
});
