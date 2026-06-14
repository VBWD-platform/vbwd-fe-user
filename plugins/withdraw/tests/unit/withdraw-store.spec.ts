import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('../../src/api', () => ({
  getProviders: vi.fn(),
  getBalance: vi.fn(),
  listRequests: vi.fn(),
  submitWithdraw: vi.fn(),
  getRequest: vi.fn(),
}));

import * as api from '../../src/api';
import { useWithdrawStore } from '../../src/stores/useWithdrawStore';

const providersPayload = {
  providers: [
    {
      name: 'paypal',
      destination_schema: [
        { name: 'email', type: 'email', label_key: 'withdraw.fields.paypal_email' },
      ],
    },
  ],
  config: { currency: 'EUR', token_to_currency_rate: 0.05, min_withdraw_tokens: 10 },
};

describe('withdraw store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loadProviders fills providers and config from the endpoint', async () => {
    (api.getProviders as ReturnType<typeof vi.fn>).mockResolvedValue(providersPayload);
    const store = useWithdrawStore();

    await store.loadProviders();

    expect(store.providers).toHaveLength(1);
    expect(store.providers[0].name).toBe('paypal');
    expect(store.config?.token_to_currency_rate).toBe(0.05);
    expect(store.config?.min_withdraw_tokens).toBe(10);
    expect(store.config?.currency).toBe('EUR');
  });

  it('loadBalance hits the given endpoint and stores the balance', async () => {
    (api.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue({ balance: 250 });
    const store = useWithdrawStore();

    await store.loadBalance('/api/v1/ghrm/earnings/balance');

    expect(api.getBalance).toHaveBeenCalledWith('/api/v1/ghrm/earnings/balance');
    expect(store.balance).toBe(250);
  });

  it('submit posts the exact payload (incl. balance_source) and refreshes requests', async () => {
    (api.submitWithdraw as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'wr-1',
      status: 'pending',
    });
    (api.listRequests as ReturnType<typeof vi.fn>).mockResolvedValue({
      requests: [{ id: 'wr-1', status: 'pending' }],
    });
    const store = useWithdrawStore();

    const created = await store.submit({
      provider: 'paypal',
      amount: 50,
      destination: { email: 'user@example.com' },
      balanceSource: 'earnings',
    });

    expect(api.submitWithdraw).toHaveBeenCalledWith({
      provider: 'paypal',
      amount: 50,
      destination: { email: 'user@example.com' },
      balance_source: 'earnings',
    });
    expect(created?.id).toBe('wr-1');
    expect(api.listRequests).toHaveBeenCalledTimes(1);
    expect(store.requests).toHaveLength(1);
    expect(store.error).toBeNull();
  });

  it('submit surfaces the backend error and does not refresh requests', async () => {
    (api.submitWithdraw as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Insufficient balance'),
    );
    const store = useWithdrawStore();

    const created = await store.submit({
      provider: 'paypal',
      amount: 5000,
      destination: { email: 'user@example.com' },
      balanceSource: 'tokens',
    });

    expect(created).toBeNull();
    expect(store.error).toBe('Insufficient balance');
    expect(store.submitting).toBe(false);
    expect(api.listRequests).not.toHaveBeenCalled();
  });
});
