/**
 * S99 — the view-only display-currency switcher lives in Profile → Preferences
 * (moved out of the sidebar). It renders only when the operator offers >= 2
 * active currencies, and selecting one updates the display-currency store
 * (which is view-only — it never touches billing/checkout/invoices).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('@/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    post: vi.fn(),
  },
}));
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } }),
}));
vi.mock('@/i18n', () => ({ setLocale: vi.fn() }));
vi.mock('@/registries/profileSectionsRegistry', () => ({ getProfileSections: () => [] }));

import Profile from '@/views/Profile.vue';
import { useAppConfigStore } from '@/stores/appConfig';
import { useDisplayCurrencyStore } from '@/stores/displayCurrency';

function seedApi(activeCurrencies: string[]) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/user/profile') {
      return Promise.resolve({ user: { id: 'u1', email: 'u@test.com' }, details: {} });
    }
    if (url === '/settings/countries') return Promise.resolve({ countries: [] });
    if (url.includes('balance')) return Promise.resolve({ balance: 0 });
    if (url === '/config') {
      return Promise.resolve({
        default_currency: 'EUR',
        prices_display_mode: 'brutto',
        prices_mode_in_db: 'NETTO',
        base_currency: 'EUR',
        active_currencies: activeCurrencies,
        currency_rates: { EUR: '1.00000000', USD: '1.08000000' },
      });
    }
    return Promise.resolve({});
  });
  mockPut.mockResolvedValue({});
}

async function mountWithCurrencies(activeCurrencies: string[]) {
  const pinia = createPinia();
  setActivePinia(pinia);
  seedApi(activeCurrencies);
  // App.vue normally loads the config app-wide; do it here for the isolated mount.
  await useAppConfigStore().load();
  const wrapper = mount(Profile, {
    global: {
      plugins: [pinia],
      mocks: { $t: (key: string) => key },
      stubs: { 'router-link': { template: '<a><slot /></a>', props: ['to'] } },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('Profile — display-currency preference (S99)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('vbwd_display_currency');
  });

  it('renders the display-currency select when >= 2 active currencies', async () => {
    const wrapper = await mountWithCurrencies(['EUR', 'USD']);
    const select = wrapper.find('[data-testid="display-currency-select"]');
    expect(select.exists()).toBe(true);
    expect((select.element as HTMLSelectElement).value).toBe('EUR');
  });

  it('hides the select when only one currency is active', async () => {
    const wrapper = await mountWithCurrencies(['EUR']);
    expect(wrapper.find('[data-testid="display-currency-select"]').exists()).toBe(false);
  });

  it('selecting a currency updates the (view-only) display store', async () => {
    const wrapper = await mountWithCurrencies(['EUR', 'USD']);
    await wrapper.find('[data-testid="display-currency-select"]').setValue('USD');
    expect(useDisplayCurrencyStore().code).toBe('USD');
    expect(localStorage.getItem('vbwd_display_currency')).toBe('USD');
  });
});
