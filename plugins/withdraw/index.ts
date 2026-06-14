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

export const withdrawPlugin: IPlugin = {
  name: 'withdraw',
  version: '1.0.0',
  description:
    'Withdraw a token balance as money via payout-capable payment providers (S79).',
  _active: false,

  install(sdk: IPlatformSDK) {
    sdk.addRoute({
      path: '/withdraw',
      name: 'withdraw',
      component: () => import('./src/views/WithdrawView.vue'),
      meta: { requiresAuth: true },
    });
    sdk.addRoute({
      path: '/withdraw/:id',
      name: 'withdraw-request-detail',
      component: () => import('./src/views/WithdrawRequestDetail.vue'),
      meta: { requiresAuth: true },
      props: true,
    });

    sdk.addTranslations('en', en);
    sdk.addTranslations('de', de);
    sdk.addTranslations('es', es);
    sdk.addTranslations('fr', fr);
    sdk.addTranslations('ja', ja);
    sdk.addTranslations('ru', ru);
    sdk.addTranslations('th', th);
    sdk.addTranslations('zh', zh);

    // D8 — the reusable panel: S80's "My money" page embeds the identical
    // provider-list + destination-form + history UI via sdk.getComponents()
    // without importing across plugin directories.
    sdk.addComponent(
      'WithdrawPanel',
      () => import('./src/components/WithdrawPanel.vue'),
    );
  },

  activate() {
    this._active = true;
    userNavRegistry.register({
      pluginName: 'withdraw',
      to: '/withdraw',
      labelKey: 'withdraw.title',
      testId: 'nav-withdraw',
    });
  },

  deactivate() {
    this._active = false;
    userNavRegistry.unregister('withdraw');
  },
};
