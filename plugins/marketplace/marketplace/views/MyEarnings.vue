<template>
  <div
    class="vendor-view"
    data-testid="my-earnings-view"
  >
    <div class="vendor-header">
      <div class="header-left">
        <h2>{{ t('marketplace.earnings.title') }}</h2>
      </div>
      <router-link
        class="create-btn"
        to="/dashboard/withdraw"
        data-testid="earnings-withdraw"
      >
        {{ t('marketplace.earnings.withdraw') }}
      </router-link>
    </div>

    <div class="summary-tiles">
      <div class="summary-tile">
        <div class="summary-tile__label">
          {{ t('marketplace.earnings.balanceLabel') }}
        </div>
        <div
          class="summary-tile__value"
          data-testid="earnings-balance"
        >
          {{ balanceText }}
        </div>
      </div>
      <div class="summary-tile">
        <div class="summary-tile__label">
          {{ t('marketplace.earnings.entriesLabel') }}
        </div>
        <div class="summary-tile__value">
          {{ store.earnings.length }}
        </div>
      </div>
    </div>

    <div class="vendor-filters">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        data-testid="earnings-search"
        :placeholder="t('marketplace.earnings.searchPlaceholder')"
      >
      <select
        v-model="statusFilter"
        class="filter-select"
        data-testid="earnings-status-filter"
      >
        <option value="">
          {{ t('marketplace.earnings.filterAllStatuses') }}
        </option>
        <option
          v-for="status in statusOptions"
          :key="status"
          :value="status"
        >
          {{ status }}
        </option>
      </select>
    </div>

    <div
      v-if="store.loading"
      class="loading-state"
      data-testid="earnings-loading"
    >
      <div class="spinner" />
      <p>{{ t('marketplace.common.loading') }}</p>
    </div>

    <div
      v-else-if="store.error"
      class="vendor-message error"
      data-testid="earnings-error"
    >
      {{ store.error }}
    </div>

    <div
      v-else-if="filteredEarnings.length === 0"
      class="empty-state"
      data-testid="earnings-empty"
    >
      <p>{{ t('marketplace.earnings.empty') }}</p>
    </div>

    <table
      v-else
      class="data-table"
      data-testid="earnings-table"
    >
      <thead>
        <tr>
          <th
            class="sortable"
            :class="{ sorted: sortColumn === 'gross' }"
            @click="sortBy('gross')"
          >
            {{ t('marketplace.earnings.gross') }}
            <span class="sort-indicator">{{ sortIndicator('gross') }}</span>
          </th>
          <th
            class="sortable"
            :class="{ sorted: sortColumn === 'commission' }"
            @click="sortBy('commission')"
          >
            {{ t('marketplace.earnings.commission') }}
            <span class="sort-indicator">{{ sortIndicator('commission') }}</span>
          </th>
          <th
            class="sortable"
            :class="{ sorted: sortColumn === 'net' }"
            @click="sortBy('net')"
          >
            {{ t('marketplace.earnings.netCredit') }}
            <span class="sort-indicator">{{ sortIndicator('net') }}</span>
          </th>
          <th
            class="sortable"
            :class="{ sorted: sortColumn === 'status' }"
            @click="sortBy('status')"
          >
            {{ t('marketplace.earnings.status') }}
            <span class="sort-indicator">{{ sortIndicator('status') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(entry, index) in filteredEarnings"
          :key="index"
          class="data-row"
          data-testid="earnings-row"
        >
          <td>{{ formatMoney(entry.gross) }}</td>
          <td>{{ formatMoney(entry.commission) }}</td>
          <td>{{ formatMoney(entry.net_credit) }}</td>
          <td>
            <span
              class="status-badge"
              :class="statusClass(entry.status)"
            >
              {{ entry.status }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useVendorStore } from '../stores/vendor';
import type { EarningRow } from '../api';

const { t } = useI18n();
const store = useVendorStore();

const searchQuery = ref('');
const statusFilter = ref('');
type SortKey = 'gross' | 'commission' | 'net' | 'status';
const sortColumn = ref<SortKey>('status');
const sortAsc = ref(true);

const balanceText = computed(() => {
  const balance = store.withdrawableBalance ?? 0;
  return `${balance.toFixed(2)} ${store.currency}`;
});

const statusOptions = computed(() => {
  const set = new Set<string>();
  for (const entry of store.earnings) set.add(String(entry.status));
  return Array.from(set).sort();
});

function formatMoney(value: number | string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? `${parsed.toFixed(2)} ${store.currency}`
    : String(value);
}

function statusClass(status: string): string {
  return status === 'reversed' ? 'inactive' : 'active';
}

const filteredEarnings = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let rows = store.earnings.filter((entry) => {
    if (statusFilter.value && String(entry.status) !== statusFilter.value)
      return false;
    if (query && !String(entry.status).toLowerCase().includes(query))
      return false;
    return true;
  });
  rows = [...rows].sort((a, b) => sortEntries(a, b));
  return rows;
});

function sortEntries(a: EarningRow, b: EarningRow): number {
  const direction = sortAsc.value ? 1 : -1;
  switch (sortColumn.value) {
    case 'gross':
      return (Number(a.gross) - Number(b.gross)) * direction;
    case 'commission':
      return (Number(a.commission) - Number(b.commission)) * direction;
    case 'net':
      return (Number(a.net_credit) - Number(b.net_credit)) * direction;
    case 'status':
    default:
      return String(a.status).localeCompare(String(b.status)) * direction;
  }
}

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

onMounted(() => {
  store.loadEarnings();
});
</script>

<style scoped src="./vendor-admin.css"></style>
