import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';
import { userNavRegistry } from '@/plugins/userNavRegistry';
import { registerCmsVueComponent } from '../cms/src/registry/vueComponentRegistry';
import en from './locales/en.json';

export const ghrmPlugin: IPlugin = {
  name: 'ghrm',
  version: '1.0.0',
  description: 'GitHub Repo Manager — software catalogue with subscription-gated GitHub access',
  _active: false,

  install(sdk: IPlatformSDK) {
    sdk.addTranslations('en', en);

    // Register GHRM Vue components into the CMS widget registry
    Promise.all([
      import('./src/views/GhrmCatalogueContent.vue'),
      import('./src/views/GhrmPackageDetail.vue'),
    ]).then(([catalogue, detail]) => {
      registerCmsVueComponent('GhrmCatalogueContent', catalogue.default);
      registerCmsVueComponent('GhrmPackageDetail', detail.default);
    });

    // Public catalogue routes — all rendered via CmsPage with the appropriate page slug
    sdk.addRoute({
      path: '/category',
      name: 'ghrm-category-index',
      component: () => import('../cms/src/views/CmsPage.vue'),
      props: { slug: 'category' },
      meta: { requiresAuth: false, cmsLayout: true },
    });
    sdk.addRoute({
      path: '/category/:category_slug',
      name: 'ghrm-package-list',
      component: () => import('../cms/src/views/CmsPage.vue'),
      props: (route: any) => ({ slug: `category/${route.params.category_slug}` }),
      meta: { requiresAuth: false, cmsLayout: true },
    });
    sdk.addRoute({
      path: '/category/:category_slug/:package_slug',
      name: 'ghrm-package-detail',
      component: () => import('../cms/src/views/CmsPage.vue'),
      props: { slug: 'ghrm-software-detail' },
      meta: { requiresAuth: false, cmsLayout: true },
    });
    sdk.addRoute({
      path: '/category/search',
      name: 'ghrm-search',
      component: () => import('./src/views/GhrmSearch.vue'),
      meta: { requiresAuth: false, cmsLayout: true },
    });
    // OAuth callback
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
