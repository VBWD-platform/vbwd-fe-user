/**
 * OrderTaxSummary — the order-level tax disclosure shown just before the Total.
 *
 * Renders net / total-taxes / gross from an already-aggregated order Price VO:
 *   - homogeneous order (one tax group) → "Total taxes (N%)" label,
 *   - heterogeneous order (>1 groups)   → generic "Total taxes" label,
 *   - total taxes always equals the SUM of the VO's tax amounts (no recompute),
 *   - hidden entirely when the order carries no taxes.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import OrderTaxSummary from '@/components/OrderTaxSummary.vue';
import type { PriceVO } from '@/utils/priceDisplay';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      price: {
        totalNet: 'Total netto',
        totalTax: 'Total taxes',
        totalTaxWithRate: 'Total taxes ({rate}%)',
        totalGross: 'Total brutto to pay',
      },
    },
  },
});

function mountWith(price: PriceVO) {
  return mount(OrderTaxSummary, {
    props: { price },
    global: { plugins: [i18n] },
  });
}

describe('OrderTaxSummary', () => {
  it('is hidden when the order has no taxes', () => {
    const wrapper = mountWith({ netto: 50, taxes: [], brutto: 50, currency: 'EUR' });
    expect(wrapper.find('[data-testid="order-tax-net"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="order-tax-gross"]').exists()).toBe(false);
  });

  it('shows the rate in the label and the single amount for a homogeneous order', () => {
    const wrapper = mountWith({
      netto: 300,
      taxes: [{ code: 'VAT', rate: 19, amount: 57 }],
      brutto: 357,
      currency: 'EUR',
    });
    expect(wrapper.get('[data-testid="order-tax-net"]').text()).toContain('300');
    const totalRow = wrapper.get('[data-testid="order-tax-total"]');
    expect(totalRow.text()).toContain('19');
    expect(totalRow.text()).toContain('57');
    expect(wrapper.get('[data-testid="order-tax-gross"]').text()).toContain('357');
  });

  it('shows a generic label and the SUMMED tax for a heterogeneous order', () => {
    const wrapper = mountWith({
      netto: 200,
      taxes: [
        { code: 'VAT', rate: 19, amount: 19 },
        { code: 'VAT', rate: 7, amount: 7 },
      ],
      brutto: 226,
      currency: 'EUR',
    });
    const totalRow = wrapper.get('[data-testid="order-tax-total"]');
    // Generic label — no specific rate baked in.
    expect(totalRow.text()).not.toContain('19%');
    expect(totalRow.text()).not.toContain('7%');
    // Σ tax = 26 — display sum only.
    expect(totalRow.text()).toContain('26');
  });

  it('formats amounts in the VO currency and never recomputes', () => {
    // A deliberately inconsistent VO (net 100 + tax 19 != gross 999): the
    // component must echo the VO numbers, never recompute them.
    const wrapper = mountWith({
      netto: 100,
      taxes: [{ code: 'VAT', rate: 19, amount: 19 }],
      brutto: 999,
      currency: 'EUR',
    });
    expect(wrapper.get('[data-testid="order-tax-gross"]').text()).toContain('999');
  });
});
