/**
 * S85.4 phase-2 — the invoices list threads the viewer's account_type into the
 * per-row <PriceDisplay> (net side for business viewers, global otherwise) and
 * feeds net=subtotal / gross=total_amount from persisted fields.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const mockAccountType = vi.fn<[], 'private' | 'business' | undefined>();

vi.mock('vbwd-view-component', () => ({
  useAuthStore: () => ({ user: { account_type: mockAccountType() } }),
  formatMoney: (amount: number) => String(amount),
  // The view now pulls the app-config store (S99 billing currency), which
  // transitively imports the @/api ApiClient + fe-core's operating-currency
  // accessor — stub both so the module graph loads under the mock.
  setOperatingCurrency: vi.fn(),
  ApiClient: class {
    get = vi.fn().mockResolvedValue({});
    post = vi.fn().mockResolvedValue({});
    put = vi.fn().mockResolvedValue({});
    delete = vi.fn().mockResolvedValue({});
    on = vi.fn();
    off = vi.fn();
  },
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const mockPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const invoiceRow = {
  id: 'inv-1',
  user_id: 'u1',
  invoice_number: 'INV-001',
  amount: '119.00',
  subtotal: '100.00',
  total_amount: '119.00',
  currency: 'EUR',
  status: 'PAID' as const,
  payment_method: null,
  payment_ref: null,
  is_payable: false,
  invoiced_at: '2026-01-01T00:00:00Z',
  paid_at: null,
  expires_at: null,
};

vi.mock('../../../src/stores/invoices', () => ({
  useInvoicesStore: () => ({
    invoices: [invoiceRow],
    fetchInvoices: vi.fn().mockResolvedValue({}),
    getInvoiceById: vi.fn(),
    downloadInvoice: vi.fn(),
  }),
}));

import Invoices from '../../../src/views/Invoices.vue';

const priceDisplayProps: Array<Record<string, unknown>> = [];

function mountView() {
  priceDisplayProps.length = 0;
  setActivePinia(createPinia());
  return mount(Invoices, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        PriceDisplay: {
          name: 'PriceDisplay',
          props: ['netAmount', 'grossAmount', 'currency', 'accountType'],
          setup(props: Record<string, unknown>) {
            priceDisplayProps.push(props);
            return () => null;
          },
        },
      },
    },
  });
}

describe('Invoices list — account_type + net/gross threading (S85.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('feeds net=subtotal and gross=total_amount and account_type="business"', async () => {
    mockAccountType.mockReturnValue('business');
    mountView();
    await flushPromises();
    expect(priceDisplayProps.length).toBeGreaterThan(0);
    expect(priceDisplayProps[0].accountType).toBe('business');
    expect(Number(priceDisplayProps[0].netAmount)).toBe(100);
    expect(Number(priceDisplayProps[0].grossAmount)).toBe(119);
  });

  it('passes undefined account_type for an anonymous viewer', async () => {
    mockAccountType.mockReturnValue(undefined);
    mountView();
    await flushPromises();
    expect(priceDisplayProps[0].accountType).toBeUndefined();
  });
});
