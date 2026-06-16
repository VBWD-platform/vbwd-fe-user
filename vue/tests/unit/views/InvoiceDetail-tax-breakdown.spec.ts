/**
 * S85.4 gap #1 — InvoiceDetail renders real per-rate tax lines aggregated from
 * the persisted line-item ``tax_breakdown`` (e.g. "VAT 19% — €19"). The FE does
 * NO tax math: it only sums the already-computed per-rate amounts for display
 * and shows the persisted net/tax/gross totals verbatim.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';

const mockPush = vi.fn();
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { invoiceId: 'inv-1' } }),
  useRouter: () => ({ push: mockPush }),
  RouterLink: { template: '<a><slot /></a>', props: ['to'] },
}));

vi.mock('@/api', () => ({
  api: { get: vi.fn() },
}));

import InvoiceDetail from '../../../src/views/InvoiceDetail.vue';
import { api } from '@/api';

const mockGet = vi.mocked(api.get);

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      price: { net: 'Net', gross: 'Gross', taxLine: '{name} {rate}%' },
    },
  },
});

function mountView() {
  setActivePinia(createPinia());
  return mount(InvoiceDetail, {
    global: {
      plugins: [i18n],
      stubs: { RouterLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } },
    },
  });
}

describe('InvoiceDetail — per-rate tax breakdown (S85.4 gap #1)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPush.mockClear();
  });

  it('renders one tax line per rate from line-item tax_breakdown', async () => {
    mockGet.mockResolvedValue({
      id: 'inv-1',
      invoice_number: 'INV-001',
      status: 'PAID',
      amount: '119.00',
      subtotal: '100.00',
      tax_amount: '19.00',
      total_amount: '119.00',
      currency: 'EUR',
      line_items: [
        {
          type: 'subscription',
          description: 'Pro',
          quantity: 1,
          unit_price: '119.00',
          total_price: '119.00',
          net_amount: '100.00',
          tax_amount: '19.00',
          tax_breakdown: [{ code: 'VAT', name: 'VAT Germany', rate: 19, amount: 19.0 }],
        },
      ],
    });

    const wrapper = mountView();
    await flushPromises();

    const taxLines = wrapper.findAll('[data-testid="price-breakdown-tax-line"]');
    expect(taxLines).toHaveLength(1);
    // The persisted human-readable name is carried through to the label.
    expect(taxLines[0].text()).toContain('VAT Germany');
    expect(taxLines[0].text()).toContain('19');
    expect(wrapper.get('[data-testid="price-breakdown-net"]').text()).toContain('100');
    expect(wrapper.get('[data-testid="price-breakdown-gross"]').text()).toContain('119');
  });

  it('aggregates the same rate across multiple lines into one tax line', async () => {
    mockGet.mockResolvedValue({
      id: 'inv-1',
      invoice_number: 'INV-001',
      status: 'PAID',
      amount: '238.00',
      subtotal: '200.00',
      tax_amount: '38.00',
      total_amount: '238.00',
      currency: 'EUR',
      line_items: [
        {
          type: 'subscription',
          description: 'Pro',
          quantity: 1,
          unit_price: '119.00',
          total_price: '119.00',
          net_amount: '100.00',
          tax_amount: '19.00',
          tax_breakdown: [{ code: 'VAT', rate: 19, amount: 19.0 }],
        },
        {
          type: 'add_on',
          description: 'Extra',
          quantity: 1,
          unit_price: '119.00',
          total_price: '119.00',
          net_amount: '100.00',
          tax_amount: '19.00',
          tax_breakdown: [{ code: 'VAT', rate: 19, amount: 19.0 }],
        },
      ],
    });

    const wrapper = mountView();
    await flushPromises();

    const taxLines = wrapper.findAll('[data-testid="price-breakdown-tax-line"]');
    expect(taxLines).toHaveLength(1);
    // 19 + 19 = 38 (display sum of already-computed amounts, not a recompute).
    expect(taxLines[0].text()).toContain('38');
  });

  it('reconciles a discounted booking invoice (resource + negative-tax discount line)', async () => {
    // S96.5: booking applies D-DiscountTax — the discount line carries a
    // NEGATIVE per-rate tax_breakdown so the aggregated per-rate tax matches the
    // post-discount invoice.tax_amount and the displayed net + tax == gross.
    mockGet.mockResolvedValue({
      id: 'inv-1',
      invoice_number: 'INV-BK-1',
      status: 'PAID',
      amount: '107.10',
      subtotal: '90.00',
      tax_amount: '17.10',
      total_amount: '107.10',
      currency: 'EUR',
      line_items: [
        {
          type: 'booking',
          description: 'Room — 1 night',
          quantity: 1,
          unit_price: '119.00',
          total_price: '119.00',
          net_amount: '100.00',
          tax_amount: '19.00',
          tax_breakdown: [{ code: 'VAT', name: 'VAT Germany', rate: 19, amount: 19.0 }],
        },
        {
          type: 'custom',
          description: 'Discount',
          quantity: 1,
          unit_price: '-11.90',
          total_price: '-11.90',
          net_amount: '-10.00',
          tax_amount: '-1.90',
          tax_breakdown: [{ code: 'VAT', name: 'VAT Germany', rate: 19, amount: -1.9 }],
        },
      ],
    });

    const wrapper = mountView();
    await flushPromises();

    const taxLines = wrapper.findAll('[data-testid="price-breakdown-tax-line"]');
    expect(taxLines).toHaveLength(1);
    // 19.00 + (-1.90) = 17.10 — the post-discount tax, reconciling 90 + 17.10 = 107.10.
    expect(taxLines[0].text()).toContain('17.1');
    expect(wrapper.get('[data-testid="price-breakdown-net"]').text()).toContain('90');
    expect(wrapper.get('[data-testid="price-breakdown-gross"]').text()).toContain('107.1');
  });

  it('falls back to the aggregate tax line when no per-line breakdown exists', async () => {
    mockGet.mockResolvedValue({
      id: 'inv-1',
      invoice_number: 'INV-001',
      status: 'PAID',
      amount: '119.00',
      subtotal: '100.00',
      tax_amount: '19.00',
      total_amount: '119.00',
      currency: 'EUR',
      line_items: [
        {
          type: 'subscription',
          description: 'Legacy',
          quantity: 1,
          unit_price: '119.00',
          total_price: '119.00',
        },
      ],
    });

    const wrapper = mountView();
    await flushPromises();

    // No per-rate breakdown → single aggregate tax line from invoice.tax_amount.
    const taxLines = wrapper.findAll('[data-testid="price-breakdown-tax-line"]');
    expect(taxLines).toHaveLength(1);
    expect(taxLines[0].text()).toContain('19');
    // No redundant aggregate Σtax row (Net + per-rate + Gross only).
    expect(wrapper.find('[data-testid="price-breakdown-tax-total"]').exists()).toBe(false);
  });
});
