import type { IPlugin } from 'vbwd-view-component';
import pluginsManifest from '@plugins/plugins.json';

/**
 * Plugin Registry - Controls which plugins are loaded
 *
 * Plugins are discovered dynamically from plugins.json.
 * Only enabled plugins are loaded and registered.
 * Core does NOT import from plugins — plugins depend on core.
 *
 * To add a new plugin:
 * 1. Create the plugin in /plugins/{name}/
 * 2. Export the plugin from index.ts (default or named export)
 * 3. Add entry to plugins.json with enabled: true
 */

interface PluginManifest {
  plugins: Record<string, {
    enabled: boolean;
    version: string;
    installedAt: string;
    source: string;
  }>;
}

// Vite statically analyses import.meta.glob at build time and includes all
// matching modules in the bundle — no runtime dynamic import needed.
const pluginModules = import.meta.glob<any>('../../../plugins/*/index.ts', { eager: false });

/**
 * Get enabled plugins based on plugins.json configuration.
 * Plugins are dynamically loaded; only enabled ones are instantiated.
 */
export async function getEnabledPlugins(): Promise<IPlugin[]> {
  try {
    const manifest: PluginManifest = pluginsManifest as PluginManifest;
    const enabledPlugins: IPlugin[] = [];

    for (const [pluginName, pluginConfig] of Object.entries(manifest.plugins)) {
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
        // (has an `install` method). This supports both export styles without forcing every
        // plugin to change its export signature.
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
 */
export function getEnabledPluginNames(): Set<string> {
  try {
    const manifest: PluginManifest = pluginsManifest as PluginManifest;
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
