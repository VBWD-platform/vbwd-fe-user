<template>
  <div
    class="vbwd-embed"
    :class="themeClass"
    data-testid="embed-landing1"
  >
    <Landing1View
      :embed-mode="true"
      :category="category"
      @plan-selected="onPlanSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Landing1View from './Landing1View.vue';

const route = useRoute();
const { locale } = useI18n();

const allowedLocales = ['en', 'de'];
const allowedThemes = ['light', 'dark'];

const themeClass = computed(() => {
  const theme = typeof route.query.theme === 'string' ? route.query.theme : 'light';
  return allowedThemes.includes(theme) ? `vbwd-embed--${theme}` : 'vbwd-embed--light';
});

const category = computed(() =>
  typeof route.query.category === 'string' ? route.query.category : ''
);

onMounted(() => {
  const queryLocale = typeof route.query.locale === 'string' ? route.query.locale : 'en';
  if (allowedLocales.includes(queryLocale)) {
    locale.value = queryLocale;
  }
  initResizeObserver();
});

function onPlanSelected(plan: { slug: string; name: string; price: number; currency: string }) {
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'vbwd:plan-selected',
      payload: {
        planSlug: plan.slug,
        planName: plan.name,
        price: plan.price,
        currency: plan.currency,
      }
    }, '*');
  }
}

// Auto-resize: notify parent of content height changes
let resizeObserver: ResizeObserver | null = null;

function initResizeObserver() {
  if (window.parent === window) return;

  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.scrollHeight;
      window.parent.postMessage({
        type: 'vbwd:resize',
        payload: { height: Math.ceil(height) }
      }, '*');
    }
  });

  const root = document.querySelector('.vbwd-embed');
  if (root) resizeObserver.observe(root);
}

onUnmounted(() => {
  resizeObserver?.disconnect();
});
</script>

<style scoped>
.vbwd-embed {
  background: #ffffff;
  min-height: 100vh;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.vbwd-embed--dark {
  background: #111827;
  color: #f3f4f6;
}
</style>
