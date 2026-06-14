/**
 * Order-level price aggregation (display-only).
 *
 * The single home for summing per-unit Price VOs (× quantity) into one order
 * Price VO. It groups tax lines by ``code-rate`` and adds their amounts — it
 * NEVER computes a tax. Every checkout summary (subscription, shop) and the
 * order-level <OrderTaxSummary> use this so the "homogeneous vs heterogeneous"
 * decision (1 vs >1 distinct tax group) has a single source of truth.
 *
 * Items that carry no Price VO contribute ``net == gross`` (their
 * ``grossFallback``) with no tax line — older/draft-hydrated cart items lacking
 * a split still total correctly.
 */
import type { PriceVO, PriceTaxVO } from '@/utils/priceDisplay';

export interface AggregateInput {
  /** The line's per-unit computed Price VO (or null/undefined when absent). */
  priceVO?: PriceVO | null;
  /** Units of this line (default 1). */
  quantity?: number;
  /** Per-unit gross used when no Price VO is present (net == gross fallback). */
  grossFallback: number;
  /** Per-item currency used only as a fallback when the VO carries none. */
  currency?: string;
}

export function aggregatePrice(items: AggregateInput[], defaultCurrency?: string): PriceVO {
  const taxesByKey = new Map<string, PriceTaxVO>();
  let nettoTotal = 0;
  let bruttoTotal = 0;
  let currency: string | undefined;

  for (const item of items) {
    const quantity = item.quantity ?? 1;
    const priceVO = item.priceVO ?? null;

    nettoTotal += (priceVO ? priceVO.netto : item.grossFallback) * quantity;
    bruttoTotal += (priceVO ? priceVO.brutto : item.grossFallback) * quantity;

    if (!currency) {
      currency = priceVO?.currency || item.currency;
    }

    for (const tax of priceVO?.taxes ?? []) {
      const rate = Number(tax.rate);
      const key = `${tax.code}-${rate}`;
      const lineTaxAmount = tax.amount * quantity;
      const existing = taxesByKey.get(key);
      if (existing) {
        existing.amount += lineTaxAmount;
      } else {
        taxesByKey.set(key, { code: tax.code, name: tax.name, rate, amount: lineTaxAmount });
      }
    }
  }

  return {
    netto: nettoTotal,
    taxes: Array.from(taxesByKey.values()),
    brutto: bruttoTotal,
    currency: currency || defaultCurrency || '',
  };
}
