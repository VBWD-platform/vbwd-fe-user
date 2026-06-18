/**
 * S85.4 phase-2 — the subscription Plans catalog threads the authenticated
 * viewer's account_type into every <PriceDisplay>, so a business viewer gets
 * the netto overlay (D9) and an anonymous viewer keeps the global side.
 *
 * The view itself does no tax math; it only forwards the auth account_type and
 * the plan's net/gross/effective_display_mode to the shared PriceDisplay.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const mockAccountType = vi.fn<[], 'private' | 'business' | undefined>();

vi.mock('vbwd-view-component', () => ({
  useAuthStore: () => ({ user: { account_type: mockAccountType() } }),
  formatMoney: (amount: number) => String(amount),
  // PriceDisplay now wires the display-currency switch (S99.4), which pulls in
  // @/stores/appConfig → @/api → ApiClient + setOperatingCurrency. Stub them so
  // this partial mock keeps the module graph loadable (pitfall a).
  setOperatingCurrency: vi.fn(),
  ApiClient: class {
    get = vi.fn();
    post = vi.fn();
    put = vi.fn();
    delete = vi.fn();
    on = vi.fn();
    off = vi.fn();
  },
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const planPayload = {
  id: 'plan-1',
  name: 'Pro',
  slug: 'pro',
  display_currency: 'EUR',
  display_price: 119,
  billing_period: 'monthly',
  net_price: 100,
  gross_price: 119,
  tax_rate: 19,
  effective_display_mode: 'brutto' as const,
  prices_display_mode: 'brutto' as const,
};

vi.mock('../../../../plugins/subscription/subscription/stores/plans', () => ({
  usePlansStore: () => ({
    loading: false,
    error: null,
    plans: [planPayload],
    fetchPlans: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock('../../../../plugins/subscription/subscription/stores/subscription', () => ({
  useSubscriptionStore: () => ({
    subscription: null,
    fetchSubscription: vi.fn().mockResolvedValue({}),
  }),
}));

import Plans from '../../../../plugins/subscription/subscription/views/Plans.vue';

const priceDisplayProps: Array<Record<string, unknown>> = [];

function mountPlans() {
  priceDisplayProps.length = 0;
  setActivePinia(createPinia());
  return mount(Plans, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        PriceDisplay: {
          name: 'PriceDisplay',
          props: ['effectiveDisplayMode', 'globalMode', 'netAmount', 'grossAmount', 'currency', 'accountType'],
          setup(props: Record<string, unknown>) {
            priceDisplayProps.push(props);
            return () => null;
          },
        },
      },
    },
  });
}

describe('Plans — account_type threading (S85.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes account_type="business" to the plan PriceDisplay', async () => {
    mockAccountType.mockReturnValue('business');
    mountPlans();
    await flushPromises();
    expect(priceDisplayProps.length).toBeGreaterThan(0);
    expect(priceDisplayProps[0].accountType).toBe('business');
  });

  it('passes undefined account_type for an anonymous viewer (keeps global side)', async () => {
    mockAccountType.mockReturnValue(undefined);
    mountPlans();
    await flushPromises();
    expect(priceDisplayProps.length).toBeGreaterThan(0);
    expect(priceDisplayProps[0].accountType).toBeUndefined();
  });
});
