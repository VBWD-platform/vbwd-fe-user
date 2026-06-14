/**
 * S74 — the fe-user profile/billing form carries an account-type select.
 * Selecting "Business" reveals + requires the Company field, and the saved
 * payload to /user/details carries account_type.
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

vi.mock('@/i18n', () => ({
  setLocale: vi.fn(),
}));

vi.mock('@/registries/profileSectionsRegistry', () => ({
  getProfileSections: () => [],
}));

import Profile from '@/views/Profile.vue';

function mountComponent() {
  return mount(Profile, {
    global: {
      plugins: [createPinia()],
      mocks: { $t: (key: string) => key },
      stubs: { 'router-link': { template: '<a><slot /></a>', props: ['to'] } },
    },
  });
}

describe('Profile — account type (S74)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    mockGet.mockImplementation((url: string) => {
      if (url === '/user/profile') {
        return Promise.resolve({ user: { id: 'u1', email: 'u@test.com' }, details: {} });
      }
      if (url === '/settings/countries') return Promise.resolve({ countries: [] });
      if (url.includes('balance')) return Promise.resolve({ balance: 0 });
      return Promise.resolve({});
    });
    mockPut.mockResolvedValue({});
  });

  it('renders the account-type select defaulting to private', async () => {
    const wrapper = mountComponent();
    await flushPromises();
    const select = wrapper.find('[data-testid="account-type-select"]');
    expect(select.exists()).toBe(true);
    expect((select.element as HTMLSelectElement).value).toBe('private');
  });

  it('hides the business fields while private', async () => {
    const wrapper = mountComponent();
    await flushPromises();
    const business = wrapper.find('[data-testid="business-fields"]');
    expect((business.element as HTMLElement).style.display).toBe('none');
  });

  it('reveals the company field when Business is selected', async () => {
    const wrapper = mountComponent();
    await flushPromises();
    await wrapper.find('[data-testid="account-type-select"]').setValue('business');
    const business = wrapper.find('[data-testid="business-fields"]');
    expect((business.element as HTMLElement).style.display).not.toBe('none');
    expect(wrapper.find('[data-testid="company-input"]').exists()).toBe(true);
  });

  it('blocks saving a business account without a company', async () => {
    const wrapper = mountComponent();
    await flushPromises();
    await wrapper.find('[data-testid="account-type-select"]').setValue('business');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('saves account_type with the company when valid', async () => {
    const wrapper = mountComponent();
    await flushPromises();
    await wrapper.find('[data-testid="account-type-select"]').setValue('business');
    await wrapper.find('[data-testid="company-input"]').setValue('Acme Corp');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(mockPut).toHaveBeenCalledWith(
      '/user/details',
      expect.objectContaining({ account_type: 'business', company: 'Acme Corp' }),
    );
  });
});
