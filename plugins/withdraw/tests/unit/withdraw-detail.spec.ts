import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
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
import WithdrawRequestDetail from '../../src/views/WithdrawRequestDetail.vue';

const failedRequest = {
  id: 'wr-1',
  balance_source: 'tokens',
  amount: 50,
  payout_amount: 2.5,
  currency: 'EUR',
  provider: 'paypal',
  destination: { email: 'user@example.com' },
  status: 'failed',
  provider_payout_id: 'po-123',
  error: 'Provider declined the payout',
  created_at: '2026-06-11T10:00:00Z',
  updated_at: '2026-06-11T10:05:00Z',
};

function mountDetail(id = 'wr-1') {
  return mount(WithdrawRequestDetail, {
    props: { id },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: { RouterLink: RouterLinkStub },
    },
  });
}

describe('WithdrawRequestDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the request by id and renders every field', async () => {
    (api.getRequest as ReturnType<typeof vi.fn>).mockResolvedValue(failedRequest);
    const wrapper = mountDetail('wr-1');
    await flushPromises();

    expect(api.getRequest).toHaveBeenCalledWith('wr-1');
    expect(wrapper.get('[data-testid="withdraw-detail-id"]').text()).toContain('wr-1');
    expect(wrapper.get('[data-testid="withdraw-detail-provider"]').text()).toContain('paypal');
    expect(wrapper.get('[data-testid="withdraw-detail-amount"]').text()).toContain('50');
    expect(wrapper.get('[data-testid="withdraw-detail-payout"]').text()).toContain('2.5');
    expect(wrapper.get('[data-testid="withdraw-detail-balance-source"]').text()).toContain('tokens');
    expect(wrapper.get('[data-testid="withdraw-detail-status"]').text()).toBeTruthy();
    expect(wrapper.get('[data-testid="withdraw-detail-destination"]').text()).toContain(
      'user@example.com',
    );
    expect(wrapper.get('[data-testid="withdraw-detail-payout-id"]').text()).toContain('po-123');
    expect(wrapper.get('[data-testid="withdraw-detail-error"]').text()).toContain(
      'Provider declined the payout',
    );
  });

  it('shows a not-found message when the request cannot be loaded', async () => {
    (api.getRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Not found'));
    const wrapper = mountDetail('wr-missing');
    await flushPromises();

    expect(wrapper.find('[data-testid="withdraw-detail-not-found"]').exists()).toBe(true);
  });
});
