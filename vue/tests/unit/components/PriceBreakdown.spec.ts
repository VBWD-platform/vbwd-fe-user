/**
 * S85.4 — shared <PriceBreakdown> detailed tax-disclosure component.
 *
 * The expanded price disclosure for financial surfaces (invoices, checkout,
 * success / pending / confirmation): per-line net, one line per tax rate
 * straight from ``Price.taxes`` labelled by the human-readable tax NAME (e.g.
 * "VAT Germany 19% — €X"), and the gross total. It performs NO tax arithmetic
 * and formats via fe-core ``formatMoney``. There is no redundant Σtax row.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import PriceBreakdown from '@/components/PriceBreakdown.vue';
import type { PriceVO } from '@/utils/priceDisplay';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      price: {
        net: 'Net',
        gross: 'Gross',
        taxLine: '{name} {rate}%',
      },
    },
  },
});

function mountBreakdown(price: PriceVO) {
  return mount(PriceBreakdown, {
    props: { price },
    global: { plugins: [i18n] },
  });
}

describe('PriceBreakdown', () => {
  it('labels each tax line by its human-readable NAME and renders net + gross (no Σtax row)', () => {
    const wrapper = mountBreakdown({
      netto: 100,
      taxes: [
        { code: 'VAT_DE', name: 'VAT Germany', rate: 19, amount: 19 },
        { code: 'ECO', name: 'Eco Levy', rate: 7, amount: 7 },
      ],
      brutto: 126,
      currency: 'EUR',
    });

    const taxLines = wrapper.findAll('[data-testid="price-breakdown-tax-line"]');
    expect(taxLines).toHaveLength(2);
    expect(taxLines[0].text()).toContain('VAT Germany');
    expect(taxLines[0].text()).toContain('19');
    expect(taxLines[0].text()).not.toContain('VAT_DE');
    expect(taxLines[1].text()).toContain('Eco Levy');
    expect(taxLines[1].text()).toContain('7');

    expect(wrapper.get('[data-testid="price-breakdown-net"]').text()).toContain('100');
    expect(wrapper.get('[data-testid="price-breakdown-gross"]').text()).toContain('126');

    // The redundant aggregate tax row was removed (Net + per-rate + Gross only).
    expect(wrapper.find('[data-testid="price-breakdown-tax-total"]').exists()).toBe(false);
  });

  it('falls back to the tax code when no name is present (back-compat for old invoices)', () => {
    const wrapper = mountBreakdown({
      netto: 100,
      taxes: [{ code: 'VAT', rate: 19, amount: 19 }],
      brutto: 119,
      currency: 'EUR',
    });

    const taxLine = wrapper.get('[data-testid="price-breakdown-tax-line"]').text();
    expect(taxLine).toContain('VAT');
    expect(taxLine).toContain('19');
  });

  it('uses ONLY the provided amounts — a tampered amount is shown verbatim (no tax math)', () => {
    // Deliberately inconsistent: rate says 19% but amount is 5. The component
    // must show 5, proving it never recomputes tax.
    const wrapper = mountBreakdown({
      netto: 100,
      taxes: [{ code: 'VAT', name: 'VAT Germany', rate: 19, amount: 5 }],
      brutto: 105,
      currency: 'EUR',
    });

    const taxLine = wrapper.get('[data-testid="price-breakdown-tax-line"]').text();
    expect(taxLine).toContain('5');
    expect(taxLine).not.toContain('19.00');
  });

  it('renders no tax lines and net == gross for a taxless price', () => {
    const wrapper = mountBreakdown({
      netto: 100,
      taxes: [],
      brutto: 100,
      currency: 'EUR',
    });

    expect(wrapper.findAll('[data-testid="price-breakdown-tax-line"]')).toHaveLength(0);
    expect(wrapper.get('[data-testid="price-breakdown-net"]').text()).toContain('100');
    expect(wrapper.get('[data-testid="price-breakdown-gross"]').text()).toContain('100');
  });
});
