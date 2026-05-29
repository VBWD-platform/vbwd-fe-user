/**
 * Wire every plugin-registered router guard into the host Vue Router.
 *
 * Called from factory.ts after `registry.installAll(sdk)` so any plugin
 * that registered via `sdk.addRouterGuard(...)` gets its guard attached
 * to `router.beforeEach` in installation order.
 *
 * The host stays plugin-agnostic — it does not know what a guard does,
 * only that it should fire before each navigation. Each guard is
 * adapted from the SDK's narrow `INavigationGuard` shape to vue-router's
 * NavigationGuard via a thin wrapper that calls `next(...)` with the
 * guard's return value.
 */
import type { Router, RouteLocationNormalized } from 'vue-router';
import type { PlatformSDK, INavigationGuard, IRouteLocation } from 'vbwd-view-component';

function toSdkLocation(loc: RouteLocationNormalized): IRouteLocation {
  return {
    path: loc.path,
    fullPath: loc.fullPath,
    name: loc.name,
    params: loc.params as Record<string, string | string[]>,
    query: loc.query as Record<string, string | string[] | null>,
    meta: loc.meta as Record<string, unknown>,
  };
}

export function wireRouterGuards(router: Router, sdk: PlatformSDK): void {
  for (const guard of sdk.getRouterGuards()) {
    attachGuard(router, guard);
  }
}

function attachGuard(router: Router, guard: INavigationGuard): void {
  router.beforeEach(async (to, from) => {
    const result = await guard(toSdkLocation(to), toSdkLocation(from));
    // void / undefined → continue (Vue Router treats `return undefined` as `next()`)
    // false → cancel
    // string → redirect to path
    // { path, replace } → redirect to location
    return result === undefined ? undefined : (result as ReturnType<NonNullable<Parameters<Router['beforeEach']>[0]>>);
  });
}
