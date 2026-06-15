<template>
  <div class="collection-toolbar">
    <input
      :value="searchQuery"
      type="search"
      class="collection-toolbar__search"
      data-testid="collection-search"
      :placeholder="searchPlaceholder"
      @input="onSearchInput"
    >

    <button
      type="button"
      class="collection-toolbar__sort"
      data-testid="collection-sort-toggle"
      @click="$emit('toggle-sort')"
    >
      {{ sortLabel }}
      <span aria-hidden="true">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
    </button>

    <div class="collection-toolbar__views">
      <button
        type="button"
        :class="['collection-toolbar__view-btn', { active: viewMode === 'cards' }]"
        data-testid="collection-view-cards"
        :aria-label="cardsLabel"
        @click="$emit('set-view', 'cards')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        ><rect
          x="0"
          y="0"
          width="7"
          height="7"
        /><rect
          x="9"
          y="0"
          width="7"
          height="7"
        /><rect
          x="0"
          y="9"
          width="7"
          height="7"
        /><rect
          x="9"
          y="9"
          width="7"
          height="7"
        /></svg>
      </button>
      <button
        type="button"
        :class="['collection-toolbar__view-btn', { active: viewMode === 'table' }]"
        data-testid="collection-view-table"
        :aria-label="tableLabel"
        @click="$emit('set-view', 'table')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        ><rect
          x="0"
          y="1"
          width="16"
          height="2"
        /><rect
          x="0"
          y="6"
          width="16"
          height="2"
        /><rect
          x="0"
          y="11"
          width="16"
          height="2"
        /></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Presentational toolbar for the catalog collection widgets (DRY).
 *
 * Renders the quick-search input, the price-sort toggle, and the cards/table
 * view switch. Holds no state: it reflects the props supplied by
 * ``useCollectionView`` and emits intent events the host widget forwards back
 * into the composable. Both the tariff-plan and token-bundle widgets reuse it.
 */
import type { CollectionSortDirection, CollectionViewMode } from '@/composables/useCollectionView';

defineProps<{
  searchQuery: string;
  viewMode: CollectionViewMode;
  sortDirection: CollectionSortDirection;
  searchPlaceholder: string;
  sortLabel: string;
  cardsLabel: string;
  tableLabel: string;
}>();

const emit = defineEmits<{
  (event: 'update:searchQuery', value: string): void;
  (event: 'toggle-sort'): void;
  (event: 'set-view', mode: CollectionViewMode): void;
}>();

function onSearchInput(domEvent: Event): void {
  emit('update:searchQuery', (domEvent.target as HTMLInputElement).value);
}
</script>

<style scoped>
.collection-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.collection-toolbar__search {
  flex: 1 1 220px;
  min-width: 180px;
  padding: 8px 12px;
  border: 1px solid var(--vbwd-border-color, #ddd);
  background: var(--vbwd-card-bg, #fff);
  color: var(--vbwd-text-body, #333);
  border-radius: 6px;
  font-size: 0.95rem;
}

.collection-toolbar__sort {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--vbwd-border-color, #ddd);
  background: var(--vbwd-card-bg, #fff);
  color: var(--vbwd-text-body, #333);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.collection-toolbar__views {
  display: flex;
  gap: 4px;
  background: var(--vbwd-page-bg, #f8f9fa);
  border: 1px solid var(--vbwd-border-color, #ddd);
  border-radius: 6px;
  padding: 3px;
}

.collection-toolbar__view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--vbwd-text-muted, #6b7280);
}

.collection-toolbar__view-btn.active {
  background: var(--vbwd-card-bg, #fff);
  color: var(--vbwd-text-heading, #2c3e50);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>
