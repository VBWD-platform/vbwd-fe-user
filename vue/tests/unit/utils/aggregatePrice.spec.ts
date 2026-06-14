/**
 * aggregatePrice — pure order-level aggregation of per-unit Price VOs.
 *
 * Sums net/gross and groups tax lines by ``code-rate`` across all line items,
 * multiplying each by its quantity. It performs NO tax computation — it only
 * display-sums the amounts the backend already emitted. Items without a Price VO
 * contribute ``net == gross`` (their ``grossFallback``) with no tax line.
 */
import { describe, it, expect } from 'vitest';
import { aggregatePrice } from '@/utils/aggregatePrice';
import type { PriceVO } from '@/utils/priceDisplay';

function vo(netto: number, brutto: number, taxes: PriceVO['taxes'], currency = 'EUR'): PriceVO {
  return { netto, taxes, brutto, currency };
}

describe('aggregatePrice', () => {
  it('aggregates a single taxed item into one tax group', () => {
    const result = aggregatePrice([
      { priceVO: vo(100, 119, [{ code: 'VAT_DE', rate: 19, amount: 19 }]), quantity: 1, grossFallback: 119 },
    ]);
    expect(result.netto).toBe(100);
    expect(result.brutto).toBe(119);
    expect(result.taxes).toHaveLength(1);
    expect(result.taxes[0]).toMatchObject({ code: 'VAT_DE', rate: 19, amount: 19 });
    expect(result.currency).toBe('EUR');
  });

  it('merges two items sharing the same code+rate into ONE group (homogeneous)', () => {
    const result = aggregatePrice([
      { priceVO: vo(100, 119, [{ code: 'VAT', rate: 19, amount: 19 }]), quantity: 1, grossFallback: 119 },
      { priceVO: vo(200, 238, [{ code: 'VAT', rate: 19, amount: 38 }]), quantity: 1, grossFallback: 238 },
    ]);
    expect(result.netto).toBe(300);
    expect(result.brutto).toBe(357);
    expect(result.taxes).toHaveLength(1);
    expect(result.taxes[0].amount).toBe(57);
  });

  it('keeps two DIFFERENT rates as separate groups (heterogeneous)', () => {
    const result = aggregatePrice([
      { priceVO: vo(100, 119, [{ code: 'VAT', rate: 19, amount: 19 }]), quantity: 1, grossFallback: 119 },
      { priceVO: vo(100, 107, [{ code: 'VAT', rate: 7, amount: 7 }]), quantity: 1, grossFallback: 107 },
    ]);
    expect(result.taxes).toHaveLength(2);
    expect(result.netto).toBe(200);
    expect(result.brutto).toBe(226);
  });

  it('treats an item without a Price VO as net == gross with no tax line', () => {
    const result = aggregatePrice([
      { priceVO: vo(100, 119, [{ code: 'VAT', rate: 19, amount: 19 }]), quantity: 1, grossFallback: 119 },
      { priceVO: null, quantity: 1, grossFallback: 50 },
    ]);
    expect(result.netto).toBe(150);
    expect(result.brutto).toBe(169);
    expect(result.taxes).toHaveLength(1);
    expect(result.taxes[0].amount).toBe(19);
  });

  it('multiplies net/gross/tax amounts by quantity', () => {
    const result = aggregatePrice([
      { priceVO: vo(100, 119, [{ code: 'VAT', rate: 19, amount: 19 }]), quantity: 3, grossFallback: 119 },
    ]);
    expect(result.netto).toBe(300);
    expect(result.brutto).toBe(357);
    expect(result.taxes[0].amount).toBe(57);
  });

  it('returns net=gross=0 with no taxes for an empty order', () => {
    const result = aggregatePrice([], 'USD');
    expect(result.netto).toBe(0);
    expect(result.brutto).toBe(0);
    expect(result.taxes).toHaveLength(0);
    expect(result.currency).toBe('USD');
  });

  it('preserves the tax name and coerces rate to a number', () => {
    const result = aggregatePrice([
      {
        priceVO: vo(100, 119, [{ code: 'VAT', name: 'VAT Germany', rate: 19 as unknown as number, amount: 19 }]),
        quantity: 1,
        grossFallback: 119,
      },
    ]);
    expect(result.taxes[0].name).toBe('VAT Germany');
    expect(typeof result.taxes[0].rate).toBe('number');
  });

  it('uses the first VO currency, falling back to the default currency', () => {
    const withVo = aggregatePrice(
      [{ priceVO: vo(10, 10, [], 'GBP'), quantity: 1, grossFallback: 10 }],
      'USD',
    );
    expect(withVo.currency).toBe('GBP');

    const noVo = aggregatePrice(
      [{ priceVO: null, quantity: 1, grossFallback: 10, currency: 'CHF' }],
      'USD',
    );
    expect(noVo.currency).toBe('CHF');
  });
});
