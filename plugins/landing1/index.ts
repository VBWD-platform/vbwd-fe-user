import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import ru from './locales/ru.json';
import th from './locales/th.json';
import zh from './locales/zh.json';

export const landing1Plugin: IPlugin = {
  name: 'landing1',
  version: '1.0.0',
  description: 'Public landing page with tariff plan selection',
  _active: false,

  install(sdk: IPlatformSDK) {
    sdk.addRoute({
      path: '/landing1',
      name: 'landing1',
      component: () => import('./Landing1View.vue') as Promise<{ default: unknown }>,
      meta: { requiresAuth: false, cmsLayout: true }
    });

    sdk.addRoute({
      path: '/embed/landing1',
      name: 'landing1-embed',
      component: () => import('./EmbedLanding1View.vue') as Promise<{ default: unknown }>,
      meta: { requiresAuth: false, embed: true }
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

  activate(): void {
    (this as IPlugin & { _active: boolean })._active = true;
  },

  deactivate(): void {
    (this as IPlugin & { _active: boolean })._active = false;
  }
} as IPlugin & { _active: boolean };
