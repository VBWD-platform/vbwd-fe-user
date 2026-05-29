<template>
  <div />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { isAuthenticated } from '@/api';

// Where an anonymous visitor lands on `/` (and `/index.html`) when no CMS
// routing rule applies. The homepage is a PUBLIC page — the root must
// never bounce a visitor to /login. Login is reserved for protected
// /dashboard routes, enforced by the router auth guard.
//
// CMS middleware-layer routing rules (including the `default` rule that
// previously lived inline here) are now evaluated by the CMS plugin's
// router guard registered via `sdk.addRouterGuard(...)` — see
// `plugins/cms/src/routing/middlewareRoutingGuard.ts`. If any rule
// matches `/`, the guard redirects before this view ever mounts.
// We reach the fallback below only when no rule fires.
const DEFAULT_PUBLIC_SLUG = '/home';

const router = useRouter();

onMounted(() => {
  router.replace(isAuthenticated() ? '/dashboard' : DEFAULT_PUBLIC_SLUG);
});
</script>
