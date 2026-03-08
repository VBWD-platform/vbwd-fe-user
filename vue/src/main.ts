import { createApp, reactive } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { initializeApi } from '@/api';
import i18n, { initLocale } from '@/i18n';
import { PluginRegistry, PlatformSDK } from 'vbwd-view-component';
import type { IPlugin } from 'vbwd-view-component';
import { getEnabledPlugins } from '@/utils/pluginLoader';

// Initialize API with stored auth token before mounting app
initializeApi();

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);

// Initialize locale from stored preference
initLocale();

// Bootstrap plugins then mount
(async () => {
  try {
    const registry = new PluginRegistry();
    const sdk = new PlatformSDK(i18n);

    // Get enabled plugins based on plugins.json configuration
    let plugins: IPlugin[] = [];
    try {
      plugins = await getEnabledPlugins();
      console.log(`[VBWD] Using ${plugins.length} enabled plugin(s)`);
    } catch (error) {
      console.error('[VBWD] Failed to load plugins, continuing without plugins:', error);
    }

    // Build set of enabled plugin names for nav visibility
    const enabledPluginNames = reactive(new Set<string>(
      plugins.map(plugin => plugin.name)
    ));

    // Register and install all loaded plugins
    for (const plugin of plugins) {
      registry.register(plugin);
    }

    await registry.installAll(sdk);

    // Inject plugin routes into the router (only enabled plugins' routes)
    for (const route of sdk.getRoutes()) {
      router.addRoute(route as Parameters<typeof router.addRoute>[0]);
    }

    // Add catch-all 404 AFTER plugin routes so dynamic routes are matched first
    router.addRoute({
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('./views/NotFound.vue'),
      meta: { requiresAuth: false }
    });

    // Activate all registered plugins (they're all enabled)
    for (const name of enabledPluginNames) {
      await registry.activate(name);
    }

    // Make available via provide/inject
    app.provide('pluginRegistry', registry);
    app.provide('platformSDK', sdk);
    app.provide('enabledPlugins', enabledPluginNames);

    // Re-resolve current URL so dynamically added routes are matched
    await router.replace(location.pathname + location.search + location.hash);
  } catch (err) {
    console.error('[VBWD] Plugin bootstrap failed:', err);
  }

  app.mount('#app');
})();
