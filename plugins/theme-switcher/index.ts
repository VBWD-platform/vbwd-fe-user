import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';
import { userNavRegistry } from '@/plugins/userNavRegistry';
import { themePresets } from './presets';
import { applyTheme } from './apply-theme';
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import ru from './locales/ru.json';
import th from './locales/th.json';
import zh from './locales/zh.json';

const STORAGE_KEY = 'vbwd_theme';

export const themeSwitcherPlugin: IPlugin = {
  name: 'theme-switcher',
  version: '1.0.0',
  description: 'Dashboard color theme selector with preset themes',
  _active: false,

  install(sdk: IPlatformSDK) {
    sdk.addRoute({
      path: '/dashboard/appearance',
      name: 'appearance',
      component: () => import('./ThemeSelectorView.vue') as Promise<{ default: unknown }>,
      meta: { requiresAuth: true }
    });

    sdk.addTranslations('en', en);
    sdk.addTranslations('de', de);
    sdk.addTranslations('es', es);
    sdk.addTranslations('fr', fr);
    sdk.addTranslations('ja', ja);
    sdk.addTranslations('ru', ru);
    sdk.addTranslations('th', th);
    sdk.addTranslations('zh', zh);
  },

  activate() {
    this._active = true;
    const savedThemeId = localStorage.getItem(STORAGE_KEY) || 'default';
    const preset = themePresets.find(p => p.id === savedThemeId);
    if (preset) {
      applyTheme(preset);
    }
    userNavRegistry.register({
      pluginName: 'theme-switcher',
      to: '/dashboard/appearance',
      labelKey: 'nav.appearance',
      testId: 'appearance-menu-item',
      placement: 'menu',
    });
  },

  deactivate() {
    this._active = false;
    userNavRegistry.unregister('theme-switcher');
    const defaultPreset = themePresets.find(p => p.id === 'default');
    if (defaultPreset) {
      applyTheme(defaultPreset);
    }
  }
};
