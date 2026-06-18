/**
 * useDisplayPrice — the single render-boundary helper for the view-only
 * display-currency switch (S99.4, D8). One home (DRY) for the rule:
 *
 *   convert a billing-currency amount by the published cross-rate, then format
 *   it in the display currency via fe-core `formatMoney` (the single rounding
 *   boundary).
 *
 * Storefront price components opt in to this; invoice surfaces do NOT (D5 — an
 * invoice is a legal document in its stored currency). When the display
 * currency equals the billing currency it is exact identity: the amount is
 * formatted in the billing currency exactly as before the switcher existed.
 *
 * Defensive by design (Liskov / disabled path): if no Pinia is active (e.g. a
 * component unit-mounted without a store), it degrades to identity formatting so
 * callers never break.
 */
import { getActivePinia } from 'pinia';
import { formatMoney } from 'vbwd-view-component';
import { useDisplayCurrencyStore } from '@/stores/displayCurrency';

export interface UseDisplayPrice {
  /** True when the display currency differs from billing. */
  readonly isConverting: boolean;
  /** The active display-currency code. */
  readonly displayCurrency: string;
  /**
   * Convert a billing-currency `amount` and format it. When converting, the
   * amount is scaled to the display currency and formatted in it; otherwise it
   * is formatted in `billingCurrency` (or the operating currency if omitted).
   */
  formatInDisplay(amount: number, billingCurrency?: string): string;
  /** Set the user's display-currency choice (used by the switcher). */
  setDisplayCurrency(code: string): void;
}

export function useDisplayPrice(): UseDisplayPrice {
  // Degrade to identity when there is no store context (no active Pinia).
  if (!getActivePinia()) {
    return {
      isConverting: false,
      displayCurrency: '',
      formatInDisplay: (amount: number, billingCurrency?: string) =>
        formatMoney(amount, { currency: billingCurrency }),
      setDisplayCurrency: () => {},
    };
  }

  const store = useDisplayCurrencyStore();

  function formatInDisplay(amount: number, billingCurrency?: string): string {
    if (!store.isConverting) {
      // Identity: format in the explicit currency, else the billing currency
      // (D3 resolve order) — never an empty/undefined currency.
      return formatMoney(amount, { currency: billingCurrency ?? store.billingCurrency });
    }
    return formatMoney(store.convert(amount), { currency: store.code });
  }

  return {
    get isConverting() {
      return store.isConverting;
    },
    get displayCurrency() {
      return store.code;
    },
    formatInDisplay,
    setDisplayCurrency: (code: string) => store.setCurrency(code),
  };
}
