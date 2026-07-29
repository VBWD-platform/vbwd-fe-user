<template>
  <div
    id="app"
    :class="{ 'app--cms-content': isCmsLayoutRoute }"
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

/* Public CMS/marketing pages (route meta cmsLayout) render their own CMS theme.
 * The global `body` background uses the app-chrome token `--vbwd-page-bg`, which
 * a theme-switcher dark preset turns navy (#16213e) — that would show through
 * behind the light CMS content. Paint the CMS theme's own background token
 * (`--color-bg`, white for the default light theme, dark for a dark CMS theme)
 * on #app so the app-chrome background never bleeds onto public content. Theme
 * of the logged-in app (dashboard) is untouched — it has no `app--cms-content`. */
#app.app--cms-content {
  background-color: var(--color-bg, #ffffff);
}

/* The fe-core breadcrumb inherits the app-shell dark-theme text tokens
 * (--vbwd-text-body / --vbwd-color-primary) — light-on-white, hence faint —
 * once a CMS page forces the light --color-bg above. Re-map ONLY the
 * breadcrumb's own tokens to the CMS theme so it stays readable, without
 * touching the shared tokens the cookie-consent modal needs (dark panel + light
 * text). Theme-aware: a dark CMS theme carries its own --color-* through. */
#app.app--cms-content .vbwd-breadcrumb {
  --vbwd-text-body: var(--color-text, #1e293b);
  --vbwd-text-muted: var(--color-text-muted, #64748b);
  --vbwd-color-primary: var(--color-accent, #2563eb);
}

/* The exhibition content (.vbwd-page) derives --vbwd-text from
 * --color-text-primary (a theme-switcher/Tarot token a dark preset turns light,
 * #d1d5db) — so on a dark app theme the body/headings go light-on-white, i.e.
 * unreadable, once the light --color-bg is forced above. Re-map the content's
 * text roles to the CMS theme's own --color-text/-muted/-heading (which the
 * theme-switcher never overrides), scoped to .vbwd-page so nothing outside CMS
 * content is affected. Theme-aware; light-theme value is unchanged in practice. */
#app.app--cms-content .vbwd-page {
  --vbwd-text: var(--color-text, #0f172a);
  --vbwd-text-muted: var(--color-text-muted, #475569);
  --vbwd-heading: var(--color-heading, var(--color-text, #0b1220));
}
</style>
