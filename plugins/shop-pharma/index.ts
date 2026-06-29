import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';
import { pharmacyTranslations } from './shop-pharma/translations';

/**
 * shop-pharma (fe-user) — a pharmacy STOREFRONT built on top of the shop module.
 *
 * It owns its own routes (`/pharmacy`, `/pharmacy/c/:slug`, `/pharmacy/p/:slug`)
 * and views; it reuses the shop plugin's cart/checkout for purchasing. It never
 * edits the host app or the shop plugin. With this plugin disabled, the shop
 * storefront renders exactly as before (Liskov — pharma owns its own surface).
 */
export const shopPharmaPlugin: IPlugin = {
  name: 'shop-pharma',
  version: '0.1.0',
  dependencies: ['shop'],
  description: 'Pharmacy storefront — class-segmented catalogue + regulated product pages',

  install(sdk: IPlatformSDK) {
    sdk.addRoute({
      path: '/pharmacy',
      name: 'pharmacy-catalogue',
      component: () => import('./shop-pharma/views/PharmacyCatalogue.vue'),
      meta: { requiresAuth: false },
    });
    sdk.addRoute({
      path: '/pharmacy/c/:slug',
      name: 'pharmacy-category',
      component: () => import('./shop-pharma/views/PharmacyCatalogue.vue'),
      meta: { requiresAuth: false },
    });
    sdk.addRoute({
      path: '/pharmacy/p/:slug',
      name: 'pharmacy-product',
      component: () => import('./shop-pharma/views/PharmacyProduct.vue'),
      meta: { requiresAuth: false },
    });

    for (const [locale, messages] of Object.entries(pharmacyTranslations)) {
      sdk.addTranslations(locale, messages);
    }
  },

  activate() {},
  deactivate() {},
};
