<template>
  <div
    class="vendor-view"
    data-testid="my-categories-view"
  >
    <div class="vendor-header">
      <div class="header-left">
        <h2>{{ t('marketplace.categories.title') }}</h2>
        <span
          v-if="!store.loading"
          class="total-count"
        >{{ filteredCategories.length }} {{ t('marketplace.common.entries') }}</span>
      </div>
      <router-link
        class="create-btn"
        to="/marketplace/listings/new?tab=category"
        data-testid="link-new-category"
      >
        {{ t('marketplace.categories.newCategory') }}
      </router-link>
    </div>

    <div class="vendor-filters">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        data-testid="categories-search"
        :placeholder="t('marketplace.common.search')"
      >
    </div>

    <div
      v-if="selected.size > 0"
      class="bulk-actions"
      data-testid="categories-bulk-actions"
    >
      <span class="selection-info">{{ t('marketplace.common.selected', { count: selected.size }) }}</span>
      <button
        class="bulk-btn delete"
        :disabled="processing"
        data-testid="categories-bulk-delete"
        @click="bulkDelete"
      >
        {{ t('marketplace.categories.bulkDelete') }}
      </button>
    </div>

    <div
      v-if="message"
      class="vendor-message success"
      data-testid="categories-message"
    >
      {{ message }}
    </div>
    <div
      v-if="store.error"
      class="vendor-message error"
      data-testid="categories-error"
    >
      {{ store.error }}
    </div>

    <div
      v-if="store.loading"
      class="loading-state"
      data-testid="categories-loading"
    >
      <div class="spinner" />
      <p>{{ t('marketplace.common.loading') }}</p>
    </div>

    <div
      v-else-if="filteredCategories.length === 0"
      class="empty-state"
      data-testid="categories-empty"
    >
      <p>{{ t('marketplace.categories.empty') }}</p>
    </div>

    <table
      v-else
      class="data-table"
      data-testid="categories-table"
    >
      <thead>
        <tr>
          <th class="checkbox-col">
            <input
              type="checkbox"
              :checked="allSelected"
              data-testid="categories-select-all"
              @change="toggleSelectAll"
            >
          </th>
          <th
            class="sortable"
            :class="{ sorted: sortColumn === 'name' }"
            @click="sortBy('name')"
          >
            {{ t('marketplace.fields.name') }}
            <span class="sort-indicator">{{ sortIndicator('name') }}</span>
          </th>
          <th
            class="sortable"
            :class="{ sorted: sortColumn === 'slug' }"
            @click="sortBy('slug')"
          >
            {{ t('marketplace.fields.slug') }}
            <span class="sort-indicator">{{ sortIndicator('slug') }}</span>
          </th>
          <th
            class="sortable"
            :class="{ sorted: sortColumn === 'products' }"
            @click="sortBy('products')"
          >
            {{ t('marketplace.categories.productCount') }}
            <span class="sort-indicator">{{ sortIndicator('products') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="category in filteredCategories"
          :key="category.id"
          class="data-row"
          :class="{ selected: selected.has(category.id) }"
          :data-testid="`category-row-${category.id}`"
          @click="editCategory(category.id)"
        >
          <td
            class="checkbox-col"
            @click.stop
          >
            <input
              type="checkbox"
              :checked="selected.has(category.id)"
              @change="toggleRow(category.id)"
            >
          </td>
          <td>{{ category.name }}</td>
          <td>{{ category.slug || '—' }}</td>
          <td>{{ category.product_count ?? '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useVendorStore } from '../stores/vendor';

const { t } = useI18n();
const router = useRouter();
const store = useVendorStore();

const searchQuery = ref('');
const message = ref('');
const processing = ref(false);
const selected = ref(new Set<string>());

type SortKey = 'name' | 'slug' | 'products';
const sortColumn = ref<SortKey>('name');
const sortAsc = ref(true);

const filteredCategories = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let rows = store.categories.filter((category) => {
    if (!query) return true;
    return `${category.name} ${category.slug ?? ''}`
      .toLowerCase()
      .includes(query);
  });
  rows = [...rows].sort((a, b) => {
    const direction = sortAsc.value ? 1 : -1;
    if (sortColumn.value === 'products') {
      return ((a.product_count ?? 0) - (b.product_count ?? 0)) * direction;
    }
    const key = sortColumn.value;
    return String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * direction;
  });
  return rows;
});

const allSelected = computed(
  () =>
    filteredCategories.value.length > 0 &&
    filteredCategories.value.every((category) => selected.value.has(category.id)),
);

function sortBy(key: SortKey): void {
  if (sortColumn.value === key) sortAsc.value = !sortAsc.value;
  else {
    sortColumn.value = key;
    sortAsc.value = true;
  }
}

function sortIndicator(key: SortKey): string {
  if (sortColumn.value !== key) return '';
  return sortAsc.value ? '▲' : '▼';
}

function toggleRow(id: string): void {
  if (selected.value.has(id)) selected.value.delete(id);
  else selected.value.add(id);
}

function toggleSelectAll(): void {
  if (allSelected.value) {
    filteredCategories.value.forEach((category) =>
      selected.value.delete(category.id),
    );
  } else {
    filteredCategories.value.forEach((category) =>
      selected.value.add(category.id),
    );
  }
}

function editCategory(id: string): void {
  router.push(`/marketplace/categories/${id}/edit`);
}

async function bulkDelete(): Promise<void> {
  const ids = Array.from(selected.value);
  if (ids.length === 0) return;
  if (!confirm(t('marketplace.categories.confirmBulkDelete', { count: ids.length })))
    return;
  processing.value = true;
  let ok = 0;
  for (const id of ids) {
    if (await store.deleteCategory(id)) ok += 1;
  }
  selected.value.clear();
  processing.value = false;
  message.value = t('marketplace.categories.bulkDeleted', { count: ok });
  setTimeout(() => {
    message.value = '';
  }, 3000);
}

onMounted(() => {
  store.loadCategories();
});
</script>

<style scoped src="./vendor-admin.css"></style>
