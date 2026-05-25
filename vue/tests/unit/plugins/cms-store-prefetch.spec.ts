import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCmsStore } from '../../../../plugins/cms/src/stores/useCmsStore';
import { api } from '@/api';

vi.mock('@/api', () => ({ api: { get: vi.fn() } }));

function mockApi() {
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url.startsWith('/cms/pages/')) {
      return { id: '1', slug: 'about', layout_id: 'L1', style_id: 'S1' } as never;
    }
    if (url.startsWith('/cms/layouts/')) return { id: 'L1', areas: [] } as never;
    if (url.startsWith('/cms/categories')) return { items: [] } as never;
    return {} as never;
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => '.vbwd{}' })));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prefetchPage', () => {
  it('caches page + layout + css and dedupes a second call', async () => {
    mockApi();
    const store = useCmsStore();
    await store.prefetchPage('about');
    expect(store.pageCache['about'].page).toBeTruthy();
    expect(store.layoutCache['L1']).toBeTruthy();
    expect(store.styleCssCache['S1']).toBe('.vbwd{}');

    const callsBefore = vi.mocked(api.get).mock.calls.length;
    await store.prefetchPage('about'); // already cached → no new fetch
    expect(vi.mocked(api.get).mock.calls.length).toBe(callsBefore);
  });

  it('negative-caches a failure and does not retry', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('404'));
    const store = useCmsStore();
    await store.prefetchPage('missing');
    expect('missing' in store.pageCache).toBe(true);
    expect(store.pageCache['missing'].page).toBeNull();

    const calls = vi.mocked(api.get).mock.calls.length;
    await store.prefetchPage('missing');
    expect(vi.mocked(api.get).mock.calls.length).toBe(calls);
  });
});

describe('fetchPage cache-first', () => {
  it('serves a cached page with no network and no spinner', async () => {
    const store = useCmsStore();
    store.categories = [{ id: 'c', name: 'C', slug: 'c' }] as never;
    store.pageCache['about'] = {
      page: { id: '1', slug: 'about' } as never,
      layout: { id: 'L1' } as never,
      css: '.vbwd{}',
    };

    await store.fetchPage('about');

    expect(api.get).not.toHaveBeenCalled();
    expect(store.currentPage?.slug).toBe('about');
    expect(store.currentStyleCss).toBe('.vbwd{}');
    expect(store.loading).toBe(false);
  });

  it('on a cache miss, fetches and warms the cache', async () => {
    mockApi();
    const store = useCmsStore();
    store.categories = [{ id: 'c', name: 'C', slug: 'c' }] as never;
    await store.fetchPage('about');
    expect(store.currentPage).toBeTruthy();
    expect(store.pageCache['about'].page).toBeTruthy();
  });
});
