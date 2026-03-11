<template>
  <div class="ghrm-search-page">
    <h1>{{ $t('ghrm.title') }} — Search</h1>
    <input
      v-model="q"
      class="ghrm-search-main"
      type="text"
      :placeholder="$t('ghrm.search')"
      autofocus
      @input="onSearch"
    >
    <div
      v-if="store.loading"
      class="ghrm-loading"
    >
      Searching...
    </div>
    <div
      v-else-if="!q"
      class="ghrm-muted"
    >
      Enter a search term above.
    </div>
    <div
      v-else-if="!items.length"
      class="ghrm-muted"
    >
      {{ $t('ghrm.noPackages') }}
    </div>
    <div
      v-else
      class="ghrm-search-results"
    >
      <router-link
        v-for="pkg in items"
        :key="pkg.id"
        :to="`/category/backend/${pkg.slug}`"
        class="ghrm-search-result"
        :data-testid="`ghrm-result-${pkg.slug}`"
      >
        <img
          v-if="pkg.icon_url"
          :src="pkg.icon_url"
          :alt="pkg.name"
          class="ghrm-result-icon"
        >
        <div class="ghrm-result-info">
          <span class="ghrm-result-name">{{ pkg.name }}</span>
          <span
            v-if="pkg.author_name"
            class="ghrm-result-author"
          >{{ pkg.author_name }}</span>
        </div>
        <span
          v-if="pkg.latest_version"
          class="ghrm-result-version"
        >{{ pkg.latest_version }}</span>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGhrmStore } from '../stores/useGhrmStore';

const store = useGhrmStore();
const q = ref('');
const items = computed(() => store.searchResults?.items || []);

let searchTimer: ReturnType<typeof setTimeout>;
function onSearch() {
  clearTimeout(searchTimer);
  if (!q.value.trim()) return;
  searchTimer = setTimeout(() => store.search(q.value), 300);
}
</script>

<style scoped>
.ghrm-search-page { max-width: 800px; margin: 40px auto; padding: 0 20px; }
.ghrm-search-page h1 { font-size: 1.6rem; margin-bottom: 20px; color: #2c3e50; }
.ghrm-search-main { width: 100%; padding: 12px 16px; font-size: 16px; border: 2px solid #d1d5db; border-radius: 8px; box-sizing: border-box; margin-bottom: 24px; }
.ghrm-search-results { display: flex; flex-direction: column; gap: 8px; }
.ghrm-search-result { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #fff; border: 1px solid #e9ecef; border-radius: 8px; text-decoration: none; }
.ghrm-search-result:hover { background: #f0f7ff; border-color: #3498db; }
.ghrm-result-icon { width: 36px; height: 36px; object-fit: contain; border-radius: 4px; }
.ghrm-result-info { flex: 1; display: flex; flex-direction: column; }
.ghrm-result-name { font-weight: 600; color: #2c3e50; }
.ghrm-result-author { font-size: 12px; color: #6b7280; }
.ghrm-result-version { font-size: 12px; color: #3498db; font-family: monospace; }
.ghrm-loading, .ghrm-muted { color: #9ca3af; font-style: italic; }
</style>
