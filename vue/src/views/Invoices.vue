<template>
  <div class="invoices">
    <h1>{{ $t('invoices.title') }}</h1>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="loading-state"
      data-testid="invoices-loading"
    >
      <div class="spinner" />
      <p>{{ $t('invoices.loading') }}</p>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="error-state"
      data-testid="invoices-error"
    >
      <p>{{ error }}</p>
      <button
        class="retry-btn"
        @click="loadInvoices"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <!-- Invoices Content -->
    <div
      v-else
      class="card"
    >
      <!-- Search and Filter -->
      <div class="toolbar">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="$t('invoices.searchPlaceholder')"
            data-testid="invoice-search"
          >
        </div>
        <div class="filter-box">
          <select
            v-model="statusFilter"
            data-testid="status-filter"
          >
            <option value="">
              {{ $t('invoices.filters.allStatuses') }}
            </option>
            <option value="PAID">
              {{ $t('invoices.filters.paid') }}
            </option>
            <option value="PENDING">
              {{ $t('invoices.filters.pending') }}
            </option>
            <option value="OVERDUE">
              {{ $t('invoices.filters.overdue') }}
            </option>
            <option value="REFUNDED">
              {{ $t('invoices.filters.refunded') }}
            </option>
          </select>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="filteredInvoices.length === 0"
        class="empty"
        data-testid="no-invoices"
      >
        <p>{{ searchQuery || statusFilter ? $t('invoices.noInvoicesFiltered') : $t('invoices.noInvoices') }}</p>
      </div>

      <!-- Invoices Table -->
      <table
        v-else
        class="invoice-table"
        data-testid="invoices-table"
      >
        <thead>
          <tr>
            <th
              class="sortable"
              @click="sortBy('invoiced_at')"
            >
              {{ $t('invoices.tableHeaders.date') }}
              <span
                v-if="sortField === 'invoiced_at'"
                class="sort-icon"
              >{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th
              class="sortable"
              @click="sortBy('invoice_number')"
            >
              {{ $t('invoices.tableHeaders.invoiceNumber') }}
              <span
                v-if="sortField === 'invoice_number'"
                class="sort-icon"
              >{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th
              class="sortable"
              @click="sortBy('amount')"
            >
              {{ $t('invoices.tableHeaders.amount') }}
              <span
                v-if="sortField === 'amount'"
                class="sort-icon"
              >{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th
              class="sortable"
              @click="sortBy('status')"
            >
              {{ $t('invoices.tableHeaders.status') }}
              <span
                v-if="sortField === 'status'"
                class="sort-icon"
              >{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th>{{ $t('invoices.tableHeaders.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="invoice in paginatedInvoices"
            :key="invoice.id"
            class="invoice-row"
            :data-testid="`invoice-row-${invoice.id}`"
            @click="viewInvoice(invoice)"
          >
            <td>{{ formatDate(invoice.invoiced_at || invoice.created_at) }}</td>
            <td
              class="invoice-number"
              data-testid="invoice-number"
            >
              {{ invoice.invoice_number }}
            </td>
            <td class="invoice-amount">
              {{ formatPrice(invoice.amount) }}
            </td>
            <td>
              <span
                class="status"
                :class="invoice.status.toLowerCase()"
                :data-testid="`invoice-status-${invoice.id}`"
              >
                {{ invoice.status }}
              </span>
            </td>
            <td
              class="actions-cell"
              @click.stop
            >
              <button
                class="action-btn view"
                data-testid="view-invoice-btn"
                @click="viewInvoice(invoice)"
              >
                {{ $t('common.view') }}
              </button>
              <button
                class="action-btn download"
                data-testid="download-invoice-btn"
                @click="downloadInvoice(invoice.id)"
              >
                {{ $t('common.pdf') }}
              </button>
              <button
                v-if="invoice.status === 'PENDING'"
                class="action-btn pay"
                data-testid="pay-invoice-btn"
                @click="payInvoice(invoice)"
              >
                {{ $t('common.pay') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="pagination"
        data-testid="invoices-pagination"
      >
        <button
          class="page-btn"
          :disabled="currentPage <= 1"
          data-testid="prev-page"
          @click="currentPage--"
        >
          {{ $t('common.previous') }}
        </button>
        <span
          class="page-info"
          data-testid="page-info"
        >{{ $t('common.pageInfo', { currentPage, totalPages }) }}</span>
        <button
          class="page-btn"
          :disabled="currentPage >= totalPages"
          data-testid="next-page"
          @click="currentPage++"
        >
          {{ $t('common.next') }}
        </button>
      </div>
    </div>

    <!-- Success Toast -->
    <div
      v-if="successMessage"
      class="toast success"
      data-testid="success-toast"
    >
      {{ successMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useInvoicesStore, type Invoice } from '../stores/invoices';

const router = useRouter();
const { t } = useI18n();
const invoicesStore = useInvoicesStore();

const loading = ref(true);
const error = ref<string | null>(null);
const searchQuery = ref('');
const statusFilter = ref('');
const sortField = ref('invoiced_at');
const sortDirection = ref<'asc' | 'desc'>('desc');
const currentPage = ref(1);
const pageSize = 10;
const successMessage = ref('');

// Computed
const filteredInvoices = computed(() => {
  let result = [...invoicesStore.invoices];

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(inv =>
      inv.invoice_number.toLowerCase().includes(query) ||
      inv.status.toLowerCase().includes(query)
    );
  }

  // Filter by status
  if (statusFilter.value) {
    result = result.filter(inv => inv.status === statusFilter.value);
  }

  // Sort
  result.sort((a, b) => {
    let aVal: string | number = '';
    let bVal: string | number = '';

    switch (sortField.value) {
      case 'invoice_number':
        aVal = a.invoice_number;
        bVal = b.invoice_number;
        break;
      case 'invoiced_at':
        aVal = a.invoiced_at || a.created_at || '';
        bVal = b.invoiced_at || b.created_at || '';
        break;
      case 'amount':
        aVal = parseFloat(a.amount) || 0;
        bVal = parseFloat(b.amount) || 0;
        break;
      case 'status':
        aVal = a.status;
        bVal = b.status;
        break;
    }

    if (sortDirection.value === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  return result;
});

const totalPages = computed(() => Math.ceil(filteredInvoices.value.length / pageSize));

const paginatedInvoices = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredInvoices.value.slice(start, start + pageSize);
});

// Methods
async function loadInvoices(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    await invoicesStore.fetchInvoices();
  } catch (err) {
    error.value = (err as Error).message || t('invoices.errors.failedToLoad');
  } finally {
    loading.value = false;
  }
}

function sortBy(field: string): void {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = 'desc';
  }
  currentPage.value = 1;
}

function viewInvoice(invoice: Invoice): void {
  router.push(`/dashboard/invoice/${invoice.id}`);
}

async function downloadInvoice(invoiceId: string): Promise<void> {
  try {
    const invoice = invoicesStore.getInvoiceById(invoiceId);
    await invoicesStore.downloadInvoice(invoiceId, invoice?.invoice_number);
    showSuccess(t('invoices.messages.downloadInitiated'));
  } catch (err) {
    error.value = (err as Error).message || t('invoices.errors.failedToDownload');
  }
}

function payInvoice(invoice: Invoice): void {
  router.push(`/dashboard/invoice/${invoice.id}/pay`);
}

function showSuccess(message: string): void {
  successMessage.value = message;
  setTimeout(() => {
    successMessage.value = '';
  }, 3000);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatPrice(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return '-';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

onMounted(() => {
  loadInvoices();
});
</script>

<style scoped>
.invoices {
  max-width: 1000px;
}

h1 {
  margin-bottom: 30px;
  color: #2c3e50;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.retry-btn {
  margin-top: 15px;
  padding: 10px 20px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.card {
  background: white;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.toolbar {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.search-box input {
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
  width: 250px;
}

.filter-box select {
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
  cursor: pointer;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #666;
}

.invoice-table {
  width: 100%;
  border-collapse: collapse;
}

.invoice-table th,
.invoice-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.invoice-table th {
  font-weight: 600;
  color: #666;
  font-size: 0.9rem;
  background: #f8f9fa;
}

.invoice-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.invoice-table th.sortable:hover {
  background: #e9ecef;
}

.sort-icon {
  margin-left: 5px;
}

.invoice-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.invoice-row:hover {
  background: #f8f9fa;
}

.invoice-number {
  font-weight: 500;
  color: #3498db;
}

.invoice-amount {
  font-weight: 500;
}

.status {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.85rem;
  text-transform: capitalize;
}

.status.paid {
  background-color: #d4edda;
  color: #155724;
}

.status.pending {
  background-color: #fff3cd;
  color: #856404;
}

.status.overdue {
  background-color: #f8d7da;
  color: #721c24;
}

.status.refunded {
  background-color: #e2e3e5;
  color: #383d41;
}

.actions-cell {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: opacity 0.2s;
}

.action-btn:hover {
  opacity: 0.8;
}

.action-btn.view {
  background: #e3f2fd;
  color: #1976d2;
}

.action-btn.download {
  background: #e8f5e9;
  color: #388e3c;
}

.action-btn.pay {
  background: #fff3e0;
  color: #f57c00;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.page-btn {
  padding: 8px 16px;
  background: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  background: #e9ecef;
}

.page-btn:disabled {
  color: #aaa;
  cursor: not-allowed;
}

.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 15px 25px;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1001;
}

@media (max-width: 768px) {
  .invoices {
    max-width: 100%;
  }

  .card {
    padding: 16px;
  }

  .toolbar {
    flex-direction: column;
    gap: 10px;
  }

  .search-box input,
  .filter-box select {
    width: 100%;
    box-sizing: border-box;
  }

  .invoice-table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    white-space: nowrap;
  }

  .actions-cell {
    gap: 4px;
  }

  .pagination {
    flex-wrap: wrap;
    gap: 8px;
  }
}

.toast.success {
  background-color: #27ae60;
  color: white;
}
</style>
