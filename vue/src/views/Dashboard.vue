<template>
  <div class="dashboard">
    <h1>{{ $t('dashboard.title') }}</h1>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="loading-state"
      data-testid="dashboard-loading"
    >
      <div class="spinner" />
      <p>{{ $t('dashboard.loading') }}</p>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="error-state"
      data-testid="dashboard-error"
    >
      <p>{{ error }}</p>
      <button
        class="retry-btn"
        @click="loadDashboardData"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <!-- Dashboard Content -->
    <div
      v-else
      class="dashboard-grid"
    >
      <!-- Profile Summary Card -->
      <div
        class="card profile-card"
        data-testid="profile-summary"
      >
        <h3>{{ $t('dashboard.profileCard.title') }}</h3>
        <div class="profile-info">
          <div class="avatar">
            {{ userInitials }}
          </div>
          <div class="profile-details">
            <span
              class="user-name"
              data-testid="user-name"
            >{{ userName }}</span>
            <span
              class="user-email"
              data-testid="user-email"
            >{{ userEmail }}</span>
            <span
              class="user-status"
              :class="userStatus"
              data-testid="user-status"
            >
              {{ userStatus }}
            </span>
          </div>
        </div>
        <router-link
          to="/dashboard/profile"
          class="card-link"
        >
          {{ $t('dashboard.profileCard.viewProfile') }} →
        </router-link>
      </div>

      <!-- Token Activity Card (requires subscription.tokens.view) -->
      <div
        v-if="hasUserPermission('subscription.tokens.view')"
        class="card token-history-card"
        data-testid="token-history"
      >
        <h3>{{ $t('dashboard.tokenHistoryCard.title') }}</h3>
        <div
          v-if="tokenTransactions.length > 0"
          class="token-list"
        >
          <div
            v-for="tx in tokenTransactions"
            :key="tx.id"
            class="token-item"
            data-testid="token-item"
          >
            <div class="token-info">
              <span class="token-type">{{ formatTransactionType(tx.transaction_type) }}</span>
              <span class="token-date">{{ formatDate(tx.created_at) }}</span>
            </div>
            <span
              class="token-amount"
              :class="tx.amount > 0 ? 'credit' : 'debit'"
            >
              {{ tx.amount > 0 ? '+' : '' }}{{ formatNumber(tx.amount) }}
            </span>
          </div>
        </div>
        <div
          v-else
          class="empty-state"
        >
          <p>{{ $t('dashboard.tokenHistoryCard.noActivity') }}</p>
        </div>
      </div>

      <!-- Recent Invoices Card (requires subscription.invoices.view) -->
      <div
        v-if="hasUserPermission('subscription.invoices.view')"
        class="card invoices-card"
        data-testid="recent-invoices"
      >
        <h3>{{ $t('dashboard.invoicesCard.title') }}</h3>
        <div
          v-if="recentInvoices.length > 0"
          class="invoices-list"
        >
          <router-link
            v-for="invoice in recentInvoices"
            :key="invoice.id"
            :to="`/dashboard/invoice/${invoice.id}`"
            class="invoice-item invoice-item-link"
            data-testid="invoice-item"
          >
            <div class="invoice-info">
              <span class="invoice-number">{{ invoice.invoice_number }}</span>
              <span class="invoice-date">{{ formatDate(invoice.invoiced_at) }}</span>
            </div>
            <div class="invoice-right">
              <span class="invoice-amount">{{ formatPrice(invoice.amount) }}</span>
              <span
                class="invoice-status"
                :class="invoice.status.toLowerCase()"
              >
                {{ invoice.status }}
              </span>
            </div>
          </router-link>
        </div>
        <div
          v-else
          class="no-invoices"
        >
          <p>{{ $t('dashboard.invoicesCard.noInvoices') }}</p>
        </div>
      </div>

      <!-- Plugin Dashboard Widgets (injected by plugins via SDK) -->
      <component
        :is="widget"
        v-for="(widget, index) in dashboardWidgets"
        :key="'plugin-widget-' + index"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useProfileStore } from '../stores/profile';
import { useInvoicesStore } from '../stores/invoices';
import { api, hasUserPermission } from '@/api';
import type { PlatformSDK } from 'vbwd-view-component';

interface TokenTransaction {
  id: string;
  amount: number;
  transaction_type: string;
  created_at: string;
}

const { t } = useI18n();
const profileStore = useProfileStore();
const invoicesStore = useInvoicesStore();
const sdk = inject<PlatformSDK>('platformSDK');

const loading = ref(true);
const error = ref<string | null>(null);

// Profile computed
const userName = computed(() => profileStore.profile?.name || 'User');
const userEmail = computed(() => profileStore.profile?.email || '');
const userStatus = computed(() => 'active');
const userInitials = computed(() => {
  const name = userName.value;
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
});

// Token data
const tokenBalance = ref(0);
const tokenTransactions = ref<TokenTransaction[]>([]);

async function fetchTokenBalance(): Promise<void> {
  try {
    const response = await api.get('/user/tokens/balance') as { balance: number };
    tokenBalance.value = response.balance || 0;
  } catch {
    tokenBalance.value = 0;
  }
}

async function fetchTokenTransactions(): Promise<void> {
  try {
    const response = await api.get('/user/tokens/transactions?limit=10') as { transactions: TokenTransaction[] };
    tokenTransactions.value = response.transactions || [];
  } catch {
    tokenTransactions.value = [];
  }
}

// Invoices computed
const recentInvoices = computed(() => {
  return invoicesStore.invoices.slice(0, 5);
});

// Plugin dashboard widgets
const dashboardWidgets = computed(() => {
  if (!sdk) return [];
  const components = sdk.getComponents();
  return Object.entries(components)
    .filter(([name]) => name.startsWith('Dashboard'))
    .map(([, component]) => component);
});

async function loadDashboardData(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    await Promise.all([
      profileStore.fetchProfile(),
      invoicesStore.fetchInvoices().catch(() => null),
      fetchTokenBalance(),
      fetchTokenTransactions(),
    ]);
  } catch (err) {
    error.value = (err as Error).message || t('dashboard.errors.failedToLoad');
  } finally {
    loading.value = false;
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

function formatPrice(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return '-';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatTransactionType(type: string): string {
  const map: Record<string, string> = {
    purchase: 'Purchase',
    credit: 'Credit',
    refund: 'Refund',
    usage: 'Usage',
    bonus: 'Bonus',
  };
  return map[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

onMounted(() => {
  loadDashboardData();
});
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
}

h1 {
  margin-bottom: 30px;
  color: var(--vbwd-text-heading, #2c3e50);
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
  border: 3px solid var(--vbwd-border-light, #f3f3f3);
  border-top: 3px solid var(--vbwd-color-primary, #3498db);
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
  background: var(--vbwd-color-primary, #3498db);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

.card {
  background: var(--vbwd-card-bg, #ffffff);
  padding: 25px;
  border-radius: 8px;
  box-shadow: var(--vbwd-card-shadow, 0 2px 5px rgba(0, 0, 0, 0.05));
}

.card h3 {
  margin-bottom: 20px;
  color: var(--vbwd-text-heading, #2c3e50);
  font-size: 1.1rem;
  border-bottom: 1px solid var(--vbwd-border-light, #eee);
  padding-bottom: 10px;
}

.card-link {
  display: block;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--vbwd-border-light, #eee);
  color: var(--vbwd-color-primary, #3498db);
  text-decoration: none;
  font-size: 0.9rem;
}

.card-link:hover {
  text-decoration: underline;
}

/* Profile Card */
.profile-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.avatar {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, var(--vbwd-color-primary, #3498db), var(--vbwd-color-primary-hover, #2980b9));
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 600;
}

.profile-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--vbwd-text-heading, #2c3e50);
}

.user-email {
  font-size: 0.9rem;
  color: var(--vbwd-text-muted, #666);
}

.user-status {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  text-transform: capitalize;
  width: fit-content;
}

.user-status.active {
  background: #d4edda;
  color: #155724;
}

/* Invoices Card */
.invoices-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.invoice-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.invoice-item-link {
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.invoice-item-link:hover {
  background-color: #e9ecef;
}

.invoice-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.invoice-number {
  font-weight: 500;
  color: #2c3e50;
}

.invoice-date {
  font-size: 0.8rem;
  color: #666;
}

.invoice-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.invoice-amount {
  font-weight: 600;
  color: #2c3e50;
}

.invoice-status {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.7rem;
  text-transform: capitalize;
}

.invoice-status.paid {
  background: #d4edda;
  color: #155724;
}

.invoice-status.pending {
  background: #fff3cd;
  color: #856404;
}

.invoice-status.overdue {
  background: #f8d7da;
  color: #721c24;
}

.no-invoices {
  text-align: center;
  padding: 20px;
  color: #666;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 20px;
  color: #666;
}

/* Token History Card */
.token-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.token-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.token-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.token-type {
  font-weight: 500;
  color: #2c3e50;
}

.token-date {
  font-size: 0.8rem;
  color: #666;
}

.token-amount {
  font-weight: 600;
  font-size: 1rem;
}

.token-amount.credit {
  color: var(--vbwd-color-success, #27ae60);
}

.token-amount.debit {
  color: var(--vbwd-color-danger, #e74c3c);
}
</style>
