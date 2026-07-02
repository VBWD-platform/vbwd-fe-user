import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';
import { userNavRegistry } from '@/plugins/userNavRegistry';
import en from './locales/en.json';
import de from './locales/de.json';

/**
 * Marketplace (vendor) plugin.
 *
 * Lets a logged-in user apply to become a vendor, create sellable assets
 * across the shop / subscription / ghrm / booking verticals, manage those
 * listings and categories, and view their sales and withdrawable earnings.
 * The private vendor area reuses the admin backoffice visual language (card
 * list pages with sortable columns / quicksearch / bulk ops, and settings-
 * style edit forms). Every screen makes REAL API calls to the live backend
 * vendor endpoints.
 *
 * Navigation is a collapsible "Vendor" block (My listings / My categories /
 * My sales / My earnings) contributed via the generic nav-group seam.
 */
export const marketplacePlugin: IPlugin = {
  name: 'marketplace',
  version: '1.0.0',
  description:
    'Vendor area — become a vendor, manage listings & categories across verticals, view sales and earnings.',
  _active: false,

  install(sdk: IPlatformSDK) {
    sdk.addTranslations('en', en);
    sdk.addTranslations('de', de);

    // Vendor landing: My listings (also the become-a-vendor onboarding when the
    // caller is not yet a vendor).
    sdk.addRoute({
      path: '/marketplace/listings',
      name: 'marketplace-listings',
      component: () => import('./marketplace/views/MyListings.vue'),
      meta: { requiresAuth: true },
    });
    // Backward-compatible alias for the previous dashboard path.
    sdk.addRoute({
      path: '/marketplace/dashboard',
      name: 'marketplace-dashboard',
      component: () => import('./marketplace/views/MyListings.vue'),
      meta: { requiresAuth: true },
    });
    sdk.addRoute({
      path: '/marketplace/listings/new',
      name: 'marketplace-new-listing',
      component: () => import('./marketplace/views/NewListing.vue'),
      meta: { requiresAuth: true },
    });
    sdk.addRoute({
      path: '/marketplace/listings/:type/:id/edit',
      name: 'marketplace-edit-listing',
      component: () => import('./marketplace/views/EditListing.vue'),
      meta: { requiresAuth: true },
    });
    sdk.addRoute({
      path: '/marketplace/categories',
      name: 'marketplace-categories',
      component: () => import('./marketplace/views/MyCategories.vue'),
      meta: { requiresAuth: true },
    });
    sdk.addRoute({
      path: '/marketplace/categories/:id/edit',
      name: 'marketplace-edit-category',
      component: () => import('./marketplace/views/EditCategory.vue'),
      meta: { requiresAuth: true },
    });
    sdk.addRoute({
      path: '/marketplace/sales',
      name: 'marketplace-sales',
      component: () => import('./marketplace/views/MySales.vue'),
      meta: { requiresAuth: true },
    });
    sdk.addRoute({
      path: '/marketplace/earnings',
      name: 'marketplace-earnings',
      component: () => import('./marketplace/views/MyEarnings.vue'),
      meta: { requiresAuth: true },
    });
  },

  activate() {
    this._active = true;

    // "Vendor" collapsible block with four table pages. Every item carries the
    // group label/icon so the generic nav-group renderer can build the header
    // without core knowing the plugin.
    const groupMeta = {
      pluginName: 'marketplace',
      group: 'vendor',
      groupLabelKey: 'marketplace.nav.title',
      groupIcon: 'store',
    };
    userNavRegistry.register({
      ...groupMeta,
      to: '/marketplace/listings',
      icon: 'bag',
      labelKey: 'marketplace.nav.listings',
      testId: 'nav-marketplace-listings',
    });
    userNavRegistry.register({
      ...groupMeta,
      to: '/marketplace/categories',
      icon: 'layers',
      labelKey: 'marketplace.nav.categories',
      testId: 'nav-marketplace-categories',
    });
    userNavRegistry.register({
      ...groupMeta,
      to: '/marketplace/sales',
      icon: 'invoice',
      labelKey: 'marketplace.nav.sales',
      testId: 'nav-marketplace-sales',
    });
    userNavRegistry.register({
      ...groupMeta,
      to: '/marketplace/earnings',
      icon: 'coin',
      labelKey: 'marketplace.nav.earnings',
      testId: 'nav-marketplace-earnings',
    });
  },

  deactivate() {
    this._active = false;
    userNavRegistry.unregister('marketplace');
  },
};
