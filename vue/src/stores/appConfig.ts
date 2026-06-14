/**
 * App-config store — the fe's single source of truth for the global operating
 * currency and the price-display modes (S93).
 *
 * Reads the public `/config` endpoint once (no auth) and caches it. The
 * `default_currency` core setting (S84) is THE operating currency: checkout
 * uses it everywhere instead of a hardcoded `'USD'` or a per-item currency.
 *
 * Degrades to the EUR baseline if the fetch fails so checkout never renders an
 * empty/undefined currency.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api';

type PricesDisplayMode = 'netto' | 'brutto';
type PricesModeInDb = 'NETTO' | 'BRUTTO';

interface PublicConfigResponse {
  default_currency: string;
  prices_display_mode: PricesDisplayMode;
  prices_mode_in_db: PricesModeInDb;
}

// The platform's documented baseline (DEFAULT_CORE_SETTINGS) — used until the
// real config loads and as the failure fallback so the UI never shows an empty
// currency.
const FALLBACK_CURRENCY = 'EUR';
const FALLBACK_DISPLAY_MODE: PricesDisplayMode = 'brutto';
const FALLBACK_MODE_IN_DB: PricesModeInDb = 'NETTO';

export const useAppConfigStore = defineStore('app-config', () => {
  const defaultCurrencyRef = ref<string>(FALLBACK_CURRENCY);
  const pricesDisplayModeRef = ref<PricesDisplayMode>(FALLBACK_DISPLAY_MODE);
  const pricesModeInDbRef = ref<PricesModeInDb>(FALLBACK_MODE_IN_DB);
  const loaded = ref(false);

  const defaultCurrency = computed(() => defaultCurrencyRef.value);
  const pricesDisplayMode = computed(() => pricesDisplayModeRef.value);
  const pricesModeInDb = computed(() => pricesModeInDbRef.value);

  async function load(): Promise<void> {
    if (loaded.value) return;
    try {
      const config = (await api.get('/config')) as PublicConfigResponse;
      if (config.default_currency) defaultCurrencyRef.value = config.default_currency;
      if (config.prices_display_mode) pricesDisplayModeRef.value = config.prices_display_mode;
      if (config.prices_mode_in_db) pricesModeInDbRef.value = config.prices_mode_in_db;
      loaded.value = true;
    } catch {
      // Keep the baseline; checkout still renders a valid currency.
    }
  }

  return {
    defaultCurrency,
    pricesDisplayMode,
    pricesModeInDb,
    load,
  };
});
