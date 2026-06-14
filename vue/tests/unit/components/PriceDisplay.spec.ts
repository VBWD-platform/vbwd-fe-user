/**
 * S72.4 — shared <PriceDisplay> component.
 *
 * The single price renderer the entity surfaces (plan / product / resource
 * cards + detail) reuse. It picks net vs gross from the pricing payload by the
 * effective display mode, formats through fe-core ``formatMoney``, and renders
 * the localized "netto price" tag when an item differs from a brutto global.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import PriceDisplay from '@/components/PriceDisplay.vue';
import type { PriceDisplayMode } from '@/utils/priceDisplay';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: { price: { nettoTag: 'netto price' } },
  },
});

interface PriceDisplayProps {
  effectiveDisplayMode?: PriceDisplayMode | null;
  globalMode?: PriceDisplayMode | null;
  netAmount: number | string;
  grossAmount: number | string;
  currency?: string;
  accountType?: 'private' | 'business' | null;
}

function mountPrice(props: PriceDisplayProps) {
  return mount(PriceDisplay, {
    props,
    global: { plugins: [i18n] },
  });
}

describe('PriceDisplay', () => {
  it('renders the NET amount + netto tag for a netto item under a brutto global', () => {
    const wrapper = mountPrice({
      effectiveDisplayMode: 'netto',
      globalMode: 'brutto',
      netAmount: 100,
      grossAmount: 119,
      currency: 'EUR',
    });
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('100');
    expect(amount).not.toContain('119');
    expect(wrapper.find('[data-testid="price-netto-tag"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="price-netto-tag"]').text()).toBe('netto price');
  });

  it('renders the GROSS amount and no tag for a brutto item under a brutto global', () => {
    const wrapper = mountPrice({
      effectiveDisplayMode: 'brutto',
      globalMode: 'brutto',
      netAmount: 100,
      grossAmount: 119,
      currency: 'EUR',
    });
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('119');
    expect(amount).not.toContain('100');
    expect(wrapper.find('[data-testid="price-netto-tag"]').exists()).toBe(false);
  });

  it('renders the NET amount + netto tag for a business viewer under a brutto item/global (D9)', () => {
    const wrapper = mountPrice({
      effectiveDisplayMode: 'brutto',
      globalMode: 'brutto',
      netAmount: 100,
      grossAmount: 119,
      currency: 'EUR',
      accountType: 'business',
    });
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('100');
    expect(amount).not.toContain('119');
    expect(wrapper.find('[data-testid="price-netto-tag"]').exists()).toBe(true);
  });

  it('renders the NET amount with NO tag under a global netto', () => {
    const wrapper = mountPrice({
      effectiveDisplayMode: 'netto',
      globalMode: 'netto',
      netAmount: 100,
      grossAmount: 119,
      currency: 'EUR',
    });
    const amount = wrapper.get('[data-testid="price-amount"]').text();
    expect(amount).toContain('100');
    expect(wrapper.find('[data-testid="price-netto-tag"]').exists()).toBe(false);
  });
});
