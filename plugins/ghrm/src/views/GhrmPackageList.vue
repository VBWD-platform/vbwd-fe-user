<template>
  <div class="ghrm-package-list">
    <div class="ghrm-list-header">
      <h1 class="ghrm-list-title">
        {{ categoryLabel }}
      </h1>
      <div class="ghrm-list-controls">
        <input
          v-model="searchQ"
          class="ghrm-search-input"
          type="text"
          :placeholder="$t('ghrm.search')"
          @input="onSearch"
        >
        <button
          class="ghrm-view-toggle"
          :title="viewMode === 'grid' ? 'Switch to list' : 'Switch to grid'"
          @click="viewMode = viewMode === 'grid' ? 'list' : 'grid'"
        >
          {{ viewMode === 'grid' ? '☰' : '⊞' }}
        </button>
      </div>
    </div>

    <div
      v-if="store.loading"
      class="ghrm-loading"
    >
      Loading...
    </div>
    <div
      v-else-if="store.error"
      class="ghrm-error"
    >
      {{ store.error }}
    </div>
    <div
      v-else-if="!items.length"
      class="ghrm-empty"
    >
      {{ $t('ghrm.noPackages') }}
    </div>

    <div
      v-else
      :class="viewMode === 'grid' ? 'ghrm-grid' : 'ghrm-list'"
    >
      <router-link
        v-for="pkg in items"
        :key="pkg.id"
        :to="`/category/${categorySlug}/${pkg.slug}`"
        :class="viewMode === 'grid' ? 'ghrm-pkg-card' : 'ghrm-pkg-row'"
        :data-testid="`ghrm-package-${pkg.slug}`"
      >
        <img
          v-if="pkg.icon_url"
          :src="pkg.icon_url"
          :alt="pkg.name"
          class="ghrm-pkg-icon"
        >
        <div class="ghrm-pkg-info">
          <span class="ghrm-pkg-name">{{ pkg.name }}</span>
          <span
            v-if="pkg.author_name"
            class="ghrm-pkg-author"
          >{{ $t('ghrm.by') }} {{ pkg.author_name }}</span>
          <span
            v-if="pkg.latest_version"
            class="ghrm-pkg-version"
          >{{ pkg.latest_version }}</span>
        </div>
        <span class="ghrm-pkg-downloads">↓ {{ pkg.download_counter }}</span>
      </router-link>
    </div>

    <!-- Pagination -->
    <div
      v-if="totalPages > 1"
      class="ghrm-pagination"
    >
      <button
        :disabled="currentPage <= 1"
        @click="goPage(currentPage - 1)"
      >
        ←
      </button>
      <span>{{ currentPage }} / {{ totalPages }}</span>
      <button
        :disabled="currentPage >= totalPages"
        @click="goPage(currentPage + 1)"
      >
        →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useGhrmStore } from '../stores/useGhrmStore';

const route = useRoute();
const store = useGhrmStore();

const categorySlug = computed(() => route.params.category_slug as string);
const categoryLabel = computed(() => categorySlug.value.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
const viewMode = ref<'grid' | 'list'>('grid');
const searchQ = ref('');
const currentPage = ref(1);

const items = computed(() => store.packages?.items || []);
const totalPages = computed(() => store.packages?.pages || 1);

function load() {
  const params: Record<string, string> = { category_slug: categorySlug.value, page: String(currentPage.value) };
  if (searchQ.value) params.q = searchQ.value;
  store.fetchPackages(params);
}

function onSearch() {
  currentPage.value = 1;
  load();
}

function goPage(p: number) {
  currentPage.value = p;
  load();
}

onMounted(load);
watch(categorySlug, () => { currentPage.value = 1; load(); });
</script>

<style scoped>
.ghrm-package-list { max-width: 1100px; margin: 0 auto; padding: 20px; }
.ghrm-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
.ghrm-list-title { font-size: 1.6rem; color: #2c3e50; margin: 0; }
.ghrm-list-controls { display: flex; gap: 8px; align-items: center; }
.ghrm-search-input { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; width: 200px; }
.ghrm-view-toggle { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; font-size: 18px; }
.ghrm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.ghrm-list { display: flex; flex-direction: column; gap: 8px; }
.ghrm-pkg-card { display: flex; flex-direction: column; gap: 8px; padding: 20px; background: #fff; border: 1px solid #e9ecef; border-radius: 8px; text-decoration: none; transition: all .2s; }
.ghrm-pkg-card:hover { border-color: #3498db; box-shadow: 0 2px 12px rgba(52,152,219,.1); }
.ghrm-pkg-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; border: 1px solid #e9ecef; border-radius: 6px; text-decoration: none; transition: background .15s; }
.ghrm-pkg-row:hover { background: #f0f7ff; }
.ghrm-pkg-icon { width: 40px; height: 40px; object-fit: contain; border-radius: 6px; }
.ghrm-pkg-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.ghrm-pkg-name { font-weight: 600; color: #2c3e50; font-size: 15px; }
.ghrm-pkg-author { font-size: 12px; color: #6b7280; }
.ghrm-pkg-version { font-size: 12px; color: #3498db; font-family: monospace; }
.ghrm-pkg-downloads { font-size: 12px; color: #9ca3af; }
.ghrm-pagination { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 24px; }
.ghrm-pagination button { padding: 6px 14px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; }
.ghrm-pagination button:disabled { opacity: .4; cursor: default; }
.ghrm-loading, .ghrm-error, .ghrm-empty { text-align: center; padding: 48px 20px; color: #6b7280; }
.ghrm-error { color: #dc2626; }
</style>
