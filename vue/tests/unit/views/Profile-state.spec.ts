/**
 * State/Region address field — the fe-user profile form renders a State/Region
 * input bound to the model, populates it from GET /user/profile, and includes
 * `state` (alongside `postal_code`) in the PUT /user/details payload so the
 * address data is stored correctly.
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

describe('Profile — state/region address field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    mockGet.mockImplementation((url: string) => {
      if (url === '/user/profile') {
        return Promise.resolve({
          user: { id: 'u1', email: 'u@test.com' },
          details: { state: 'California', postal_code: '90001', city: 'LA' },
        });
      }
      if (url === '/settings/countries') return Promise.resolve({ countries: [] });
      if (url.includes('balance')) return Promise.resolve({ balance: 0 });
      return Promise.resolve({});
    });
    mockPut.mockResolvedValue({});
  });

  it('renders a State/Region input populated from the loaded details', async () => {
    const wrapper = mountComponent();
    await flushPromises();
    const input = wrapper.find('[data-testid="state-input"]');
    expect(input.exists()).toBe(true);
    expect((input.element as HTMLInputElement).value).toBe('California');
  });

  it('includes state and postal_code in the saved /user/details payload', async () => {
    const wrapper = mountComponent();
    await flushPromises();

    await wrapper.find('[data-testid="state-input"]').setValue('Nevada');
    await wrapper.find('[data-testid="postal-code-input"]').setValue('89001');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mockPut).toHaveBeenCalledWith(
      '/user/details',
      expect.objectContaining({ state: 'Nevada', postal_code: '89001' }),
    );
  });
});
