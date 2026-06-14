/**
 * S72.4 — netto/brutto price-display resolution (pure logic).
 *
 * The single source of truth that every entity price renderer (plan /
 * product / resource cards + detail) reuses to pick the displayed number and
 * decide whether the "netto price" tag applies. Pure + framework-free so it
 * can be unit-tested directly without mounting a component.
 */
import { describe, it, expect } from 'vitest';
import { resolvePriceDisplay, resolveDisplaySide } from '@/utils/priceDisplay';

describe('resolvePriceDisplay', () => {
  it('shows the NET amount and a netto tag for a netto item under a brutto global', () => {
    const result = resolvePriceDisplay({
      effectiveDisplayMode: 'netto',
      globalMode: 'brutto',
      netAmount: 100,
      grossAmount: 119,
    });
    expect(result.amount).toBe(100);
    expect(result.showNettoTag).toBe(true);
  });

  it('shows the GROSS amount and no tag for a brutto item under a brutto global', () => {
    const result = resolvePriceDisplay({
      effectiveDisplayMode: 'brutto',
      globalMode: 'brutto',
      netAmount: 100,
      grossAmount: 119,
    });
    expect(result.amount).toBe(119);
    expect(result.showNettoTag).toBe(false);
  });

  it('shows the NET amount and NO tag for items under a global netto', () => {
    const nettoItem = resolvePriceDisplay({
      effectiveDisplayMode: 'netto',
      globalMode: 'netto',
      netAmount: 100,
      grossAmount: 119,
    });
    expect(nettoItem.amount).toBe(100);
    expect(nettoItem.showNettoTag).toBe(false);

    // An item that did not override (effective inherits the netto global) still
    // shows net with no tag — the global netto rule applies everywhere.
    const inheritingItem = resolvePriceDisplay({
      effectiveDisplayMode: undefined,
      globalMode: 'netto',
      netAmount: 100,
      grossAmount: 119,
    });
    expect(inheritingItem.amount).toBe(100);
    expect(inheritingItem.showNettoTag).toBe(false);
  });

  it('falls back to brutto (gross) when no mode is known at all', () => {
    const result = resolvePriceDisplay({
      effectiveDisplayMode: undefined,
      globalMode: undefined,
      netAmount: 100,
      grossAmount: 119,
    });
    expect(result.amount).toBe(119);
    expect(result.showNettoTag).toBe(false);
  });

  it('lets a brutto item override a netto global, showing gross with no tag', () => {
    const result = resolvePriceDisplay({
      effectiveDisplayMode: 'brutto',
      globalMode: 'netto',
      netAmount: 100,
      grossAmount: 119,
    });
    expect(result.amount).toBe(119);
    expect(result.showNettoTag).toBe(false);
  });

  it('shows NET for an authenticated business viewer (D9) even when the resolved side would be brutto', () => {
    const result = resolvePriceDisplay({
      effectiveDisplayMode: 'brutto',
      globalMode: 'brutto',
      netAmount: 100,
      grossAmount: 119,
      accountType: 'business',
    });
    expect(result.amount).toBe(100);
    expect(result.showNettoTag).toBe(true);
  });
});

describe('resolveDisplaySide (D9 viewer-aware precedence)', () => {
  it('business viewer beats a per-item brutto override → netto', () => {
    expect(
      resolveDisplaySide({ itemMode: 'brutto', globalMode: 'brutto', accountType: 'business' })
    ).toBe('netto');
  });

  it('business viewer beats the global → netto', () => {
    expect(
      resolveDisplaySide({ itemMode: undefined, globalMode: 'brutto', accountType: 'business' })
    ).toBe('netto');
  });

  it('item override beats the global for a non-business viewer', () => {
    expect(
      resolveDisplaySide({ itemMode: 'netto', globalMode: 'brutto', accountType: 'private' })
    ).toBe('netto');
    expect(
      resolveDisplaySide({ itemMode: 'brutto', globalMode: 'netto', accountType: 'private' })
    ).toBe('brutto');
  });

  it('falls back to the global when there is no item override', () => {
    expect(
      resolveDisplaySide({ itemMode: undefined, globalMode: 'netto', accountType: 'private' })
    ).toBe('netto');
  });

  it('defaults to brutto when nothing is known', () => {
    expect(resolveDisplaySide({})).toBe('brutto');
  });

  it('anonymous viewer (no accountType) follows item ?? global', () => {
    expect(resolveDisplaySide({ itemMode: 'netto', globalMode: 'brutto' })).toBe('netto');
    expect(resolveDisplaySide({ itemMode: undefined, globalMode: 'brutto' })).toBe('brutto');
  });

  it('private viewer follows item ?? global (no overlay)', () => {
    expect(
      resolveDisplaySide({ itemMode: 'brutto', globalMode: 'netto', accountType: 'private' })
    ).toBe('brutto');
    expect(
      resolveDisplaySide({ itemMode: undefined, globalMode: 'brutto', accountType: 'private' })
    ).toBe('brutto');
  });
});
