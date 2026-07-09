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
  // S120 — the canonical homepage slug. The `/` route renders this CMS post in
  // place (no client redirect). Optional for back-compat with backends that
  // don't publish it yet; the fe falls back to DEFAULT_HOME_SLUG.
  home_slug?: string;
  // White-label brand name shown in the sidebar logo. Empty/absent when unset;
  // the fe falls back to DEFAULT_SITE_NAME so nothing breaks without backend
  // support.
  site_name?: string;
}

// The platform's documented baseline (DEFAULT_CORE_SETTINGS) — used until the
// real config loads and as the failure fallback so the UI never shows an empty
// currency.
const FALLBACK_CURRENCY = 'EUR';
const FALLBACK_DISPLAY_MODE: PricesDisplayMode = 'brutto';
const FALLBACK_MODE_IN_DB: PricesModeInDb = 'NETTO';

// The canonical homepage slug the `/` route renders when the backend has not
// (yet) published `home_slug`. MUST render the home post — never the legacy
// `/home` bounce target that produced the soft-404 (S120).
const DEFAULT_HOME_SLUG = 'index';

// The display brand name shown in the sidebar logo until (and unless) the
// backend publishes a white-label `site_name`.
const DEFAULT_SITE_NAME = 'VBWD';

export const useAppConfigStore = defineStore('app-config', () => {
  const defaultCurrencyRef = ref<string>(FALLBACK_CURRENCY);
  const pricesDisplayModeRef = ref<PricesDisplayMode>(FALLBACK_DISPLAY_MODE);
  const pricesModeInDbRef = ref<PricesModeInDb>(FALLBACK_MODE_IN_DB);
  // S99.4 — the public currency catalog (S99.0b). Empty until `/config` loads;
  // the display-currency switcher only appears once >= 2 currencies are active.
  const baseCurrencyRef = ref<string>(FALLBACK_CURRENCY);
  const activeCurrenciesRef = ref<string[]>([]);
  const currencyRatesRef = ref<Record<string, string>>({});
  const homeSlugRef = ref<string>(DEFAULT_HOME_SLUG);
  const siteNameRef = ref<string>(DEFAULT_SITE_NAME);
  const loaded = ref(false);

  const defaultCurrency = computed(() => defaultCurrencyRef.value);
  const pricesDisplayMode = computed(() => pricesDisplayModeRef.value);
  const pricesModeInDb = computed(() => pricesModeInDbRef.value);
  const baseCurrency = computed(() => baseCurrencyRef.value);
  const activeCurrencies = computed(() => activeCurrenciesRef.value);
  const currencyRates = computed(() => currencyRatesRef.value);
  const homeSlug = computed(() => homeSlugRef.value);
  const siteName = computed(() => siteNameRef.value);

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
      // Back-compat: adopt home_slug if a future core /config ever publishes it.
      if (config.home_slug) homeSlugRef.value = config.home_slug;
      // White-label brand name — adopt only a non-empty value so the "VBWD"
      // fallback survives an empty/absent site_name.
      if (config.site_name) siteNameRef.value = config.site_name;
      loaded.value = true;
    } catch {
      // Keep the baseline; checkout still renders a valid currency.
    }

    // S120 — home_slug is published on the cms-owned public config (a plugin
    // cannot add fields to the core /config). Fetched independently and
    // best-effort: a cms-config hiccup never affects currency, and a miss keeps
    // the baked `index` default so `/` always renders the home post.
    try {
      const cmsConfig = (await api.get('/cms/config')) as { home_slug?: string };
      if (cmsConfig.home_slug) homeSlugRef.value = cmsConfig.home_slug;
    } catch {
      // Keep DEFAULT_HOME_SLUG.
    }
  }

  return {
    defaultCurrency,
    pricesDisplayMode,
    pricesModeInDb,
    baseCurrency,
    activeCurrencies,
    currencyRates,
    homeSlug,
    siteName,
    load,
  };
});
