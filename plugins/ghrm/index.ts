import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';
import { userNavRegistry } from '@/plugins/userNavRegistry';
import en from './locales/en.json';

export const ghrmPlugin: IPlugin = {
  name: 'ghrm',
  version: '1.0.0',
  description: 'GitHub Repo Manager — software catalogue with subscription-gated GitHub access',
  _active: false,

  install(sdk: IPlatformSDK) {
    sdk.addTranslations('en', en);

    // Public catalogue routes
    sdk.addRoute({
      path: '/category',
      name: 'ghrm-category-index',
      component: () => import('./src/views/GhrmCategoryIndex.vue'),
      meta: { requiresAuth: false },
    });
    sdk.addRoute({
      path: '/category/:category_slug',
      name: 'ghrm-package-list',
      component: () => import('./src/views/GhrmPackageList.vue'),
      meta: { requiresAuth: false },
    });
    sdk.addRoute({
      path: '/category/:category_slug/:package_slug',
      name: 'ghrm-package-detail',
      component: () => import('./src/views/GhrmPackageDetail.vue'),
      meta: { requiresAuth: false },
    });
    sdk.addRoute({
      path: '/software/search',
      name: 'ghrm-search',
      component: () => import('./src/views/GhrmSearch.vue'),
      meta: { requiresAuth: false },
    });
    // OAuth callback (no layout needed — handled inline in component)
    sdk.addRoute({
      path: '/ghrm/auth/github/callback',
      name: 'ghrm-oauth-callback',
      component: () => import('./src/views/GhrmOAuthCallback.vue'),
      meta: { requiresAuth: false },
    });
  },

  activate() {
    this._active = true;
    userNavRegistry.register({
      pluginName: 'ghrm',
      to: '/category',
      labelKey: 'ghrm.title',
      testId: 'nav-ghrm',
    });
  },

  deactivate() {
    this._active = false;
    userNavRegistry.unregister('ghrm');
  },
};
