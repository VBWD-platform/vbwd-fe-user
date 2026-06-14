/**
 * S85.4 phase-2 — InvoiceDetail renders a totals-level <PriceBreakdown> built
 * straight from the persisted invoice net / tax / gross fields. The FE does no
 * tax math: a tampered tax_amount is shown verbatim.
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

describe('InvoiceDetail — totals breakdown (S85.4)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPush.mockClear();
  });

  it('renders net / per-rate tax / gross from persisted invoice fields', async () => {
    mockGet.mockResolvedValue({
      id: 'inv-1',
      invoice_number: 'INV-001',
      status: 'PAID',
      amount: '119.00',
      subtotal: '100.00',
      tax_amount: '19.00',
      total_amount: '119.00',
      currency: 'EUR',
    });

    const wrapper = mountView();
    await flushPromises();

    const breakdown = wrapper.find('[data-testid="invoice-breakdown"]');
    expect(breakdown.exists()).toBe(true);
    expect(wrapper.get('[data-testid="price-breakdown-net"]').text()).toContain('100');
    expect(wrapper.get('[data-testid="price-breakdown-tax-line"]').text()).toContain('19');
    expect(wrapper.get('[data-testid="price-breakdown-gross"]').text()).toContain('119');
    // No redundant aggregate Σtax row (Net + per-rate + Gross only).
    expect(wrapper.find('[data-testid="price-breakdown-tax-total"]').exists()).toBe(false);
  });

  it('shows a tampered tax_amount verbatim (no recompute)', async () => {
    // subtotal 100 + tax 5 but gross 119 — deliberately inconsistent. The view
    // must show 5 (and gross 119) exactly as persisted.
    mockGet.mockResolvedValue({
      id: 'inv-1',
      invoice_number: 'INV-001',
      status: 'PAID',
      amount: '119.00',
      subtotal: '100.00',
      tax_amount: '5.00',
      total_amount: '119.00',
      currency: 'EUR',
    });

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.get('[data-testid="price-breakdown-tax-line"]').text()).toContain('5');
    expect(wrapper.get('[data-testid="price-breakdown-gross"]').text()).toContain('119');
  });

  it('renders no tax line and net == gross when no tax is persisted', async () => {
    mockGet.mockResolvedValue({
      id: 'inv-1',
      invoice_number: 'INV-001',
      status: 'PAID',
      amount: '50.00',
      total_amount: '50.00',
      currency: 'USD',
    });

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.findAll('[data-testid="price-breakdown-tax-line"]')).toHaveLength(0);
    expect(wrapper.get('[data-testid="price-breakdown-net"]').text()).toContain('50');
    expect(wrapper.get('[data-testid="price-breakdown-gross"]').text()).toContain('50');
  });
});
