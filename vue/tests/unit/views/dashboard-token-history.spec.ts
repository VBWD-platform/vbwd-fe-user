import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { Pinia } from 'pinia';
import Dashboard from '../../../src/views/Dashboard.vue';
import { api } from '../../../src/api';

vi.mock('../../../src/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    setToken: vi.fn(),
    clearToken: vi.fn()
  },
  initializeApi: vi.fn(),
  clearApiAuth: vi.fn(),
  isAuthenticated: vi.fn(() => true),
  hasUserPermission: vi.fn(() => true),
  getUserPermissions: vi.fn(() => ['*']),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {} })
}));

const RouterLinkStub = {
  template: '<a><slot /></a>',
  props: ['to']
};

interface MockTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

let pinia: Pinia;

function mockApiWithTokens(transactions: MockTransaction[] = []) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.startsWith('/user/tokens/transactions')) return Promise.resolve({ transactions });
    if (url === '/user/subscriptions') return Promise.resolve({ subscriptions: [] });
    if (url === '/user/subscriptions/active') return Promise.resolve({ subscription: null });
    if (url === '/user/profile') return Promise.resolve({ user: { email: 'test@test.com' }, details: {} });
    if (url === '/user/tokens/balance') return Promise.resolve({ balance: 500 });
    if (url === '/user/addons') return Promise.resolve({ addon_subscriptions: [] });
    if (url === '/user/invoices') return Promise.resolve({ invoices: [], total: 0 });
    return Promise.resolve({});
  });
}

function mountDashboard() {
  return mount(Dashboard, {
    global: {
      plugins: [pinia],
      stubs: { 'router-link': RouterLinkStub },
      mocks: { $t: (key: string) => key }
    }
  });
}

describe('Dashboard — Token History Card', () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });

  it('renders token history card with transactions', async () => {
    mockApiWithTokens([
      { id: 't1', transaction_type: 'purchase', amount: 500, balance_after: 500, description: null, created_at: '2026-01-15' },
      { id: 't2', transaction_type: 'refund', amount: -200, balance_after: 300, description: null, created_at: '2026-01-20' },
    ]);
    const wrapper = mountDashboard();
    await flushPromises();

    expect(wrapper.find('[data-testid="token-history"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="token-item"]')).toHaveLength(2);
  });

  it('shows transaction type and positive amount for purchase', async () => {
    mockApiWithTokens([
      { id: 't1', transaction_type: 'purchase', amount: 500, balance_after: 500, description: null, created_at: '2026-01-15' },
    ]);
    const wrapper = mountDashboard();
    await flushPromises();

    const item = wrapper.find('[data-testid="token-item"]');
    expect(item.text()).toContain('Purchase');
    expect(item.text()).toContain('+500');
  });

  it('shows refund as negative amount', async () => {
    mockApiWithTokens([
      { id: 't1', transaction_type: 'refund', amount: -200, balance_after: 300, description: null, created_at: '2026-01-20' },
    ]);
    const wrapper = mountDashboard();
    await flushPromises();

    const item = wrapper.find('[data-testid="token-item"]');
    expect(item.text()).toContain('Refund');
    const amountEl = item.find('.token-amount');
    expect(amountEl.classes()).toContain('debit');
  });

  it('shows empty state when no transactions', async () => {
    mockApiWithTokens([]);
    const wrapper = mountDashboard();
    await flushPromises();

    const card = wrapper.find('[data-testid="token-history"]');
    expect(card.text()).toContain('dashboard.tokenHistoryCard.noActivity');
  });

  it('limits display to transactions returned by API', async () => {
    const txns = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`, transaction_type: 'purchase', amount: 100, balance_after: 100 * (i + 1),
      description: null, created_at: `2026-01-${String(i + 1).padStart(2, '0')}`
    }));
    mockApiWithTokens(txns);
    const wrapper = mountDashboard();
    await flushPromises();

    expect(wrapper.findAll('[data-testid="token-item"]')).toHaveLength(10);
  });
});
