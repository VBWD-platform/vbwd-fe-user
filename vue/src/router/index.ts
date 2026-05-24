import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { isAuthenticated, sessionExpired, hasUserPermission } from '../api';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/Home.vue'),
    meta: { requiresAuth: false }
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

// Navigation guard for authentication
router.beforeEach((to, _from, next) => {
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
  } else {
    // Check user permission if route requires one
    const requiredPerm = to.meta.requiredUserPermission as string | undefined;
    if (requiredPerm && !hasUserPermission(requiredPerm)) {
      next({ name: 'dashboard' });
      return;
    }
    next();
  }
});

export default router;
