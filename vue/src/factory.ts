/**
 * Factory function to create and configure the VBWD User App.
 *
 * Used by:
 * - SDK developers: called from main.ts with local plugin glob
 * - Platform users: called from their own main.ts with their plugins
 */
import { createApp, reactive, type App } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import AppComponent from './App.vue';
import router from './router';
import { initializeApi } from '@/api';
import i18n, { initLocale } from '@/i18n';
import { PluginRegistry, PlatformSDK } from 'vbwd-view-component';
import type { IPlugin } from 'vbwd-view-component';
import type { Router } from 'vue-router';

export interface VbwdUserAppOptions {
  plugins?: IPlugin[];
  mountSelector?: string;
}

export interface VbwdUserAppInstance {
  app: App;
  router: Router;
  pinia: Pinia;
  registry: PluginRegistry;
  sdk: PlatformSDK;
  mount: (selector?: string) => void;
}

export async function createVbwdUserApp(
  options: VbwdUserAppOptions = {}
): Promise<VbwdUserAppInstance> {
  const { plugins = [], mountSelector = '#app' } = options;

  // Initialize API with stored auth token
  initializeApi();

  const app = createApp(AppComponent);
  const pinia = createPinia();

  app.use(pinia);
  app.use(router);
  app.use(i18n);

  // Initialize locale from stored preference
  initLocale();

  // Plugin system
  const registry = new PluginRegistry();
  const sdk = new PlatformSDK(i18n);

  // Build set of enabled plugin names for nav visibility
  const enabledPluginNames = reactive(new Set<string>(
    plugins.map(plugin => plugin.name)
  ));

  // Register and install all plugins
  for (const plugin of plugins) {
    registry.register(plugin);
  }

  await registry.installAll(sdk);

  // Inject plugin routes into the router
  for (const route of sdk.getRoutes()) {
    router.addRoute(route as Parameters<typeof router.addRoute>[0]);
  }

  // Add catch-all 404 AFTER plugin routes
  router.addRoute({
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('./views/NotFound.vue'),
    meta: { requiresAuth: false }
  });

  // Activate all registered plugins
  for (const name of enabledPluginNames) {
    await registry.activate(name);
  }

  // Make available via provide/inject
  app.provide('pluginRegistry', registry);
  app.provide('platformSDK', sdk);
  app.provide('enabledPlugins', enabledPluginNames);

  // Re-resolve current URL so dynamically added routes are matched
  await router.replace(location.pathname + location.search + location.hash);

  const mount = (selector?: string) => {
    app.mount(selector || mountSelector);
  };

  return { app, router, pinia, registry, sdk, mount };
}
