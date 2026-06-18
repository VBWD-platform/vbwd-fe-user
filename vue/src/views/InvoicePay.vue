<template>
  <div class="invoice-pay">
    <h1>{{ $t('invoices.pay.title') }}</h1>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="loading-state"
      data-testid="invoice-loading"
    >
      <div class="spinner" />
      <p>{{ $t('invoices.pay.loading') }}</p>
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
        <h2>Invoice {{ invoice.invoice_number }}</h2>

        <div class="invoice-details">
          <div class="detail-row">
            <span class="label">{{ $t('invoices.pay.date') }}</span>
            <span class="value">{{ formatDate(invoice.invoiced_at || invoice.created_at) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">{{ $t('invoices.pay.status') }}</span>
            <span class="value">
              <span
                class="status-badge"
                :class="invoice.status.toLowerCase()"
              >{{ invoice.status }}</span>
            </span>
          </div>
          <div class="detail-row">
            <span class="label">{{ $t('invoices.pay.currency') }}</span>
            <span class="value">{{ invoiceCurrency }}</span>
          </div>
        </div>

        <!-- Line Items -->
        <div
          v-if="invoice.line_items?.length"
          class="line-items"
        >
          <h3>{{ $t('invoices.pay.items') }}</h3>
          <div
            v-for="(item, index) in invoice.line_items"
            :key="index"
            class="line-item"
          >
            <span>{{ item.description }}</span>
            <span>${{ item.total_price }}</span>
          </div>
        </div>

        <div class="total-section">
          <div class="total-row">
            <span class="total-label">{{ $t('invoices.pay.totalAmount') }}</span>
            <span class="total-value">${{ invoice.total_amount || invoice.amount }}</span>
          </div>
        </div>
      </div>

      <!-- Payment Actions -->
      <div class="card payment-card">
        <h2>{{ $t('invoices.pay.paymentTitle') }}</h2>

        <div
          v-if="invoice.status === 'paid'"
          class="paid-notice"
          data-testid="paid-notice"
        >
          <p>{{ $t('invoices.pay.alreadyPaid') }}</p>
          <router-link
            to="/dashboard/subscription"
            class="btn primary"
          >
            {{ $t('common.backToSubscription') }}
          </router-link>
        </div>

        <div
          v-else
          class="payment-actions"
          data-testid="payment-actions"
        >
          <p class="payment-info">
            {{ $t('invoices.pay.paymentInfo') }}
          </p>

          <button
            class="btn primary pay-btn"
            :disabled="processing"
            data-testid="pay-now-btn"
            @click="processPayment"
          >
            {{ processing ? $t('invoices.pay.processing') : $t('invoices.pay.payAmount', { amount: invoice.total_amount || invoice.amount }) }}
          </button>

          <router-link
            to="/dashboard/subscription"
            class="btn secondary"
          >
            {{ $t('common.cancel') }}
          </router-link>
        </div>
      </div>

      <!-- Success Message -->
      <div
        v-if="paymentSuccess"
        class="success-card card"
      >
        <h2>{{ $t('invoices.pay.successTitle') }}</h2>
        <p>{{ $t('invoices.pay.successMessage') }}</p>
        <p>{{ $t('invoices.pay.invoiceNowPaid', { number: invoice.invoice_number }) }}</p>
        <router-link
          to="/dashboard/subscription"
          class="btn primary"
        >
          {{ $t('common.backToSubscription') }}
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '@/api';
import { useAppConfigStore } from '@/stores/appConfig';

interface LineItem {
  type: string;
  description: string;
  quantity: number;
  unit_price: string;
  total_price: string;
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
  line_items?: LineItem[];
}

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const appConfig = useAppConfigStore();

const loading = ref(true);
const error = ref<string | null>(null);
const invoice = ref<Invoice | null>(null);

// An invoice renders in its OWN stored currency (a legal document); if it is
// somehow absent, fall back to the billing default — never a literal (S99).
const invoiceCurrency = computed(() => invoice.value?.currency || appConfig.defaultCurrency);
const processing = ref(false);
const paymentSuccess = ref(false);

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

    // For Stripe invoices, redirect to Stripe checkout flow
    if (invoice.value?.payment_method === 'stripe' && invoice.value?.status === 'pending') {
      router.replace(`/pay/stripe?invoice=${invoice.value.id}`);
      return;
    }
    // For PayPal invoices, redirect to PayPal checkout flow
    if (invoice.value?.payment_method === 'paypal' && invoice.value?.status === 'pending') {
      router.replace(`/pay/paypal?invoice=${invoice.value.id}`);
      return;
    }
  } catch (err) {
    error.value = (err as Error).message || t('invoices.pay.errors.failedToLoad');
  } finally {
    loading.value = false;
  }
}

async function processPayment(): Promise<void> {
  if (!invoice.value) return;

  processing.value = true;
  error.value = null;

  try {
    // Call payment API
    await api.post(`/user/invoices/${invoice.value.id}/pay`, {});

    // Update invoice status locally
    invoice.value.status = 'paid';
    paymentSuccess.value = true;
  } catch (err) {
    error.value = (err as Error).message || t('invoices.pay.errors.paymentFailed');
  } finally {
    processing.value = false;
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
</script>

<style scoped>
.invoice-pay {
  max-width: 600px;
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

.invoice-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  background: white;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.card h2 {
  margin-bottom: 20px;
  color: #2c3e50;
  font-size: 1.2rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.invoice-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
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

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.85rem;
  text-transform: capitalize;
}

.status-badge.paid {
  background: #d4edda;
  color: #155724;
}

.status-badge.pending {
  background: #fff3cd;
  color: #856404;
}

.status-badge.refunded {
  background: #fff3cd;
  color: #856404;
}

.line-items {
  border-top: 1px solid #eee;
  padding-top: 15px;
  margin-bottom: 20px;
}

.line-items h3 {
  font-size: 1rem;
  color: #666;
  margin-bottom: 10px;
}

.line-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.total-section {
  border-top: 2px solid #eee;
  padding-top: 15px;
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

.payment-info {
  color: #666;
  margin-bottom: 20px;
}

.payment-actions {
  text-align: center;
}

.pay-btn {
  font-size: 1.1rem;
  padding: 15px 40px;
  margin-bottom: 15px;
}

.paid-notice {
  text-align: center;
  color: #155724;
  background: #d4edda;
  padding: 20px;
  border-radius: 8px;
}

.paid-notice p {
  margin-bottom: 15px;
}

.success-card {
  text-align: center;
  background: #d4edda;
  border: 1px solid #c3e6cb;
}

.success-card h2 {
  color: #155724;
  border-bottom: none;
}

.success-card p {
  color: #155724;
  margin-bottom: 10px;
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

.btn.primary:hover:not(:disabled) {
  background-color: #2980b9;
}

.btn.primary:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.btn.secondary {
  background-color: #ecf0f1;
  color: #2c3e50;
}

.btn.secondary:hover {
  background-color: #bdc3c7;
}
</style>
