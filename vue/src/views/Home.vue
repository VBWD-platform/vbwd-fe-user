<template>
  <div />
</template>

<script setup lang="ts">
/**
 * Inert host fallback for `/`.
 *
 * The homepage is CMS content, so the CMS plugin owns `/` at runtime: it
 * registers a `/` route named `home` that OVERRIDES this record (vue-router
 * `addRoute` replaces by name) and renders the home CMS post in place — no
 * client redirect to a `/home` slug (S120).
 *
 * This component therefore renders only when the CMS plugin is absent, and it
 * performs NO navigation of its own:
 *   - the authenticated `/` → `/dashboard` redirect lives in the router's
 *     `authNavigationGuard` (fires for the `home` route regardless of which
 *     component is mounted, so no chrome flash);
 *   - anonymous visitors have no home content without the CMS plugin, so this
 *     falls back to an empty shell rather than bouncing to a broken `/home`.
 */
</script>
