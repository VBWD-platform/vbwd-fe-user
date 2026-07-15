import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ApiError } from 'vbwd-view-component';
import { installCmsMaintenanceDetector } from '../../../src/api/cmsMaintenance';
import { useMaintenanceStore } from '../../../src/stores/maintenance';

/**
 * The CMS maintenance detector observes every request routed through the
 * shared api client. When a CMS endpoint (`/cms/...`) answers with the
 * license-blocked status 402, it flips the maintenance store ON. When a CMS
 * endpoint answers successfully, it clears maintenance (recovery). Non-CMS
 * requests and non-402 errors must never touch the maintenance state.
 */
describe('installCmsMaintenanceDetector', () => {
  let getImpl: (url: string) => Promise<unknown>;

  function makeClient() {
    // A stand-in for the shared api client: obeys the same request-method
    // contract the detector wraps (get/post/put/patch/delete). Every method
    // routes through the per-test `getImpl` so a single spy drives the case.
    const request = (url: string) => getImpl(url);
    const client = {
      get: request,
      post: request,
      put: request,
      patch: request,
      delete: request,
    };
    installCmsMaintenanceDetector(client as never);
    return client;
  }

  beforeEach(() => {
    setActivePinia(createPinia());
    getImpl = vi.fn(async () => ({}));
  });

  it('flips maintenance active on a 402 from a CMS endpoint', async () => {
    getImpl = vi.fn(async () => {
      throw new ApiError('License required', 402);
    });
    const client = makeClient();

    await expect(client.get('/cms/config')).rejects.toBeInstanceOf(ApiError);

    expect(useMaintenanceStore().active).toBe(true);
  });

  it('leaves maintenance inactive on a successful CMS response', async () => {
    getImpl = vi.fn(async () => ({ home_slug: 'index' }));
    const client = makeClient();

    await client.get('/cms/config');

    expect(useMaintenanceStore().active).toBe(false);
  });

  it('clears maintenance when a later CMS call succeeds (recovery)', async () => {
    const store = useMaintenanceStore();
    store.activate();

    getImpl = vi.fn(async () => ({ home_slug: 'index' }));
    const client = makeClient();

    await client.get('/cms/posts/index');

    expect(store.active).toBe(false);
  });

  it('does NOT trigger maintenance on a non-402 CMS error (e.g. 500)', async () => {
    getImpl = vi.fn(async () => {
      throw new ApiError('Internal Server Error', 500);
    });
    const client = makeClient();

    await expect(client.get('/cms/config')).rejects.toBeInstanceOf(ApiError);

    expect(useMaintenanceStore().active).toBe(false);
  });

  it('does NOT trigger maintenance on a 402 from a non-CMS endpoint', async () => {
    getImpl = vi.fn(async () => {
      throw new ApiError('License required', 402);
    });
    const client = makeClient();

    await expect(client.get('/config')).rejects.toBeInstanceOf(ApiError);

    expect(useMaintenanceStore().active).toBe(false);
  });
});
