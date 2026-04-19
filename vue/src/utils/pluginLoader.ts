import type { IPlugin, PluginManifest } from 'vbwd-view-component';
import { fetchPluginManifest } from 'vbwd-view-component';
import buildTimeManifest from '@plugins/plugins.json';

/**
 * Plugin Registry - Controls which plugins are loaded
 *
 * Plugins are discovered via Vite's import.meta.glob at build time (all
 * plugin code is in the bundle). The **manifest** (which plugins to activate)
 * is fetched at runtime from /plugins.json, falling back to the build-time
 * import when the fetch fails (e.g., dev server without a mounted file).
 *
 * To add a new plugin:
 * 1. Create the plugin in /plugins/{name}/
 * 2. Export the plugin from index.ts (default or named export)
 * 3. Add entry to plugins.json with enabled: true
 */

// Vite statically analyses import.meta.glob at build time and includes all
// matching modules in the bundle — no runtime dynamic import needed.
const pluginModules = import.meta.glob<any>('../../../plugins/*/index.ts', { eager: false });

/** Cached manifest after first load */
let cachedManifest: PluginManifest | null = null;

/**
 * Get enabled plugins based on runtime manifest.
 * Fetches /plugins.json at runtime; falls back to build-time manifest.
 * Plugins are dynamically loaded; only enabled ones are instantiated.
 */
export async function getEnabledPlugins(): Promise<IPlugin[]> {
  try {
    cachedManifest = await fetchPluginManifest('/plugins.json', buildTimeManifest as PluginManifest);
    const enabledPlugins: IPlugin[] = [];

    for (const [pluginName, pluginConfig] of Object.entries(cachedManifest.plugins)) {
      if (!pluginConfig.enabled) {
        console.warn(`[PluginRegistry] Skipping disabled plugin: ${pluginName}`);
        continue;
      }

      // Find the module loader for this plugin
      const matchingKey = Object.keys(pluginModules).find(key =>
        key.includes(`/${pluginName}/index.ts`)
      );

      if (!matchingKey) {
        console.warn(`[PluginRegistry] Plugin module not found for: ${pluginName}`);
        continue;
      }

      try {
        const pluginModule = await pluginModules[matchingKey]();

        // Prefer default export; fall back to the first named export that satisfies IPlugin
        const plugin: IPlugin =
          pluginModule.default ??
          (Object.values(pluginModule) as unknown[]).find(
            (v): v is IPlugin => !!v && typeof v === 'object' && typeof (v as IPlugin).install === 'function'
          );

        if (!plugin) {
          console.warn(`[PluginRegistry] Plugin '${pluginName}' has no IPlugin export. Skipping.`);
          continue;
        }

        console.warn(`[PluginRegistry] Loaded plugin: ${plugin.name} v${plugin.version}`);
        enabledPlugins.push(plugin);
      } catch (error) {
        console.warn(`[PluginRegistry] Failed to load plugin '${pluginName}':`, error);
      }
    }

    console.warn(`[PluginRegistry] Total enabled plugins: ${enabledPlugins.length}`);
    return enabledPlugins;
  } catch (error) {
    console.error('[PluginRegistry] Failed to get enabled plugins:', error);
    return [];
  }
}

/**
 * Get list of enabled plugin names from manifest.
 * Uses cached runtime manifest if available, otherwise falls back to build-time.
 */
export function getEnabledPluginNames(): Set<string> {
  try {
    const manifest = cachedManifest ?? (buildTimeManifest as PluginManifest);
    return new Set(
      Object.entries(manifest.plugins)
        .filter(([, config]) => config.enabled)
        .map(([name]) => name)
    );
  } catch (error) {
    console.error('[PluginRegistry] Failed to get enabled plugin names:', error);
    return new Set();
  }
}
