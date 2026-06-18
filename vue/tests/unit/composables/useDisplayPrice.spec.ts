/**
 * S99.4 — useDisplayPrice composable: the single render-boundary helper that
 * the shared storefront price components reuse to convert a billing-currency
 * amount into the user-selected display currency and format it (D8). DRY: one
 * home for "convert by cross-rate then formatMoney in the display currency".
 *
 * It is defensive by design (Liskov / disabled path): when no display store /
 * Pinia is active, or display == billing, it behaves as identity — formatting
 * in the billing currency exactly as before the switcher existed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/api', () => ({
  api: { get: vi.fn() },
}));
vi.mock('vbwd-view-component', () => ({
  setOperatingCurrency: vi.fn(),
  // Format deterministically as "<amount> <currency>" so the test asserts both
  // the converted number and the display-currency code without Intl locale flux.
  formatMoney: (value: number, options?: { currency?: string }) =>
    `${Number(value).toFixed(2)} ${options?.currency ?? 'XXX'}`,
}));

import { api } from '@/api';
import { useAppConfigStore } from '@/stores/appConfig';
import { useDisplayPrice } from '@/composables/useDisplayPrice';

async function seedConfig(): Promise<void> {
  vi.mocked(api.get).mockResolvedValue({
    default_currency: 'EUR',
    prices_display_mode: 'brutto',
    prices_mode_in_db: 'NETTO',
    base_currency: 'EUR',
    active_currencies: ['EUR', 'USD'],
    currency_rates: { EUR: '1', USD: '1.1' },
  });
  await useAppConfigStore().load();
}

describe('useDisplayPrice', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('formats in the billing currency unchanged when display == billing', async () => {
    await seedConfig();
    const { formatInDisplay } = useDisplayPrice();
    expect(formatInDisplay(100, 'EUR')).toBe('100.00 EUR');
  });

  it('converts and formats in the display currency when switched', async () => {
    await seedConfig();
    const display = useDisplayPrice();
    display.setDisplayCurrency('USD');
    expect(display.formatInDisplay(100, 'EUR')).toBe('110.00 USD');
  });

  it('falls back to the line currency when the explicit currency is omitted', async () => {
    await seedConfig();
    const { formatInDisplay } = useDisplayPrice();
    // No billing currency arg → uses the billing currency; identity since not switched.
    expect(formatInDisplay(50)).toBe('50.00 EUR');
  });
});
