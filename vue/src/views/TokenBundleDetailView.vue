<template>
  <div class="bundle-detail-view">
    <div
      v-if="loading"
      class="loading-state"
      data-testid="bundle-detail-loading"
    >
      <div class="spinner" />
      <p>{{ $t('tokenBundleDetail.loading') }}</p>
    </div>

    <div
      v-else-if="error"
      class="error-state"
      data-testid="bundle-detail-error"
    >
      <p>{{ error }}</p>
      <button
        class="btn secondary"
        @click="$router.back()"
      >
        {{ $t('common.back') }}
      </button>
    </div>

    <template v-else-if="bundle">
      <a
        href="#"
        class="back-link"
        data-testid="back-link"
        @click.prevent="$router.back()"
      >
        &larr; {{ $t('tokenBundleDetail.backLink') }}
      </a>

      <h1>{{ $t('tokenBundleDetail.title') }}</h1>

      <div
        class="detail-card"
        data-testid="bundle-detail-content"
      >
        <div class="detail-header">
          <h2 data-testid="bundle-name">
            {{ bundle.name }}
          </h2>
        </div>

        <p
          v-if="bundle.description"
          class="bundle-description"
        >
          {{ bundle.description }}
        </p>

        <div class="detail-grid">
          <div class="detail-item">
            <span class="label">{{ $t('tokenBundleDetail.tokenAmount') }}</span>
            <span class="value">{{ formatTokenAmount(bundle.token_amount) }}</span>
          </div>
          <div class="detail-item">
            <span class="label">{{ $t('tokenBundleDetail.price') }}</span>
            <span class="value">{{ formatPrice(bundle.price) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '@/api';
import { useDisplayPrice } from '@/composables/useDisplayPrice';

interface TokenBundle {
  id: string;
  name: string;
  description?: string | null;
  token_amount: number;
  price: string | number;
  is_active?: boolean;
}

const route = useRoute();
const { t } = useI18n();
const displayPrice = useDisplayPrice();

const loading = ref(true);
const error = ref<string | null>(null);
const bundle = ref<TokenBundle | null>(null);

onMounted(async () => {
  loading.value = true;
  error.value = null;

  try {
    const bundleId = route.params.bundleId as string;
    const response = await api.get(`/token-bundles/${bundleId}`) as { bundle: TokenBundle } | TokenBundle;
    bundle.value = (response as { bundle: TokenBundle }).bundle || response as TokenBundle;
  } catch (err) {
    error.value = (err as Error).message || t('tokenBundleDetail.error');
  } finally {
    loading.value = false;
  }
});

function formatTokenAmount(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount);
}

function formatPrice(price: string | number | null | undefined): string {
  if (price === null || price === undefined) return '-';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  // Storefront catalog price — follows the view-only display-currency switch
  // (S99.4); identity (operating currency) when display == billing.
  return displayPrice.formatInDisplay(num);
}
</script>

<style scoped>
.bundle-detail-view {
  max-width: 800px;
}

.back-link {
  display: inline-block;
  margin-bottom: 20px;
  color: #3498db;
  text-decoration: none;
  font-size: 0.9rem;
}

.back-link:hover {
  text-decoration: underline;
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

h1 {
  margin-bottom: 20px;
  color: #2c3e50;
}

.detail-card {
  background: white;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 15px;
}

.detail-header h2 {
  margin: 0;
  color: #2c3e50;
}

.bundle-description {
  color: #666;
  margin-bottom: 20px;
  line-height: 1.5;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item .label {
  font-size: 0.85rem;
  color: #666;
}

.detail-item .value {
  font-weight: 500;
  color: #2c3e50;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
}

.btn.secondary {
  background-color: #ecf0f1;
  color: #2c3e50;
}
</style>
