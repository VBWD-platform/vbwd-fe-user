import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';
import { userNavRegistry } from '@/plugins/userNavRegistry';
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import ru from './locales/ru.json';
import th from './locales/th.json';
import zh from './locales/zh.json';

export const chatPlugin: IPlugin = {
  name: 'chat',
  version: '1.0.0',
  description: 'LLM chat with token-based billing',
  _active: false,

  install(sdk: IPlatformSDK) {
    sdk.addRoute({
      path: '/dashboard/chat',
      name: 'chat',
      component: () => import('./src/ChatView.vue') as Promise<{ default: unknown }>,
      meta: { requiresAuth: true },
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
    userNavRegistry.register({
      pluginName: 'chat',
      to: '/dashboard/chat',
      labelKey: 'nav.chat',
      testId: 'nav-chat',
    });
  },

  deactivate() {
    this._active = false;
    userNavRegistry.unregister('chat');
  },
};
