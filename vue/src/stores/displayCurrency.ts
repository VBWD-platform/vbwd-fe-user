/**
 * Display-currency store — the fe-user view-only currency switch (S99.4).
 *
 * BILLING currency (= the operating / `default_currency` setting) is what money
 * is denominated in: invoices are created in it, checkout charges in it. This
 * store NEVER changes that. It only lets the storefront user pick a currency to
 * SEE prices in; the chosen currency converts already-computed billing amounts
 * via the published cross-rate (S99.0b) purely at the render boundary (D8). The
 * choice is persisted in localStorage (D7) and falls back to the billing
 * currency if it is later deactivated.
 *
 * Resolution (D3): user-selected display currency → billing currency. The
 * conversion never feeds back into the Price VO, the checkout payload, or an
 * invoice (the core hard rule).
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAppConfigStore } from '@/stores/appConfig';

// Mirrors the S93 cart/config persistence convention.
const STORAGE_KEY = 'vbwd_display_currency';
// The switcher only makes sense when the operator offers a choice.
const MIN_CURRENCIES_FOR_SWITCHER = 2;

function readPersistedChoice(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistChoice(code: string | null): void {
  try {
    if (code) localStorage.setItem(STORAGE_KEY, code);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Persistence is best-effort; the in-memory choice still works this session.
  }
}

export const useDisplayCurrencyStore = defineStore('display-currency', () => {
  const appConfig = useAppConfigStore();
  // The user's raw choice (may be stale if the operator later deactivated it);
  // `code` resolves it against the live active set.
  const selected = ref<string | null>(readPersistedChoice());

  /** The billing (operating) currency — the last-resort display currency. */
  const billingCurrency = computed(() => appConfig.defaultCurrency);

  /**
   * The effective display currency: the chosen one when it is still active,
   * else the billing currency (D7 fallback for a deactivated currency).
   */
  const code = computed<string>(() => {
    const choice = selected.value;
    if (choice && appConfig.activeCurrencies.includes(choice)) {
      return choice;
    }
    return billingCurrency.value;
  });

  /** True when the display currency differs from billing (conversion applies). */
  const isConverting = computed(() => code.value !== billingCurrency.value);

  /** The active currencies offered to the user, in catalog order. */
  const availableCurrencies = computed<string[]>(() => appConfig.activeCurrencies);

  /** Whether the switcher should render at all (>= 2 active currencies). */
  const hasSwitcher = computed(
    () => availableCurrencies.value.length >= MIN_CURRENCIES_FOR_SWITCHER,
  );

  /**
   * The cross-rate that scales an amount FROM the billing currency TO the
   * current display currency: rate(billing→display) = rate[display]/rate[billing]
   * where each `rate[x]` is x's published exchange rate to the base currency.
   * Identity (1) when display == billing or a rate is missing.
   */
  const crossRate = computed<number>(() => {
    if (!isConverting.value) return 1;
    const rates = appConfig.currencyRates;
    const billingRate = Number(rates[billingCurrency.value]);
    const displayRate = Number(rates[code.value]);
    if (!billingRate || !displayRate) return 1;
    return displayRate / billingRate;
  });

  /** Convert a billing-currency amount into the display currency (D8). */
  function convert(amountInBilling: number): number {
    return amountInBilling * crossRate.value;
  }

  /** Set (and persist) the user's display-currency choice (D7). */
  function setCurrency(currencyCode: string): void {
    selected.value = currencyCode;
    persistChoice(currencyCode);
  }

  return {
    code,
    billingCurrency,
    isConverting,
    availableCurrencies,
    hasSwitcher,
    crossRate,
    convert,
    setCurrency,
  };
});
