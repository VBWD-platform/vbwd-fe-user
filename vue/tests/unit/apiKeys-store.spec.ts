import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useApiKeysStore } from '@/stores/apiKeys';
import { api } from '@/api';

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('fe-user self-service ApiKeysStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('fetches own keys from the self-service endpoint', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      api_keys: [{ id: 'k1', label: 'x', key_prefix: 'vbwdk_a', scopes: [], ip_whitelist: [], is_active: true }],
    });
    const store = useApiKeysStore();
    await store.fetchKeys();
    expect(api.get).toHaveBeenCalledWith('/api-keys');
    expect(store.keys).toHaveLength(1);
  });

  it('fetches user-grantable scopes from the self-service endpoint', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      scopes: { core: [], cms: [{ key: 'cms:posts:create', label: 'C', user_grantable: true }] },
    });
    const store = useApiKeysStore();
    await store.fetchScopes();
    expect(api.get).toHaveBeenCalledWith('/api-keys/scopes');
    expect(store.scopes.map((s) => s.key)).toContain('cms:posts:create');
  });

  it('creates an own key and captures the one-time plaintext', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      api_key: { id: 'k2', label: 'CI', key_prefix: 'vbwdk_b', scopes: [], ip_whitelist: [], is_active: true, plaintext: 'vbwdk_secret' },
    });
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ api_keys: [] });
    const store = useApiKeysStore();
    await store.createKey({ label: 'CI', scopes: ['cms:posts:create'], ipWhitelist: ['10.0.0.1'] });
    expect(api.post).toHaveBeenCalledWith('/api-keys', {
      label: 'CI',
      scopes: ['cms:posts:create'],
      ip_whitelist: ['10.0.0.1'],
    });
    expect(store.createdPlaintext).toBe('vbwdk_secret');
  });

  it('revokes an own key then refreshes', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ api_keys: [] });
    const store = useApiKeysStore();
    await store.revokeKey('k1');
    expect(api.post).toHaveBeenCalledWith('/api-keys/k1/revoke');
  });

  it('deletes an own key then refreshes', async () => {
    (api.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ api_keys: [] });
    const store = useApiKeysStore();
    await store.deleteKey('k1');
    expect(api.delete).toHaveBeenCalledWith('/api-keys/k1');
  });

  it('clears the one-time plaintext', () => {
    const store = useApiKeysStore();
    store.createdPlaintext = 'x';
    store.dismissPlaintext();
    expect(store.createdPlaintext).toBeNull();
  });
});
