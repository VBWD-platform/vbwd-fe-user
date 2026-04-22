<template>
  <div class="invoice-detail">
    <h1>{{ $t('invoices.detail.title') }}</h1>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="loading-state"
      data-testid="invoice-loading"
    >
      <div class="spinner" />
      <p>{{ $t('invoices.detail.loading') }}</p>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="error-state"
      data-testid="invoice-error"
    >
      <p>{{ error }}</p>
      <router-link
        to="/dashboard/subscription"
        class="btn secondary"
      >
        {{ $t('common.backToSubscription') }}
      </router-link>
    </div>

    <!-- Invoice Details -->
    <div
      v-else-if="invoice"
      class="invoice-content"
    >
      <div class="card">
        <div class="invoice-header">
          <h2>Invoice {{ invoice.invoice_number }}</h2>
          <span
            class="status-badge"
            :class="invoice.status.toLowerCase()"
          >{{ invoice.status }}</span>
        </div>

        <div class="invoice-info">
          <div class="detail-row">
            <span class="label">{{ $t('invoices.detail.date') }}</span>
            <span class="value">{{ formatDate(invoice.invoiced_at || invoice.created_at) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">{{ $t('invoices.detail.dueDate') }}</span>
            <span class="value">{{ formatDate(invoice.due_date) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">{{ $t('invoices.detail.currency') }}</span>
            <span class="value">{{ invoice.currency || 'USD' }}</span>
          </div>
          <div
            v-if="invoice.payment_method"
            class="detail-row"
          >
            <span class="label">{{ $t('invoices.detail.paymentMethod') }}</span>
            <span class="value payment-method-badge">{{ paymentMethodLabel(invoice.payment_method) }}</span>
          </div>
        </div>

        <!-- Line Items -->
        <div
          v-if="invoice.line_items?.length"
          class="line-items"
        >
          <h3>{{ $t('invoices.detail.items') }}</h3>

          <!-- Desktop table -->
          <div class="items-table-wrap">
            <table class="items-table">
              <thead>
                <tr>
                  <th>{{ $t('invoices.detail.itemsTableHeaders.type') }}</th>
                  <th>{{ $t('invoices.detail.itemsTableHeaders.description') }}</th>
                  <th>{{ $t('invoices.detail.itemsTableHeaders.qty') }}</th>
                  <th>{{ $t('invoices.detail.itemsTableHeaders.unitPrice') }}</th>
                  <th>{{ $t('invoices.detail.itemsTableHeaders.total') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in invoice.line_items"
                  :key="index"
                  :style="itemLink(item) ? 'cursor: pointer' : ''"
                  @click="itemLink(item) && router.push(itemLink(item)!)"
                >
                  <td>
                    <span
                      class="type-badge"
                      :class="item.type?.toLowerCase()"
                    >{{ itemTypeLabel(item.type, item.extra_data) }}</span>
                  </td>
                  <td>
                    <router-link
                      v-if="itemLink(item)"
                      :to="itemLink(item)!"
                      class="item-description-link"
                      @click.stop
                    >
                      {{ item.description }}
                    </router-link>
                    <span v-else>{{ item.description }}</span>
                  </td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ formatAmount(item.unit_price, invoice.currency) }}</td>
                  <td>{{ formatAmount(item.total_price, invoice.currency) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile cards (one per line item) -->
          <div class="items-cards">
            <div
              v-for="(item, index) in invoice.line_items"
              :key="index"
              class="item-card"
              :class="{ 'item-card-clickable': itemLink(item) }"
              @click="itemLink(item) && router.push(itemLink(item)!)"
            >
              <div class="item-card-header">
                <span
                  class="type-badge"
                  :class="item.type?.toLowerCase()"
                >{{ itemTypeLabel(item.type, item.extra_data) }}</span>
                <span class="item-card-total">{{ formatAmount(item.total_price, invoice.currency) }}</span>
              </div>
              <div class="item-card-desc">
                {{ item.description }}
              </div>
              <div class="item-card-meta">
                <span>{{ $t('invoices.detail.itemsTableHeaders.qty') }}: {{ item.quantity }}</span>
                <span>{{ $t('invoices.detail.itemsTableHeaders.unitPrice') }}: {{ formatAmount(item.unit_price, invoice.currency) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="total-section">
          <div class="total-row">
            <span class="total-label">{{ $t('invoices.detail.totalAmount') }}</span>
            <span class="total-value">${{ invoice.total_amount || invoice.amount }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions">
          <router-link
            to="/dashboard/subscription"
            class="btn secondary"
          >
            {{ $t('common.back') }}
          </router-link>
          <button
            class="btn secondary"
            @click="downloadInvoice"
          >
            {{ $t('invoices.detail.downloadPdf') }}
          </button>
          <router-link
            v-if="invoice.status === 'pending' && invoice.payment_method === 'stripe'"
            :to="`/pay/stripe?invoice=${invoice.id}`"
            class="btn primary"
          >
            {{ $t('invoices.detail.payNow') }}
          </router-link>
          <router-link
            v-else-if="invoice.status === 'pending' && invoice.payment_method === 'paypal'"
            :to="`/pay/paypal?invoice=${invoice.id}`"
            class="btn primary"
          >
            {{ $t('invoices.detail.payNow') }}
          </router-link>
          <router-link
            v-else-if="invoice.status === 'pending' && invoice.payment_method !== 'invoice'"
            :to="`/dashboard/invoice/${invoice.id}/pay`"
            class="btn primary"
          >
            {{ $t('invoices.detail.payNow') }}
          </router-link>
          <button
            v-else-if="invoice.status === 'pending' && invoice.payment_method === 'invoice'"
            class="btn secondary"
            disabled
          >
            {{ $t('invoices.detail.payByInvoice') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '@/api';
import { useInvoicesStore } from '@/stores/invoices';

const invoicesStore = useInvoicesStore();

interface LineItem {
  type: string;
  item_id?: string;
  catalog_item_id?: string;
  description: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  extra_data?: Record<string, unknown>;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  amount: string;
  total_amount?: string;
  currency: string;
  payment_method?: string | null;
  invoiced_at?: string;
  created_at?: string;
  due_date?: string;
  line_items?: LineItem[];
}

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const loading = ref(true);
const error = ref<string | null>(null);
const invoice = ref<Invoice | null>(null);

onMounted(async () => {
  await loadInvoice();
});

async function loadInvoice(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const invoiceId = route.params.invoiceId as string;
    const response = await api.get(`/user/invoices/${invoiceId}`) as { invoice: Invoice } | Invoice;
    invoice.value = (response as { invoice: Invoice }).invoice || response as Invoice;
  } catch (err) {
    error.value = (err as Error).message || t('invoices.detail.errors.failedToLoad');
  } finally {
    loading.value = false;
  }
}

async function downloadInvoice(): Promise<void> {
  if (!invoice.value) return;

  try {
    await invoicesStore.downloadInvoice(
      invoice.value.id,
      invoice.value.invoice_number,
    );
  } catch (err) {
    error.value = (err as Error).message || t('invoices.detail.errors.failedToDownload');
  }
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

function itemTypeLabel(type?: string, extraData?: Record<string, unknown>): string {
  const labels: Record<string, string> = {
    subscription: 'Plan',
    token_bundle: 'Token Bundle',
    add_on: 'Add-On',
    custom: extraData?.plugin === 'booking' ? 'Booking' : 'Custom',
  };
  return labels[type?.toLowerCase() || ''] || type || 'Item';
}

function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    stripe: 'Stripe',
    invoice: t('invoices.detail.paymentMethods.invoice'),
    paypal: 'PayPal',
  };
  return labels[method] || method;
}

function formatAmount(value: string | number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
}

function itemLink(item: { type?: string; item_id?: string; catalog_item_id?: string; extra_data?: Record<string, unknown> }): string | null {
  const catalogId = item.catalog_item_id;
  switch (item.type?.toUpperCase()) {
    case 'SUBSCRIPTION':
      return catalogId ? `/dashboard/plan/${catalogId}` : null;
    case 'TOKEN_BUNDLE':
      return catalogId ? `/dashboard/tokens/${catalogId}` : null;
    case 'ADD_ON':
      return catalogId ? `/dashboard/add-ons/info/${catalogId}` : null;
    case 'CUSTOM':
      if (item.extra_data?.plugin === 'booking' && item.extra_data?.resource_slug) {
        return `/booking/${item.extra_data.resource_slug}`;
      }
      return null;
    default:
      return null;
  }
}
</script>

<style scoped>
.invoice-detail {
  max-width: 800px;
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

.card {
  background: white;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.invoice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.invoice-header h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.3rem;
}

.status-badge {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.85rem;
  text-transform: capitalize;
  font-weight: 500;
}

.status-badge.paid {
  background: #d4edda;
  color: #155724;
}

.status-badge.pending {
  background: #fff3cd;
  color: #856404;
}

.status-badge.overdue {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.refunded {
  background: #fff3cd;
  color: #856404;
}

.invoice-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 25px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-row .label {
  color: #666;
}

.detail-row .value {
  font-weight: 500;
  color: #2c3e50;
}

.payment-method-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  background: #e8f5e9;
  color: #2e7d32;
  font-size: 0.9rem;
  text-transform: capitalize;
}

.line-items {
  border-top: 1px solid #eee;
  padding-top: 20px;
  margin-bottom: 20px;
}

.line-items h3 {
  font-size: 1rem;
  color: #666;
  margin-bottom: 15px;
}

.items-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 420px;
}

.item-row-clickable {
  cursor: pointer;
}

/* Mobile item cards (hidden on desktop) */
.items-cards {
  display: none;
}

.item-card {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 10px;
  background: #fafafa;
}

.item-card-clickable {
  cursor: pointer;
}

.item-card-clickable:hover {
  background: #f0f7ff;
}

.item-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.item-card-total {
  font-weight: 700;
  color: #2c3e50;
  font-size: 1rem;
}

.item-card-desc {
  color: #2c3e50;
  font-size: 0.9rem;
  margin-bottom: 6px;
}

.item-card-meta {
  display: flex;
  gap: 16px;
  font-size: 0.8rem;
  color: #666;
}

.items-table th,
.items-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.items-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9rem;
}

.items-table td:last-child,
.items-table th:last-child {
  text-align: right;
}

.item-description-link {
  color: var(--vbwd-color-primary, #3498db);
  text-decoration: none;
}
.item-description-link:hover {
  text-decoration: underline;
}

.type-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 500;
}

.type-badge.subscription {
  background: #e8f5e9;
  color: #2e7d32;
}

.type-badge.token_bundle {
  background: #e3f2fd;
  color: #1565c0;
}

.type-badge.add_on {
  background: #fce4ec;
  color: #c62828;
}

.type-badge.custom {
  background: #e8f4fd;
  color: #1a73e8;
}

.total-section {
  border-top: 2px solid #eee;
  padding-top: 15px;
  margin-bottom: 25px;
}

.total-row {
  display: flex;
  justify-content: space-between;
  font-size: 1.2rem;
}

.total-label {
  font-weight: 600;
  color: #2c3e50;
}

.total-value {
  font-weight: 700;
  color: #27ae60;
}

.actions {
  display: flex;
  gap: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  text-align: center;
  transition: all 0.2s;
}

.btn.primary {
  background-color: #3498db;
  color: white;
}

.btn.primary:hover {
  background-color: #2980b9;
}

.btn.secondary {
  background-color: #ecf0f1;
  color: #2c3e50;
}

.btn.secondary:hover {
  background-color: #bdc3c7;
}

@media (max-width: 768px) {
  .invoice-detail {
    max-width: 100%;
  }

  .card {
    padding: 16px;
  }

  .invoice-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .detail-row {
    flex-direction: column;
    gap: 2px;
  }

  .detail-row .value {
    font-size: 0.9rem;
  }

  /* Hide table, show cards */
  .items-table-wrap {
    display: none;
  }

  .items-cards {
    display: block;
  }

  .actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
    text-align: center;
  }
}
</style>
