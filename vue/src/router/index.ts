import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { isAuthenticated, sessionExpired, hasUserPermission } from '../api';

const routes: RouteRecordRaw[] = [
  {
    // Host fallback for `/`. When the CMS plugin is enabled it OVERRIDES this
    // route by name (`home`) at factory install time — vue-router's `addRoute`
    // replaces this record with the CMS home renderer (CmsHomePage) so `/`
    // renders the home post in place. This inert Home.vue only renders when the
    // CMS plugin is absent. `noLayout` keeps it chrome-free; the authenticated
    // `/` → `/dashboard` redirect lives in `authNavigationGuard`, not here.
    // See docs/dev_log/20260706/sprints/S120_home_slug_canonical_cleanup.md.
    path: '/',
    name: 'home',
    component: () => import('../views/Home.vue'),
    meta: { requiresAuth: false, noLayout: true }
  },
  {
    // Static entry point served by nginx. Normalise it to `/` so the
    // homepage routing rules apply, instead of falling into the CMS
    // catch-all (`/:slug(.+)`) as the literal slug "index.html".
    path: '/index.html',
    redirect: { name: 'home' }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/dashboard/profile',
    name: 'profile',
    component: () => import('../views/Profile.vue'),
    meta: { requiresAuth: true, requiredUserPermission: 'user.profile.view' }
  },
  {
    path: '/dashboard/api-keys',
    name: 'manage-api',
    component: () => import('../views/ManageApi.vue'),
    meta: { requiresAuth: true, requiredUserPermission: 'manage_api' }
  },
  {
    path: '/dashboard/tokens',
    name: 'tokens',
    component: () => import('../views/Tokens.vue'),
    meta: { requiresAuth: true, requiredUserPermission: 'subscription.tokens.view' }
  },
  {
    path: '/dashboard/tokens/:bundleId',
    name: 'token-bundle-detail',
    component: () => import('../views/TokenBundleDetailView.vue'),
    meta: { requiresAuth: true, requiredUserPermission: 'subscription.tokens.view' }
  },
  {
    path: '/dashboard/subscription/invoices',
    name: 'invoices',
    component: () => import('../views/Invoices.vue'),
    meta: { requiresAuth: true, requiredUserPermission: 'subscription.invoices.view' }
  },
  {
    path: '/dashboard/invoice/:invoiceId',
    name: 'invoice-detail',
    component: () => import('../views/InvoiceDetail.vue'),
    meta: { requiresAuth: true, requiredUserPermission: 'subscription.invoices.view' }
  },
  {
    path: '/dashboard/invoice/:invoiceId/pay',
    name: 'invoice-pay',
    component: () => import('../views/InvoicePay.vue'),
    meta: { requiresAuth: true, requiredUserPermission: 'subscription.invoices.view' }
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Navigation guard for authentication. Exported so it can be unit-tested in
// isolation (no router history / lazy-component loading required).
export const authNavigationGuard: Parameters<typeof router.beforeEach>[0] = (to, _from, next) => {
  const authenticated = isAuthenticated();

  // If session has expired, redirect to login
  if (sessionExpired.value && to.name !== 'login') {
    next({ name: 'login' });
    return;
  }

  if (to.meta.requiresAuth && !authenticated) {
    // Pass the intended destination as query param for redirect after login
    next({
      name: 'login',
      query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined
    });
  } else if (to.name === 'login' && authenticated) {
    next({ name: 'dashboard' });
  } else if (to.name === 'home' && authenticated && to.query?.public_home !== '1') {
    // S120 — `/` renders the marketing home CMS post for anonymous visitors,
    // but an authenticated visitor belongs on their dashboard. This redirect
    // resolves BEFORE the home component mounts (no chrome flash) and is the
    // single home-owner of this product decision — the home component itself
    // performs no navigation.
    //
    // Explicit-preview bypass: when `?public_home=1` is present the visitor
    // has deliberately chosen to view the public homepage (e.g. via the CMS
    // "Home" link in the private area), so we fall through and render it. The
    // flag is generic (not CMS-named) so core stays plugin-agnostic.
    next({ name: 'dashboard' });
  } else {
    // Check user permission if route requires one
    const requiredPerm = to.meta.requiredUserPermission as string | undefined;
    if (requiredPerm && !hasUserPermission(requiredPerm)) {
      next({ name: 'dashboard' });
      return;
    }
    next();
  }
};

router.beforeEach(authNavigationGuard);

export default router;
