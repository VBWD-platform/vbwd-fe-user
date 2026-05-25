<template>
  <div class="tokens-page">
    <!-- Breadcrumb -->
    <nav class="breadcrumb">
      <router-link
        to="/dashboard/plans"
        data-testid="breadcrumb-plans"
      >
        {{ $t('tokens.breadcrumbPlans') }}
      </router-link>
      <span class="separator">/</span>
      <span>{{ $t('tokens.breadcrumbTokenBundles') }}</span>
    </nav>

    <div class="page-header">
      <h1>{{ $t('tokens.title') }}</h1>
      <p class="subtitle">
        {{ $t('tokens.subtitle') }}
      </p>
    </div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="loading-state"
      data-testid="tokens-loading"
    >
      <div class="spinner" />
      <p>{{ $t('tokens.loading') }}</p>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="error-state"
      data-testid="tokens-error"
    >
      <p>{{ error }}</p>
      <button
        class="retry-btn"
        @click="loadBundles"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <!-- No Bundles -->
    <div
      v-else-if="bundles.length === 0"
      class="no-bundles"
      data-testid="no-bundles"
    >
      <p>{{ $t('tokens.noBundles') }}</p>
    </div>

    <!-- Token Bundles Grid -->
    <div
      v-else
      class="bundles-grid"
      data-testid="bundles-grid"
    >
      <div
        v-for="bundle in bundles"
        :key="bundle.id"
        class="bundle-card"
        :data-testid="`token-bundle-card-${bundle.id}`"
      >
        <div
          class="bundle-amount"
          data-testid="token-amount"
        >
          {{ $t('tokens.tokensLabel', { amount: formatTokenAmount(bundle.token_amount) }) }}
        </div>
        <div
          class="bundle-price"
          data-testid="token-price"
        >
          {{ formatPrice(bundle.price) }}
        </div>
        <p
          v-if="bundle.description"
          class="bundle-description"
        >
          {{ bundle.description }}
        </p>
        <button
          class="add-to-cart-btn"
          :data-testid="`add-to-cart-token-${bundle.id}`"
          @click="addToCart(bundle)"
        >
          {{ $t('tokens.addToCart') }}
        </button>
      </div>
    </div>

    <!-- Back to Plans -->
    <div class="page-footer">
      <router-link
        to="/dashboard/plans"
        class="back-link"
        data-testid="back-to-plans"
      >
        &larr; {{ $t('tokens.backToPlans') }}
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '@/api';
import { useCartStore, eventBus, AppEvents } from 'vbwd-view-component';

interface TokenBundle {
  id: string;
  name: string;
  token_amount: number;
  price: number | string;
  currency: string;
  description?: string;
  is_active: boolean;
}

const { t } = useI18n();
const cartStore = useCartStore();

const bundles = ref<TokenBundle[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function loadBundles() {
  loading.value = true;
  error.value = null;
  try {
    const response = await api.get('/token-bundles') as { bundles: TokenBundle[] };
    bundles.value = (response.bundles || []).filter(b => b.is_active);
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } }; message?: string };
    error.value = err.response?.data?.error || err.message || t('tokens.errors.failedToLoad');
  } finally {
    loading.value = false;
  }
}

function addToCart(bundle: TokenBundle) {
  const numPrice = typeof bundle.price === 'string' ? parseFloat(bundle.price) : bundle.price;
  const name = `${formatTokenAmount(bundle.token_amount)} Tokens`;
  cartStore.addItem({
    type: 'TOKEN_BUNDLE',
    id: bundle.id,
    name,
    price: numPrice,
    metadata: { token_amount: bundle.token_amount },
  });
  eventBus.emit(AppEvents.NOTIFICATION_SHOW, {
    type: 'success',
    message: t('cart.addedToCart', { name }),
    duration: 3000,
  });
}

function formatTokenAmount(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount);
}

function formatPrice(price: number | string): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numPrice);
}

onMounted(() => {
  loadBundles();
});
</script>

<style scoped>
.tokens-page {
  max-width: 1200px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
}

.breadcrumb a {
  color: #3498db;
  text-decoration: none;
}

.breadcrumb a:hover {
  text-decoration: underline;
}

.breadcrumb .separator {
  color: #999;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

.subtitle {
  color: #666;
  font-size: 1rem;
}

.loading-state,
.error-state,
.no-bundles {
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

.bundles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.bundle-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  text-align: center;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.bundle-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  border-color: #3498db;
}

.bundle-amount {
  font-size: 1.5rem;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.bundle-price {
  font-size: 2rem;
  font-weight: 700;
  color: #3498db;
  margin-bottom: 1rem;
}

.bundle-description {
  color: #666;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.add-to-cart-btn {
  width: 100%;
  padding: 12px;
  background-color: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.add-to-cart-btn:hover {
  background-color: #219a52;
}

.page-footer {
  padding-top: 1rem;
}

.back-link {
  color: #3498db;
  text-decoration: none;
  font-size: 0.875rem;
}

.back-link:hover {
  text-decoration: underline;
}
</style>
