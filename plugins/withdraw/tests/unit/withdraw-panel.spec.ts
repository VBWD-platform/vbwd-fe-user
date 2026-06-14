import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';

vi.mock('../../src/api', () => ({
  getProviders: vi.fn(),
  getBalance: vi.fn(),
  listRequests: vi.fn(),
  submitWithdraw: vi.fn(),
  getRequest: vi.fn(),
}));

import * as api from '../../src/api';
import en from '../../locales/en.json';
import WithdrawPanel from '../../src/components/WithdrawPanel.vue';

const providersPayload = {
  providers: [
    {
      name: 'paypal',
      destination_schema: [
        { name: 'email', type: 'email', label_key: 'withdraw.fields.paypal_email' },
      ],
    },
    {
      name: 'promptpay',
      destination_schema: [
        { name: 'proxy_id', type: 'text', label_key: 'withdraw.fields.promptpay_id' },
        { name: 'account_name', type: 'text', label_key: 'withdraw.fields.account_name' },
      ],
    },
  ],
  config: { currency: 'EUR', token_to_currency_rate: 0.05, min_withdraw_tokens: 10 },
};

function mockEndpoints(overrides: { balance?: number; requests?: unknown[] } = {}) {
  (api.getProviders as ReturnType<typeof vi.fn>).mockResolvedValue(providersPayload);
  (api.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue({
    balance: overrides.balance ?? 100,
  });
  (api.listRequests as ReturnType<typeof vi.fn>).mockResolvedValue({
    requests: overrides.requests ?? [],
  });
}

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(WithdrawPanel, {
    props,
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', messages: { en } }),
        createPinia(),
      ],
      stubs: { RouterLink: RouterLinkStub },
    },
  });
}

describe('WithdrawPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the balance and the converted money preview', async () => {
    mockEndpoints({ balance: 100 });
    const wrapper = mountPanel();
    await flushPromises();

    expect(wrapper.get('[data-testid="withdraw-balance"]').text()).toContain('100');
    // 100 tokens x 0.05 EUR = 5.00 EUR
    expect(wrapper.get('[data-testid="withdraw-money-preview"]').text()).toContain('5.00');
  });

  it('defaults to the core token balance endpoint and tokens source', async () => {
    mockEndpoints();
    mountPanel();
    await flushPromises();

    expect(api.getBalance).toHaveBeenCalledWith('/api/v1/user/tokens/balance');
  });

  it('honours the balanceEndpoint prop (S80 reuse)', async () => {
    mockEndpoints();
    mountPanel({ balanceEndpoint: '/api/v1/ghrm/earnings/balance' });
    await flushPromises();

    expect(api.getBalance).toHaveBeenCalledWith('/api/v1/ghrm/earnings/balance');
  });

  it('renders one radio per provider', async () => {
    mockEndpoints();
    const wrapper = mountPanel();
    await flushPromises();

    expect(wrapper.find('[data-testid="withdraw-provider-paypal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="withdraw-provider-promptpay"]').exists()).toBe(true);
  });

  it('generates the destination form from the selected provider schema', async () => {
    mockEndpoints();
    const wrapper = mountPanel();
    await flushPromises();

    await wrapper.get('[data-testid="withdraw-provider-paypal"]').setValue();
    const emailInput = wrapper.get('[data-testid="withdraw-dest-email"]');
    expect(emailInput.attributes('type')).toBe('email');
    expect(wrapper.find('[data-testid="withdraw-dest-proxy_id"]').exists()).toBe(false);

    await wrapper.get('[data-testid="withdraw-provider-promptpay"]').setValue();
    expect(wrapper.find('[data-testid="withdraw-dest-email"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="withdraw-dest-proxy_id"]').attributes('type')).toBe('text');
    expect(wrapper.find('[data-testid="withdraw-dest-account_name"]').exists()).toBe(true);
  });

  it('blocks an amount below the configured minimum', async () => {
    mockEndpoints({ balance: 100 });
    const wrapper = mountPanel();
    await flushPromises();

    await wrapper.get('[data-testid="withdraw-provider-paypal"]').setValue();
    await wrapper.get('[data-testid="withdraw-dest-email"]').setValue('user@example.com');
    await wrapper.get('[data-testid="withdraw-amount"]').setValue('5');

    expect(wrapper.get('[data-testid="withdraw-validation-error"]').text()).toBeTruthy();
    expect(
      wrapper.get('[data-testid="withdraw-submit"]').attributes('disabled'),
    ).toBeDefined();
  });

  it('blocks an amount above the balance', async () => {
    mockEndpoints({ balance: 100 });
    const wrapper = mountPanel();
    await flushPromises();

    await wrapper.get('[data-testid="withdraw-provider-paypal"]').setValue();
    await wrapper.get('[data-testid="withdraw-dest-email"]').setValue('user@example.com');
    await wrapper.get('[data-testid="withdraw-amount"]').setValue('200');

    expect(wrapper.get('[data-testid="withdraw-validation-error"]').text()).toBeTruthy();
    expect(
      wrapper.get('[data-testid="withdraw-submit"]').attributes('disabled'),
    ).toBeDefined();
  });

  it('shows the converted payout preview for a valid amount', async () => {
    mockEndpoints({ balance: 100 });
    const wrapper = mountPanel();
    await flushPromises();

    await wrapper.get('[data-testid="withdraw-provider-paypal"]').setValue();
    await wrapper.get('[data-testid="withdraw-amount"]').setValue('50');

    // 50 tokens x 0.05 EUR = 2.50 EUR
    expect(wrapper.get('[data-testid="withdraw-payout-preview"]').text()).toContain('2.50');
  });

  it('submits the exact payload including the default tokens balance_source', async () => {
    mockEndpoints({ balance: 100 });
    (api.submitWithdraw as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'wr-1',
      status: 'pending',
    });
    const wrapper = mountPanel();
    await flushPromises();

    await wrapper.get('[data-testid="withdraw-provider-paypal"]').setValue();
    await wrapper.get('[data-testid="withdraw-dest-email"]').setValue('user@example.com');
    await wrapper.get('[data-testid="withdraw-amount"]').setValue('50');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(api.submitWithdraw).toHaveBeenCalledWith({
      provider: 'paypal',
      amount: 50,
      destination: { email: 'user@example.com' },
      balance_source: 'tokens',
    });
    // History (and the debited balance) refresh after submit.
    expect(api.listRequests).toHaveBeenCalledTimes(2);
  });

  it('submits with the balanceSource prop value (S80 reuse)', async () => {
    mockEndpoints({ balance: 100 });
    (api.submitWithdraw as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'wr-2',
      status: 'pending',
    });
    const wrapper = mountPanel({
      balanceEndpoint: '/api/v1/ghrm/earnings/balance',
      balanceSource: 'earnings',
    });
    await flushPromises();

    await wrapper.get('[data-testid="withdraw-provider-paypal"]').setValue();
    await wrapper.get('[data-testid="withdraw-dest-email"]').setValue('user@example.com');
    await wrapper.get('[data-testid="withdraw-amount"]').setValue('50');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(api.submitWithdraw).toHaveBeenCalledWith(
      expect.objectContaining({ balance_source: 'earnings' }),
    );
  });

  it('shows failed and rejected requests in the history with their error text', async () => {
    mockEndpoints({
      requests: [
        {
          id: 'wr-failed',
          balance_source: 'tokens',
          amount: 50,
          payout_amount: 2.5,
          currency: 'EUR',
          provider: 'paypal',
          destination: { email: 'user@example.com' },
          status: 'failed',
          provider_payout_id: null,
          error: 'Provider declined the payout',
          created_at: '2026-06-11T10:00:00Z',
          updated_at: '2026-06-11T10:05:00Z',
        },
        {
          id: 'wr-rejected',
          balance_source: 'tokens',
          amount: 20,
          payout_amount: 1,
          currency: 'EUR',
          provider: 'promptpay',
          destination: { proxy_id: '0812345678' },
          status: 'rejected',
          provider_payout_id: null,
          error: 'Rejected by admin',
          created_at: '2026-06-10T10:00:00Z',
          updated_at: '2026-06-10T10:05:00Z',
        },
      ],
    });
    const wrapper = mountPanel();
    await flushPromises();

    expect(wrapper.find('[data-testid="withdraw-status-failed"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="withdraw-status-rejected"]').exists()).toBe(true);
    const historyText = wrapper.get('[data-testid="withdraw-history"]').text();
    expect(historyText).toContain('Provider declined the payout');
    expect(historyText).toContain('Rejected by admin');
  });

  it('links every history row to its canonical detail route', async () => {
    mockEndpoints({
      requests: [
        {
          id: 'wr-1',
          balance_source: 'tokens',
          amount: 50,
          payout_amount: 2.5,
          currency: 'EUR',
          provider: 'paypal',
          destination: { email: 'user@example.com' },
          status: 'pending',
          provider_payout_id: null,
          error: null,
          created_at: '2026-06-11T10:00:00Z',
          updated_at: '2026-06-11T10:00:00Z',
        },
      ],
    });
    const wrapper = mountPanel();
    await flushPromises();

    const rowLink = wrapper.findComponent(RouterLinkStub);
    expect(rowLink.exists()).toBe(true);
    expect(rowLink.props('to')).toBe('/withdraw/wr-1');
  });
});
