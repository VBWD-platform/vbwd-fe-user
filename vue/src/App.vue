<template>
  <div
    id="app"
    :class="{ 'app--public-light': isPublicLightRoute }"
  >
    <!-- License-blocked CMS backend (HTTP 402): show the full-page
         "Technical works" screen app-wide instead of a broken site. -->
    <MaintenanceScreen v-if="maintenanceActive" />

    <template v-else>
      <!-- Embed routes: no layout, no session modal -->
      <router-view v-if="isEmbedRoute" />

      <!-- Routes that need the site layout (authenticated users OR public pages with layout) -->
      <UserLayout v-else-if="showLayout">
        <router-view />
      </UserLayout>

      <!-- Bare public routes: login, oauth callbacks, etc. -->
      <router-view v-else />

      <!-- Session Expired Modal (hidden in embed mode) -->
      <SessionExpiredModal v-if="!isEmbedRoute" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';
import UserLayout from './layouts/UserLayout.vue';
import SessionExpiredModal from './components/SessionExpiredModal.vue';
import MaintenanceScreen from './components/MaintenanceScreen.vue';
import { isAuthenticated } from '@/api';
import { useAppConfigStore } from '@/stores/appConfig';
import { useMaintenanceStore } from '@/stores/maintenance';

const route = useRoute();

// App-wide maintenance flag — flipped ON when a CMS API call is
// license-blocked (HTTP 402). When active, the whole app renders the
// "Technical works" screen instead of the router view.
const { active: maintenanceActive } = storeToRefs(useMaintenanceStore());

// Load the public app config (operating currency + active currencies + rates,
// price-display modes) once at app start. It is the single source for fe-core's
// operating currency and for the display-currency switcher in UserLayout (S99) —
// the checkout views also call it, but it's idempotent, and the switcher lives
// on dashboard pages that never enter a checkout flow, so it must load here too.
onMounted(() => {
  void useAppConfigStore().load();
});

const isEmbedRoute = computed(() => route.meta.embed === true);

// cmsLayout routes manage their own page chrome via GhrmLayoutWrapper / CMS layouts.
// They must never be wrapped in UserLayout, even when the user is authenticated.
const isCmsLayoutRoute = computed(() => route.meta.cmsLayout === true);

// Public-facing storefront pages (CMS/marketing `cmsLayout` + bare public routes
// like `/checkout`, `/login` marked `noLayout`) must always render in the CMS
// light theme, never the theme-switcher's dark app preset — that preset is for
// the authenticated dashboard (UserLayout) only. Drives the `app--public-light`
// token remap in <style>.
const isPublicLightRoute = computed(
  () => route.meta.cmsLayout === true || route.meta.noLayout === true,
);

// Show UserLayout when: user is authenticated, OR the route explicitly opts in to the layout
// (publicLayout: true) for unauthenticated visitors on CMS/plugin pages.
const showLayout = computed(() => {
  if (isEmbedRoute.value) return false;
  if (isCmsLayoutRoute.value) return false;
  if (route.meta.noLayout === true) return false;
  return isAuthenticated() || route.meta.publicLayout === true;
});
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: var(--vbwd-page-bg, #f5f5f5);
  color: var(--vbwd-text-body, #333);
}

#app {
  min-height: 100vh;
}

/* ---------------------------------------------------------------------------
 * Public CMS pages must always render in the CMS (light) theme, even when the
 * theme-switcher's app preset is dark. The app preset applies its tokens inline
 * on <html>: the app-chrome roles (`--vbwd-*`) AND a duplicate CMS-namespace
 * block (`--color-text-primary`, `--color-background-secondary`, …) that a dark
 * preset turns dark/light — those bleed into every CMS widget (nav, breadcrumb,
 * exhibition cards, pricing cards via `--tpc-* : var(--vbwd-*)`, …).
 *
 * Rather than patch each widget, neutralise the whole app-preset override on
 * the public CMS wrapper: re-map every bled token to the CMS content theme's
 * own `--color-*` roles, which the theme-switcher NEVER overrides (so operator
 * edits to the active CMS style still flow through). The logged-in app
 * (dashboard) has no `app--public-light`, so its theme is untouched. Borders use
 * a light fallback because the app preset also overrides `--color-border`. */
#app.app--public-light {
  background-color: var(--color-bg, #ffffff);
  color: var(--color-text, #0f172a);

  --vbwd-page-bg: var(--color-bg, #ffffff);
  --vbwd-card-bg: var(--color-surface, #ffffff);
  --vbwd-text-body: var(--color-text, #333333);
  --vbwd-text-heading: var(--color-heading, var(--color-text, #2c3e50));
  --vbwd-text-muted: var(--color-text-muted, #666666);
  --vbwd-color-primary: var(--color-accent, #2563eb);
  --vbwd-color-primary-hover: var(--color-accent-dark, #1d4ed8);
  --vbwd-border-color: var(--color-border, #e2e8f0);
  --vbwd-border-light: #eeeeee;

  --color-text-primary: var(--color-text, #0f172a);
  --color-text-secondary: var(--color-text-muted, #475569);
  --color-background: var(--color-bg, #ffffff);
  --color-background-secondary: var(--color-surface, #ffffff);
  --color-primary: var(--color-accent, #2563eb);
}

/* The cookie-consent popup Teleports to <body> (outside #app), so the wrapper
 * remap above can't reach it — pin the same CMS-light roles directly. It only
 * ever overlays public pages, so it stays light/readable there. */
.cookie-consent {
  --vbwd-card-bg: var(--color-surface, #ffffff);
  --vbwd-text-heading: var(--color-heading, var(--color-text, #2c3e50));
  --vbwd-text-body: var(--color-text, #333333);
  --vbwd-text-muted: var(--color-text-muted, #666666);
  --vbwd-border-color: var(--color-border, #d1d5db);
  color: var(--color-text, #333333);
}
</style>
