import { describe, it, expect, vi } from 'vitest';
import { createRouter, createMemoryHistory, type RouteRecordRaw } from 'vue-router';
import { PlatformSDK } from 'vbwd-view-component';
import type { INavigationGuard } from 'vbwd-view-component';
import { wireRouterGuards } from '../../../src/router/wireGuards';

function makeRouter() {
  const routes: RouteRecordRaw[] = [
    { path: '/', name: 'home', component: { template: '<div>home</div>' } },
    { path: '/dashboard', name: 'dashboard', component: { template: '<div>dash</div>' } },
    { path: '/home-page', name: 'home-page', component: { template: '<div>cms</div>' } },
    { path: '/:slug(.+)', name: 'cms-page', component: { template: '<div>cms</div>' } },
  ];
  return createRouter({ history: createMemoryHistory(), routes });
}

describe('wireRouterGuards', () => {
  it('attaches every registered guard to router.beforeEach', async () => {
    const router = makeRouter();
    const sdk = new PlatformSDK();
    const guard: INavigationGuard = vi.fn(() => undefined);
    sdk.addRouterGuard(guard);

    wireRouterGuards(router, sdk);
    await router.push('/dashboard');

    expect(guard).toHaveBeenCalledOnce();
    expect((guard as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      path: '/dashboard',
      name: 'dashboard',
    });
  });

  it('treats undefined as continue', async () => {
    const router = makeRouter();
    const sdk = new PlatformSDK();
    sdk.addRouterGuard(() => undefined);

    wireRouterGuards(router, sdk);
    await router.push('/dashboard');

    expect(router.currentRoute.value.path).toBe('/dashboard');
  });

  it('redirects when the guard returns a path string', async () => {
    const router = makeRouter();
    const sdk = new PlatformSDK();
    sdk.addRouterGuard((to) => {
      if (to.path === '/test') return '/home-page';
      return undefined;
    });

    wireRouterGuards(router, sdk);
    await router.push('/test');

    expect(router.currentRoute.value.path).toBe('/home-page');
  });

  it('redirects when the guard returns a location object', async () => {
    const router = makeRouter();
    const sdk = new PlatformSDK();
    sdk.addRouterGuard((to) => {
      if (to.path === '/test') return { path: '/home-page' };
      return undefined;
    });

    wireRouterGuards(router, sdk);
    await router.push('/test');

    expect(router.currentRoute.value.path).toBe('/home-page');
  });

  it('runs multiple guards in installation order', async () => {
    const router = makeRouter();
    const sdk = new PlatformSDK();
    const callOrder: string[] = [];
    sdk.addRouterGuard(() => { callOrder.push('first'); return undefined; });
    sdk.addRouterGuard(() => { callOrder.push('second'); return undefined; });
    sdk.addRouterGuard(() => { callOrder.push('third'); return undefined; });

    wireRouterGuards(router, sdk);
    await router.push('/dashboard');

    expect(callOrder).toEqual(['first', 'second', 'third']);
  });

  it('does nothing when no guards are registered', async () => {
    const router = makeRouter();
    const sdk = new PlatformSDK();

    wireRouterGuards(router, sdk);
    await router.push('/dashboard');

    expect(router.currentRoute.value.path).toBe('/dashboard');
  });
});
