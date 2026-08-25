/**
 * BillingAddressBlock carries a State/Region field alongside city/zip. It
 * renders the input, loads the saved `state` from GET /user/details, and
 * includes `state` in the emitted address change so downstream checkout can
 * persist it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const mockGet = vi.fn();

vi.mock('@/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
  isAuthenticated: () => true,
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import BillingAddressBlock from '@/components/checkout/BillingAddressBlock.vue';

function mountComponent() {
  return mount(BillingAddressBlock, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe('BillingAddressBlock — state/region field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url === '/settings/countries') return Promise.resolve({ countries: [] });
      if (url === '/user/details') {
        return Promise.resolve({
          first_name: 'Ada',
          last_name: 'Lovelace',
          city: 'LA',
          state: 'California',
          postal_code: '90001',
          country: 'US',
        });
      }
      return Promise.resolve({});
    });
  });

  it('renders the state input populated from saved details', async () => {
    const wrapper = mountComponent();
    await flushPromises();
    const input = wrapper.find('[data-testid="billing-state"]');
    expect(input.exists()).toBe(true);
    expect((input.element as HTMLInputElement).value).toBe('California');
  });

  it('emits state as part of the address change payload', async () => {
    const wrapper = mountComponent();
    await flushPromises();

    await wrapper.find('[data-testid="billing-state"]').setValue('Nevada');
    await flushPromises();

    const changes = wrapper.emitted('change');
    expect(changes).toBeTruthy();
    const last = changes![changes!.length - 1][0] as Record<string, string>;
    expect(last.state).toBe('Nevada');
  });
});
