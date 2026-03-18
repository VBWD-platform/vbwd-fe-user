import { createVbwdUserApp } from './factory';
import { getEnabledPlugins } from '@/utils/pluginLoader';

(async () => {
  try {
    // Load plugins from local plugins/ directory (Vite glob)
    let plugins = [];
    try {
      plugins = await getEnabledPlugins();
      console.warn(`[VBWD] Using ${plugins.length} enabled plugin(s)`);
    } catch (error) {
      console.error('[VBWD] Failed to load plugins, continuing without plugins:', error);
    }

    const { mount } = await createVbwdUserApp({ plugins });
    mount('#app');
  } catch (err) {
    console.error('[VBWD] App bootstrap failed:', err);
  }
})();
