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
import { setOperatingCurrency } from 'vbwd-view-component';
import { api } from '@/api';

type PricesDisplayMode = 'netto' | 'brutto';
type PricesModeInDb = 'NETTO' | 'BRUTTO';

interface PublicConfigResponse {
  default_currency: string;
  prices_display_mode: PricesDisplayMode;
  prices_mode_in_db: PricesModeInDb;
  // S99.0b — public projection of the S84 currency catalog, fed to the
  // view-only display-currency switcher (S99.4). All optional for back-compat
  // with older backends that don't yet publish them.
  base_currency?: string;
  active_currencies?: string[];
  currency_rates?: Record<string, string>;
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
  // S99.4 — the public currency catalog (S99.0b). Empty until `/config` loads;
  // the display-currency switcher only appears once >= 2 currencies are active.
  const baseCurrencyRef = ref<string>(FALLBACK_CURRENCY);
  const activeCurrenciesRef = ref<string[]>([]);
  const currencyRatesRef = ref<Record<string, string>>({});
  const loaded = ref(false);

  const defaultCurrency = computed(() => defaultCurrencyRef.value);
  const pricesDisplayMode = computed(() => pricesDisplayModeRef.value);
  const pricesModeInDb = computed(() => pricesModeInDbRef.value);
  const baseCurrency = computed(() => baseCurrencyRef.value);
  const activeCurrencies = computed(() => activeCurrenciesRef.value);
  const currencyRates = computed(() => currencyRatesRef.value);

  async function load(): Promise<void> {
    if (loaded.value) return;
    try {
      const config = (await api.get('/config')) as PublicConfigResponse;
      if (config.default_currency) {
        defaultCurrencyRef.value = config.default_currency;
        // Feed fe-core's process-global operating-currency accessor so every
        // shared formatter (formatMoney default, cart components) renders the
        // billing currency instead of its own literal fallback (S99.2).
        setOperatingCurrency(config.default_currency);
      }
      if (config.prices_display_mode) pricesDisplayModeRef.value = config.prices_display_mode;
      if (config.prices_mode_in_db) pricesModeInDbRef.value = config.prices_mode_in_db;
      // S99.0b currency catalog — back-compat: only adopt the keys when present.
      if (config.base_currency) baseCurrencyRef.value = config.base_currency;
      if (config.active_currencies) activeCurrenciesRef.value = config.active_currencies;
      if (config.currency_rates) currencyRatesRef.value = config.currency_rates;
      loaded.value = true;
    } catch {
      // Keep the baseline; checkout still renders a valid currency.
    }
  }

  return {
    defaultCurrency,
    pricesDisplayMode,
    pricesModeInDb,
    baseCurrency,
    activeCurrencies,
    currencyRates,
    load,
  };
});
