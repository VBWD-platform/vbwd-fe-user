import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import ManageApi from '@/views/ManageApi.vue';
import { api } from '@/api';

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

function mountView() {
  return mount(ManageApi, {
    global: {
      plugins: [getActivePinia()!],
      stubs: {
        ApiKeysManager: {
          name: 'ApiKeysManager',
          template: '<div data-testid="api-keys-manager-stub" />',
        },
      },
      mocks: { $t: (key: string) => key },
    },
  });
}

describe('ManageApi view (S52.7)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api-keys/scopes') {
        return Promise.resolve({ scopes: { core: [], cms: [{ key: 'cms:posts:create', label: 'C', user_grantable: true }] } });
      }
      return Promise.resolve({ api_keys: [] });
    });
  });

  it('mounts the shared ApiKeysManager and loads own keys + grantable scopes', async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.find('[data-testid="api-keys-manager-stub"]').exists()).toBe(true);
    expect(api.get).toHaveBeenCalledWith('/api-keys/scopes');
    expect(api.get).toHaveBeenCalledWith('/api-keys');
  });
});
