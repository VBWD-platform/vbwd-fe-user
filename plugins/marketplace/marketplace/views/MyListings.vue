<template>
  <div
    class="vendor-view"
    data-testid="my-listings-view"
  >
    <!-- Not yet a vendor: onboarding -->
    <section
      v-if="store.isVendor === false"
      data-testid="become-vendor-card"
    >
      <div class="vendor-header">
        <div class="header-left">
          <h2>{{ t('marketplace.becomeVendor.title') }}</h2>
        </div>
      </div>
      <div class="form-section">
        <p class="section-hint">
          {{ t('marketplace.becomeVendor.hint') }}
        </p>
        <form @submit.prevent="onBecomeVendor">
          <div class="form-group">
            <label>{{ t('marketplace.becomeVendor.displayName') }}</label>
            <input
              v-model="displayName"
              type="text"
              class="form-input"
              data-testid="become-vendor-name"
              :placeholder="t('marketplace.becomeVendor.displayNamePlaceholder')"
            >
          </div>
          <div class="form-actions">
            <button
              type="submit"
              class="save-btn"
              data-testid="become-vendor-submit"
              :disabled="store.loading || !displayName.trim()"
            >
              {{ t('marketplace.becomeVendor.submit') }}
            </button>
          </div>
        </form>
      </div>
    </section>

    <!-- Vendor: listings table -->
    <template v-else>
      <div class="vendor-header">
        <div class="header-left">
          <h2>{{ t('marketplace.listings.title') }}</h2>
          <span
            v-if="!store.loading"
            class="total-count"
          >{{ filteredListings.length }} {{ t('marketplace.common.entries') }}</span>
        </div>
        <router-link
          class="create-btn"
          to="/marketplace/listings/new"
          data-testid="link-new-listing"
        >
          {{ t('marketplace.listings.newListing') }}
        </router-link>
      </div>

      <div class="vendor-filters">
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          data-testid="listings-search"
          :placeholder="t('marketplace.common.search')"
        >
        <select
          v-model="typeFilter"
          class="filter-select"
          data-testid="listings-type-filter"
        >
          <option value="">
            {{ t('marketplace.listings.filterAllTypes') }}
          </option>
          <option
            v-for="type in listingTypes"
            :key="type"
            :value="type"
          >
            {{ t('marketplace.listings.showOnlyType', { type: t(`marketplace.types.${type}`) }) }}
          </option>
        </select>
        <select
          v-model="categoryFilter"
          class="filter-select"
          data-testid="listings-category-filter"
        >
          <option value="">
            {{ t('marketplace.listings.filterAllCategories') }}
          </option>
          <option
            v-for="category in categoryOptions"
            :key="category"
            :value="category"
          >
            {{ t('marketplace.listings.showOnlyCategory', { category }) }}
          </option>
        </select>
      </div>

      <!-- Bulk actions -->
      <div
        v-if="selected.size > 0"
        class="bulk-actions"
        data-testid="listings-bulk-actions"
      >
        <span class="selection-info">{{ t('marketplace.common.selected', { count: selected.size }) }}</span>
        <button
          class="bulk-btn activate"
          :disabled="processing"
          data-testid="bulk-activate"
          @click="bulkSetActive(true)"
        >
          {{ t('marketplace.listings.bulkActivate') }}
        </button>
        <button
          class="bulk-btn deactivate"
          :disabled="processing"
          data-testid="bulk-deactivate"
          @click="bulkSetActive(false)"
        >
          {{ t('marketplace.listings.bulkDeactivate') }}
        </button>
        <button
          class="bulk-btn delete"
          :disabled="processing"
          data-testid="bulk-delete"
          @click="bulkDelete"
        >
          {{ t('marketplace.listings.bulkDelete') }}
        </button>
      </div>

      <div
        v-if="message"
        class="vendor-message success"
        data-testid="listings-message"
      >
        {{ message }}
      </div>
      <div
        v-if="store.error"
        class="vendor-message error"
        data-testid="listings-error"
      >
        {{ store.error }}
      </div>

      <div
        v-if="store.loading"
        class="loading-state"
        data-testid="listings-loading"
      >
        <div class="spinner" />
        <p>{{ t('marketplace.common.loading') }}</p>
      </div>

      <div
        v-else-if="filteredListings.length === 0"
        class="empty-state"
        data-testid="listings-empty"
      >
        <p>{{ t('marketplace.listings.empty') }}</p>
      </div>

      <table
        v-else
        class="data-table"
        data-testid="listings-table"
      >
        <thead>
          <tr>
            <th class="checkbox-col">
              <input
                type="checkbox"
                :checked="allSelected"
                data-testid="listings-select-all"
                @change="toggleSelectAll"
              >
            </th>
            <th
              class="sortable"
              :class="{ sorted: sortColumn === 'name' }"
              data-testid="sort-name"
              @click="sortBy('name')"
            >
              {{ t('marketplace.fields.name') }}
              <span class="sort-indicator">{{ sortIndicator('name') }}</span>
            </th>
            <th
              class="sortable"
              :class="{ sorted: sortColumn === 'type' }"
              @click="sortBy('type')"
            >
              {{ t('marketplace.listings.type') }}
              <span class="sort-indicator">{{ sortIndicator('type') }}</span>
            </th>
            <th>{{ t('marketplace.listings.category') }}</th>
            <th
              class="sortable"
              :class="{ sorted: sortColumn === 'price' }"
              data-testid="sort-price"
              @click="sortBy('price')"
            >
              {{ t('marketplace.fields.price') }}
              <span class="sort-indicator">{{ sortIndicator('price') }}</span>
            </th>
            <th
              class="sortable"
              :class="{ sorted: sortColumn === 'status' }"
              @click="sortBy('status')"
            >
              {{ t('marketplace.common.status') }}
              <span class="sort-indicator">{{ sortIndicator('status') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="listing in filteredListings"
            :key="`${listing.type}:${listing.id}`"
            class="data-row"
            :class="{ selected: selected.has(rowKey(listing)) }"
            :data-testid="`listing-row-${listing.id}`"
            @click="editListing(listing)"
          >
            <td
              class="checkbox-col"
              @click.stop
            >
              <input
                type="checkbox"
                :checked="selected.has(rowKey(listing))"
                @change="toggleRow(listing)"
              >
            </td>
            <td>{{ listing.name }}</td>
            <td>
              <span class="type-badge">{{ t(`marketplace.types.${listing.type}`) }}</span>
            </td>
            <td>{{ listing.category_name || '—' }}</td>
            <td>{{ formatPrice(listing.price) }}</td>
            <td>
              <span
                class="status-badge"
                :class="listing.is_active ? 'active' : 'inactive'"
              >
                {{ listing.is_active ? t('marketplace.common.active') : t('marketplace.common.inactive') }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useVendorStore } from '../stores/vendor';
import type { Listing, ListingType } from '../api';

const { t } = useI18n();
const router = useRouter();
const store = useVendorStore();

const displayName = ref('');
const searchQuery = ref('');
const typeFilter = ref<'' | ListingType>('');
const categoryFilter = ref('');
const message = ref('');
const processing = ref(false);
const selected = ref(new Set<string>());

type SortKey = 'name' | 'type' | 'price' | 'status';
const sortColumn = ref<SortKey>('name');
const sortAsc = ref(true);

const listingTypes: ListingType[] = ['product', 'plan', 'software', 'booking'];

const categoryOptions = computed(() => {
  const names = new Set<string>();
  for (const listing of store.listings) {
    if (listing.category_name) names.add(listing.category_name);
  }
  return Array.from(names).sort();
});

const filteredListings = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let rows = store.listings.filter((listing) => {
    if (typeFilter.value && listing.type !== typeFilter.value) return false;
    if (categoryFilter.value && listing.category_name !== categoryFilter.value)
      return false;
    if (query) {
      const haystack = `${listing.name} ${listing.slug ?? ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  rows = [...rows].sort((a, b) => {
    const direction = sortAsc.value ? 1 : -1;
    switch (sortColumn.value) {
      case 'price':
        return (a.price - b.price) * direction;
      case 'status':
        return (Number(a.is_active) - Number(b.is_active)) * direction;
      case 'type':
        return a.type.localeCompare(b.type) * direction;
      case 'name':
      default:
        return a.name.localeCompare(b.name) * direction;
    }
  });
  return rows;
});

const allSelected = computed(
  () =>
    filteredListings.value.length > 0 &&
    filteredListings.value.every((listing) => selected.value.has(rowKey(listing))),
);

function rowKey(listing: Listing): string {
  return `${listing.type}:${listing.id}`;
}

function formatPrice(price: number): string {
  return `${price.toFixed(2)} ${store.currency}`;
}

function sortBy(key: SortKey): void {
  if (sortColumn.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortColumn.value = key;
    sortAsc.value = true;
  }
}

function sortIndicator(key: SortKey): string {
  if (sortColumn.value !== key) return '';
  return sortAsc.value ? '▲' : '▼';
}

function toggleRow(listing: Listing): void {
  const key = rowKey(listing);
  if (selected.value.has(key)) selected.value.delete(key);
  else selected.value.add(key);
}

function toggleSelectAll(): void {
  if (allSelected.value) {
    filteredListings.value.forEach((listing) =>
      selected.value.delete(rowKey(listing)),
    );
  } else {
    filteredListings.value.forEach((listing) =>
      selected.value.add(rowKey(listing)),
    );
  }
}

function selectedListings(): Listing[] {
  return store.listings.filter((listing) => selected.value.has(rowKey(listing)));
}

function editListing(listing: Listing): void {
  router.push(`/marketplace/listings/${listing.type}/${listing.id}/edit`);
}

async function bulkDelete(): Promise<void> {
  const targets = selectedListings();
  if (targets.length === 0) return;
  if (!confirm(t('marketplace.listings.confirmBulkDelete', { count: targets.length })))
    return;
  processing.value = true;
  let ok = 0;
  for (const listing of targets) {
    if (await store.deleteListing(listing.type, listing.id)) ok += 1;
  }
  selected.value.clear();
  processing.value = false;
  flash(t('marketplace.listings.bulkDeleted', { count: ok }));
}

async function bulkSetActive(isActive: boolean): Promise<void> {
  const targets = selectedListings();
  if (targets.length === 0) return;
  processing.value = true;
  let ok = 0;
  for (const listing of targets) {
    if (await store.setListingActive(listing.type, listing.id, isActive)) ok += 1;
  }
  selected.value.clear();
  processing.value = false;
  flash(
    isActive
      ? t('marketplace.listings.bulkActivated', { count: ok })
      : t('marketplace.listings.bulkDeactivated', { count: ok }),
  );
}

function flash(text: string): void {
  message.value = text;
  setTimeout(() => {
    message.value = '';
  }, 3000);
}

async function onBecomeVendor(): Promise<void> {
  const name = displayName.value.trim();
  if (!name) return;
  const ok = await store.becomeVendor(name);
  if (ok) await store.loadListings();
}

onMounted(async () => {
  await store.checkVendorStatus();
  if (store.isVendor) {
    await store.loadListings();
  }
});
</script>

<style scoped src="./vendor-admin.css"></style>
<style scoped>
.section-hint {
  color: #666;
  margin-bottom: 15px;
}
</style>
