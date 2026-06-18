/**
 * S99.4 — display conversion at the render boundary (the contract crux).
 *
 * The shared storefront price components opt in to the display switch via
 * `convert-to-display`. When the user picks a non-billing display currency:
 *   - a storefront price component (opted in) shows the CONVERTED figure,
 *   - an invoice usage (NOT opted in) keeps the invoice's stored currency (D5),
 * proving the switch is view-only and never rewrites an invoice.
 *
 * Uses the REAL `vbwd-view-component` (formatMoney + convertForDisplay) so the
 * conversion + symbol-correct formatting are exercised end-to-end.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia, type Pinia } from 'pinia';
import { createI18n } from 'vue-i18n';

vi.mock('@/api', () => ({ api: { get: vi.fn() } }));

import { api } from '@/api';
import { useAppConfigStore } from '@/stores/appConfig';
import { useDisplayCurrencyStore } from '@/stores/displayCurrency';
import PriceDisplay from '@/components/PriceDisplay.vue';
import OrderTaxSummary from '@/components/OrderTaxSummary.vue';
import type { PriceVO } from '@/utils/priceDisplay';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      price: {
        nettoTag: 'netto price',
        totalNet: 'Total netto',
        totalTax: 'Total taxes',
        totalTaxWithRate: 'Total taxes ({rate}%)',
        totalGross: 'Total brutto to pay',
      },
    },
  },
});

async function seedConfig(): Promise<void> {
  vi.mocked(api.get).mockResolvedValue({
    default_currency: 'EUR',
    prices_display_mode: 'brutto',
    prices_mode_in_db: 'NETTO',
    base_currency: 'EUR',
    active_currencies: ['EUR', 'USD'],
    currency_rates: { EUR: '1', USD: '2' },
  });
  await useAppConfigStore().load();
}

let pinia: Pinia;

describe('display-currency conversion at the render boundary', () => {
  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
    vi.clearAllMocks();
    await seedConfig();
  });

  it('PriceDisplay (opted in) converts the amount when display != billing', () => {
    useDisplayCurrencyStore().setCurrency('USD'); // rate EUR→USD = 2
    const wrapper = mount(PriceDisplay, {
      props: {
        effectiveDisplayMode: 'brutto',
        globalMode: 'brutto',
        netAmount: 100,
        grossAmount: 100,
        currency: 'EUR',
        convertToDisplay: true,
      },
      global: { plugins: [pinia, i18n] },
    });
    const text = wrapper.get('[data-testid="price-amount"]').text();
    // 100 EUR → 200 USD displayed, in USD.
    expect(text).toContain('200');
    expect(text).toContain('$');
  });

  it('PriceDisplay (opted in) is identity when display == billing', () => {
    const wrapper = mount(PriceDisplay, {
      props: {
        effectiveDisplayMode: 'brutto',
        globalMode: 'brutto',
        netAmount: 100,
        grossAmount: 100,
        currency: 'EUR',
        convertToDisplay: true,
      },
      global: { plugins: [pinia, i18n] },
    });
    const text = wrapper.get('[data-testid="price-amount"]').text();
    expect(text).toContain('100');
    expect(text).toContain('€');
  });

  it('OrderTaxSummary (opted in) converts every VO component by the same rate', () => {
    useDisplayCurrencyStore().setCurrency('USD'); // rate 2
    const price: PriceVO = {
      netto: 300,
      taxes: [{ code: 'VAT', rate: 19, amount: 57 }],
      brutto: 357,
      currency: 'EUR',
    };
    const wrapper = mount(OrderTaxSummary, {
      props: { price, convertToDisplay: true },
      global: { plugins: [pinia, i18n] },
    });
    expect(wrapper.get('[data-testid="order-tax-net"]').text()).toContain('600');
    expect(wrapper.get('[data-testid="order-tax-total"]').text()).toContain('114');
    expect(wrapper.get('[data-testid="order-tax-gross"]').text()).toContain('714');
  });

  // D5 — an invoice usage does NOT opt in, so the display switch is ignored and
  // the invoice's stored currency is preserved (a legal document).
  it('PriceBreakdown without convert-to-display ignores the display switch (invoice path)', async () => {
    const PriceBreakdown = (await import('@/components/PriceBreakdown.vue')).default;
    useDisplayCurrencyStore().setCurrency('USD');
    const price: PriceVO = {
      netto: 100,
      taxes: [{ code: 'VAT', rate: 19, amount: 19 }],
      brutto: 119,
      currency: 'EUR',
    };
    const wrapper = mount(PriceBreakdown, {
      props: { price },
      global: {
        plugins: [
          pinia,
          createI18n({
            legacy: false,
            locale: 'en',
            messages: {
              en: { price: { net: 'Net', gross: 'Gross', taxLine: '{name} {rate}%' } },
            },
          }),
        ],
      },
    });
    const grossText = wrapper.get('[data-testid="price-breakdown-gross"]').text();
    // Stored EUR amount, NOT converted to USD.
    expect(grossText).toContain('119');
    expect(grossText).toContain('€');
    expect(grossText).not.toContain('$');
  });
});
