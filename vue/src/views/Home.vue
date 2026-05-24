<template>
  <div />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api, isAuthenticated } from '@/api';

// Where an anonymous visitor lands on `/` (and `/index.html`) when no CMS
// routing rule is configured, or the rules call fails. The homepage is a
// PUBLIC page — the root must never bounce a visitor to /login. Login is
// reserved for protected /dashboard routes, enforced by the router guard.
const DEFAULT_PUBLIC_SLUG = '/home';

const router = useRouter();

onMounted(async () => {
  try {
    const rules: Array<{
      match_type: string;
      target_slug: string;
      is_active: boolean;
      layer: string;
    }> = await api.get('/cms/routing-rules/middleware');

    const defaultRule = rules.find(r => r.is_active && r.match_type === 'default');
    if (defaultRule) {
      const slug = defaultRule.target_slug.startsWith('/')
        ? defaultRule.target_slug
        : `/${defaultRule.target_slug}`;
      await router.replace(slug);
      return;
    }
  } catch {
    // fall through to default behaviour
  }

  // No routing rule configured. Authenticated users go to their dashboard;
  // anonymous visitors get the public homepage slug — never /login.
  router.replace(isAuthenticated() ? '/dashboard' : DEFAULT_PUBLIC_SLUG);
});
</script>
