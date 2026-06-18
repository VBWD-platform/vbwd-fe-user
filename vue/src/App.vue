<template>
  <div id="app">
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import UserLayout from './layouts/UserLayout.vue';
import SessionExpiredModal from './components/SessionExpiredModal.vue';
import { isAuthenticated } from '@/api';
import { useAppConfigStore } from '@/stores/appConfig';

const route = useRoute();

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
</style>
