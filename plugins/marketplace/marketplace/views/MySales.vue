<template>
  <div
    class="vendor-view"
    data-testid="my-sales-view"
  >
    <div class="vendor-header">
      <div class="header-left">
        <h2>{{ t('marketplace.sales.title') }}</h2>
        <span
          v-if="!store.loading"
          class="total-count"
        >{{ filteredSales.length }} {{ t('marketplace.common.entries') }}</span>
      </div>
    </div>

    <div class="vendor-filters">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        data-testid="sales-search"
        :placeholder="t('marketplace.sales.searchPlaceholder')"
      >
    </div>

    <div
      v-if="store.loading"
      class="loading-state"
      data-testid="sales-loading"
    >
      <div class="spinner" />
      <p>{{ t('marketplace.common.loading') }}</p>
    </div>

    <div
      v-else-if="store.error"
      class="vendor-message error"
      data-testid="sales-error"
    >
      {{ store.error }}
    </div>

    <div
      v-else-if="filteredSales.length === 0"
      class="empty-state"
      data-testid="sales-empty"
    >
      <p>{{ t('marketplace.sales.empty') }}</p>
    </div>

    <table
      v-else
      class="data-table"
      data-testid="sales-table"
    >
      <thead>
        <tr>
          <th
            class="sortable"
            :class="{ sorted: sortColumn === 'invoice' }"
            @click="sortBy('invoice')"
          >
            {{ t('marketplace.sales.invoice') }}
            <span class="sort-indicator">{{ sortIndicator('invoice') }}</span>
          </th>
          <th
            class="sortable"
            :class="{ sorted: sortColumn === 'gross' }"
            @click="sortBy('gross')"
          >
            {{ t('marketplace.sales.gross') }}
            <span class="sort-indicator">{{ sortIndicator('gross') }}</span>
          </th>
          <th
            class="sortable"
            :class="{ sorted: sortColumn === 'net' }"
            @click="sortBy('net')"
          >
            {{ t('marketplace.sales.netCredit') }}
            <span class="sort-indicator">{{ sortIndicator('net') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="sale in filteredSales"
          :key="sale.invoice_id"
          class="data-row"
          data-testid="sales-row"
        >
          <td data-testid="sales-row-invoice">
            {{ sale.invoice_id }}
          </td>
          <td data-testid="sales-row-gross">
            {{ formatMoney(sale.gross_total) }}
          </td>
          <td data-testid="sales-row-net">
            {{ formatMoney(sale.net_credit_total) }}
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

const { t } = useI18n();
const store = useVendorStore();

const searchQuery = ref('');
type SortKey = 'invoice' | 'gross' | 'net';
const sortColumn = ref<SortKey>('invoice');
const sortAsc = ref(true);

function formatMoney(value: number | string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(2)} ${store.currency}` : String(value);
}

const filteredSales = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let rows = store.sales.filter((sale) =>
    query ? String(sale.invoice_id).toLowerCase().includes(query) : true,
  );
  rows = [...rows].sort((a, b) => {
    const direction = sortAsc.value ? 1 : -1;
    if (sortColumn.value === 'gross') {
      return (Number(a.gross_total) - Number(b.gross_total)) * direction;
    }
    if (sortColumn.value === 'net') {
      return (
        (Number(a.net_credit_total) - Number(b.net_credit_total)) * direction
      );
    }
    return String(a.invoice_id).localeCompare(String(b.invoice_id)) * direction;
  });
  return rows;
});

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
  store.loadSales();
});
</script>

<style scoped src="./vendor-admin.css"></style>
