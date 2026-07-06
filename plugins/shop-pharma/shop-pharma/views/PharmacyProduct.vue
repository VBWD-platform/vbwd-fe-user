<template>
  <div
    class="pharmacy-product"
    data-testid="pharmacy-product"
  >
    <div
      v-if="loading"
      class="pharmacy-product__status"
      data-testid="pharmacy-product-loading"
    >
      Loading product…
    </div>

    <div
      v-else-if="error"
      class="pharmacy-product__status pharmacy-product__status--error"
      data-testid="pharmacy-product-error"
    >
      {{ error }}
    </div>

    <div
      v-else-if="!product"
      class="pharmacy-product__status"
      data-testid="pharmacy-product-empty"
    >
      Product not found.
    </div>

    <template v-else>
      <div class="pharmacy-product__gallery">
        <img
          :src="primaryImageUrl || undefined"
          :alt="product.name"
          class="pharmacy-product__image"
          data-testid="pharmacy-product-image"
        >
        <img
          v-if="region?.registered_pharmacy_logo_url"
          :src="region.registered_pharmacy_logo_url"
          :alt="`Registered pharmacy — ${region.name}`"
          class="pharmacy-product__pharmacy-logo"
          data-testid="pharmacy-product-region-logo"
        >
      </div>

      <div class="pharmacy-product__info">
        <span
          class="pharmacy-product__class"
          :class="`pharmacy-product__class--${productClass}`"
          data-testid="pharmacy-product-class"
        >{{ classLabel(productClass) }}</span>

        <h1
          class="pharmacy-product__name"
          data-testid="pharmacy-product-name"
        >
          {{ product.name }}
        </h1>

        <p
          v-if="product.description"
          class="pharmacy-product__description"
        >
          {{ product.description }}
        </p>

        <!-- Medicine profile: substance / strength / form -->
        <dl
          v-if="isMedicine"
          class="pharmacy-product__profile"
          data-testid="pharmacy-product-medicine-profile"
        >
          <template v-if="profile.active_substances && profile.active_substances.length">
            <dt>Active substance</dt>
            <dd>{{ profile.active_substances.join(', ') }}</dd>
          </template>
          <template v-if="profile.strength">
            <dt>Strength</dt>
            <dd>{{ profile.strength }}</dd>
          </template>
          <template v-if="profile.pharmaceutical_form">
            <dt>Form</dt>
            <dd>{{ profile.pharmaceutical_form }}</dd>
          </template>
          <template v-if="profile.marketing_authorisation_holder">
            <dt>Marketing authorisation holder</dt>
            <dd>{{ profile.marketing_authorisation_holder }}</dd>
          </template>
        </dl>

        <!-- Device profile: CE/UKCA marking -->
        <dl
          v-if="isDevice && profile.device_marking"
          class="pharmacy-product__profile"
          data-testid="pharmacy-product-device-profile"
        >
          <dt>Device marking</dt>
          <dd>{{ profile.device_marking }}</dd>
        </dl>

        <!-- Storage + warnings -->
        <p
          v-if="profile.storage_conditions"
          class="pharmacy-product__storage"
          data-testid="pharmacy-product-storage"
        >
          <strong>Storage:</strong> {{ profile.storage_conditions }}
        </p>
        <p
          v-if="profile.warnings"
          class="pharmacy-product__warnings"
          data-testid="pharmacy-product-warnings"
        >
          <strong>Warnings:</strong> {{ profile.warnings }}
        </p>

        <!-- Leaflet / SmPC -->
        <div class="pharmacy-product__docs">
          <a
            v-if="profile.leaflet_url"
            :href="profile.leaflet_url"
            target="_blank"
            rel="noopener"
            class="pharmacy-product__doc-link"
            data-testid="pharmacy-product-leaflet"
          >Package leaflet (PIL)</a>
          <a
            v-if="profile.smpc_url"
            :href="profile.smpc_url"
            target="_blank"
            rel="noopener"
            class="pharmacy-product__doc-link"
          >Summary of product characteristics</a>
        </div>

        <!-- Pack-variant picker -->
        <div
          v-if="variants.length"
          class="pharmacy-product__variants"
          data-testid="pharmacy-product-variants"
        >
          <label class="pharmacy-product__variants-label">Pack size</label>
          <div class="pharmacy-product__variant-buttons">
            <button
              v-for="variant in variants"
              :key="variant.id"
              type="button"
              class="pharmacy-product__variant"
              :class="{ 'pharmacy-product__variant--active': selectedVariantId === variant.id }"
              :data-testid="`pharmacy-variant-${variant.id}`"
              @click="selectedVariantId = variant.id"
            >
              {{ variant.name }}
            </button>
          </div>
        </div>

        <p
          class="pharmacy-product__price"
          data-testid="pharmacy-product-price"
        >
          {{ formattedPrice }}
        </p>

        <!-- RX: blocked from direct online purchase -->
        <div
          v-if="purchaseBlocked"
          class="pharmacy-product__rx-block"
          data-testid="pharmacy-product-rx-block"
        >
          <strong>Prescription required</strong>
          <p>
            This is a prescription-only medicine and cannot be purchased online.
            Please consult a pharmacist or your doctor.
          </p>
          <button
            class="pharmacy-product__add"
            disabled
            data-testid="pharmacy-product-add-to-cart"
          >
            Prescription required
          </button>
        </div>

        <!-- Sellable classes -->
        <template v-else>
          <!-- OTC age gate -->
          <div
            v-if="needsAgeGate && !ageConfirmed"
            class="pharmacy-product__age-gate"
            data-testid="pharmacy-product-age-gate"
          >
            <p>
              This product has an age restriction of
              {{ ageRestriction }}+ years. Please confirm you meet the
              minimum age.
            </p>
            <button
              type="button"
              class="pharmacy-product__age-confirm"
              data-testid="pharmacy-product-age-confirm"
              @click="ageConfirmed = true"
            >
              I am {{ ageRestriction }} or older
            </button>
          </div>

          <div class="pharmacy-product__buy-row">
            <div
              v-if="maxQuantity !== null"
              class="pharmacy-product__qty"
              data-testid="pharmacy-product-qty"
            >
              <button
                type="button"
                class="pharmacy-product__qty-btn"
                data-testid="pharmacy-product-qty-dec"
                @click="setQuantity(quantity - 1)"
              >
                −
              </button>
              <span data-testid="pharmacy-product-qty-value">{{ quantity }}</span>
              <button
                type="button"
                class="pharmacy-product__qty-btn"
                data-testid="pharmacy-product-qty-inc"
                @click="setQuantity(quantity + 1)"
              >
                +
              </button>
            </div>
            <button
              class="pharmacy-product__add"
              :disabled="addToCartDisabled"
              data-testid="pharmacy-product-add-to-cart"
              @click="handleAddToCart"
            >
              {{ addedFeedback ? 'Added!' : 'Add to cart' }}
            </button>
            <router-link
              v-if="cartStore.itemCount > 0"
              :to="{ name: 'shop-cart' }"
              class="pharmacy-product__view-cart"
              data-testid="pharmacy-product-view-cart"
            >
              View cart ({{ cartStore.itemCount }})
            </router-link>
          </div>
          <p
            v-if="maxQuantity !== null"
            class="pharmacy-product__qty-note"
            data-testid="pharmacy-product-qty-note"
          >
            Maximum {{ maxQuantity }} per order.
          </p>
        </template>

        <!-- Compliance affordances from the active region (no hardcoding) -->
        <div
          v-if="region"
          class="pharmacy-product__compliance"
          data-testid="pharmacy-product-compliance"
        >
          <a
            v-if="region.national_register_url"
            :href="region.national_register_url"
            target="_blank"
            rel="noopener"
            class="pharmacy-product__compliance-link"
            data-testid="pharmacy-product-register-link"
          >
            Verify on the {{ region.name }} pharmacy register
          </a>
          <a
            v-if="pharmacovigilanceUrl"
            :href="pharmacovigilanceUrl"
            target="_blank"
            rel="noopener"
            class="pharmacy-product__compliance-link"
            data-testid="pharmacy-product-pharmacovigilance"
          >
            Report a side effect (pharmacovigilance)
          </a>
          <p
            v-if="!profile.withdrawal_right_exempt && region.withdrawal_right_copy"
            class="pharmacy-product__withdrawal"
            data-testid="pharmacy-product-withdrawal"
          >
            {{ region.withdrawal_right_copy }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/api';
import { useAppConfigStore } from '@/stores/appConfig';
import { useCartStore } from '../../../shop/shop/stores/cart';
import type { PharmaProfile, PharmaRegion } from '../stores/pharmacy';
import { classLabel } from '../classLabels';
import {
  isPurchaseBlocked,
  requiresAgeGate,
  effectiveAgeRestriction,
  effectiveMaxQuantity,
  clampQuantity,
} from '../gates';

interface ProductVariant {
  id: string;
  name: string;
  sku: string | null;
  price: number | string | null;
  price_float: number | null;
  attributes: Record<string, string>;
  stock_available?: number | null;
}

interface ProductImage {
  url: string;
  is_primary: boolean;
}

interface PharmaProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  primary_image_url: string | null;
  images: ProductImage[];
  has_variants: boolean;
  product_type_slug?: string | null;
  pharma_profile: PharmaProfile;
  variants: ProductVariant[];
  region: PharmaRegion | null;
}

const route = useRoute();
const cartStore = useCartStore();
const appConfig = useAppConfigStore();
const productSlug = route.params.slug as string;

/** Display currency: the active region's, else the S99 billing default. */
const displayCurrency = computed(
  () => region.value?.display_currency || appConfig.defaultCurrency,
);

const loading = ref(true);
const error = ref<string | null>(null);
const product = ref<PharmaProductDetail | null>(null);
const region = ref<PharmaRegion | null>(null);
const selectedVariantId = ref<string | null>(null);
const quantity = ref(1);
const ageConfirmed = ref(false);
const addedFeedback = ref(false);

const profile = computed<PharmaProfile>(
  () =>
    product.value?.pharma_profile ?? ({
      product_class: null,
      active_substances: null,
      strength: null,
      pharmaceutical_form: null,
      atc_code: null,
      marketing_authorisation_holder: null,
      device_marking: null,
      leaflet_url: null,
      smpc_url: null,
      pharmacovigilance_url: null,
      storage_conditions: null,
      warnings: null,
      age_restriction_years: null,
      max_quantity_per_order: null,
      professional_only: null,
      withdrawal_right_exempt: null,
    } as PharmaProfile),
);

const productClass = computed(() => profile.value.product_class);
const isMedicine = computed(
  () => productClass.value === 'RX' || productClass.value === 'OTC',
);
const isDevice = computed(() => productClass.value === 'MEDICAL_DEVICE');
const variants = computed(() => product.value?.variants ?? []);

const gateRegion = computed(() => ({
  default_age_restriction_years: region.value?.default_age_restriction_years ?? 0,
  default_max_quantity_per_order: region.value?.default_max_quantity_per_order ?? null,
}));

const purchaseBlocked = computed(() => isPurchaseBlocked(productClass.value));
const needsAgeGate = computed(() => requiresAgeGate(profile.value, gateRegion.value));
const ageRestriction = computed(() =>
  effectiveAgeRestriction(profile.value, gateRegion.value),
);
const maxQuantity = computed(() =>
  effectiveMaxQuantity(profile.value, gateRegion.value),
);

const addToCartDisabled = computed(
  () => addedFeedback.value || (needsAgeGate.value && !ageConfirmed.value),
);

const primaryImageUrl = computed(() => {
  if (!product.value) {
    return null;
  }
  const primary = product.value.images.find((image) => image.is_primary);
  return primary?.url ?? product.value.primary_image_url ?? product.value.images[0]?.url ?? null;
});

const pharmacovigilanceUrl = computed(
  () => profile.value.pharmacovigilance_url || region.value?.pharmacovigilance_url || '',
);

const selectedVariant = computed(() =>
  variants.value.find((variant) => variant.id === selectedVariantId.value) ?? null,
);

const unitPrice = computed(() => {
  const variant = selectedVariant.value;
  if (variant) {
    return Number(variant.price_float ?? variant.price ?? 0);
  }
  return Number(product.value?.price ?? 0);
});

const formattedPrice = computed(
  () => `${unitPrice.value.toFixed(2)} ${displayCurrency.value}`,
);

function setQuantity(requested: number): void {
  quantity.value = clampQuantity(requested, profile.value, gateRegion.value);
}

async function fetchProduct(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const response = await api.get<{ product: PharmaProductDetail }>(
      `/pharma/products/${productSlug}`,
    );
    product.value = response.product;
    region.value = response.product.region;
    if (response.product.variants.length > 0) {
      selectedVariantId.value = response.product.variants[0].id;
    }
  } catch (fetchError) {
    error.value = (fetchError as Error).message || 'Product not found';
  } finally {
    loading.value = false;
  }
}

function handleAddToCart(): void {
  if (!product.value || addToCartDisabled.value) {
    return;
  }
  const variant = selectedVariant.value;
  const finalQuantity = clampQuantity(quantity.value, profile.value, gateRegion.value);

  cartStore.addItem({
    productId: product.value.id,
    productSlug: product.value.slug,
    productName: variant ? `${product.value.name} — ${variant.name}` : product.value.name,
    imageUrl: primaryImageUrl.value || '',
    price: unitPrice.value,
    currency: displayCurrency.value,
    quantity: finalQuantity,
    maxQuantity: maxQuantity.value ?? 999,
    isDigital: product.value.product_type_slug === 'digital',
    weight: 0,
    variantId: variant?.id,
    variantName: variant?.name,
  });

  addedFeedback.value = true;
  setTimeout(() => {
    addedFeedback.value = false;
  }, 2000);
}

onMounted(fetchProduct);
</script>

<style scoped>
.pharmacy-product {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1.5rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.pharmacy-product__status {
  grid-column: 1 / -1;
  padding: 2rem;
  text-align: center;
  color: var(--vbwd-text-secondary, #666);
}

.pharmacy-product__status--error {
  color: var(--vbwd-color-danger, #dc3545);
}

.pharmacy-product__gallery {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pharmacy-product__image {
  width: 100%;
  border-radius: 8px;
  object-fit: cover;
  aspect-ratio: 1;
  background: var(--vbwd-bg-muted, #f6f6f6);
}

.pharmacy-product__pharmacy-logo {
  height: 56px;
  width: auto;
  align-self: flex-start;
  object-fit: contain;
}

.pharmacy-product__info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pharmacy-product__class {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--vbwd-text-secondary, #888);
}

.pharmacy-product__class--RX {
  color: #b42318;
}

.pharmacy-product__name {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  color: var(--vbwd-text-primary, #1a1a1a);
}

.pharmacy-product__description {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--vbwd-text-secondary, #555);
  margin: 0;
}

.pharmacy-product__profile {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 1rem;
  margin: 0;
  font-size: 0.875rem;
}

.pharmacy-product__profile dt {
  font-weight: 600;
  color: var(--vbwd-text-secondary, #666);
}

.pharmacy-product__profile dd {
  margin: 0;
  color: var(--vbwd-text-primary, #222);
}

.pharmacy-product__storage,
.pharmacy-product__warnings {
  font-size: 0.875rem;
  margin: 0;
  color: var(--vbwd-text-secondary, #555);
}

.pharmacy-product__docs {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.pharmacy-product__doc-link,
.pharmacy-product__compliance-link {
  font-size: 0.875rem;
  color: var(--vbwd-color-primary, #2563eb);
  text-decoration: underline;
}

.pharmacy-product__variants-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--vbwd-text-secondary, #666);
  margin-bottom: 0.25rem;
}

.pharmacy-product__variant-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pharmacy-product__variant {
  padding: 0.4rem 0.85rem;
  border: 1px solid var(--vbwd-border-color, #ccc);
  border-radius: 6px;
  background: var(--vbwd-bg-surface, #fff);
  cursor: pointer;
  font-size: 0.875rem;
}

.pharmacy-product__variant--active {
  border-color: var(--vbwd-color-primary, #2563eb);
  color: var(--vbwd-color-primary, #2563eb);
  font-weight: 600;
}

.pharmacy-product__price {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--vbwd-color-primary, #1a1a1a);
  margin: 0;
}

.pharmacy-product__rx-block {
  border: 1px solid #f5c2c0;
  background: #fdecea;
  border-radius: 8px;
  padding: 1rem;
  color: #842029;
}

.pharmacy-product__rx-block p {
  margin: 0.5rem 0 0.75rem;
  font-size: 0.875rem;
}

.pharmacy-product__age-gate {
  border: 1px solid #ffe1a8;
  background: #fff7e6;
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.875rem;
}

.pharmacy-product__age-confirm {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  background: var(--vbwd-color-primary, #2563eb);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.pharmacy-product__buy-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.pharmacy-product__qty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--vbwd-border-color, #ccc);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
}

.pharmacy-product__qty-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  font-size: 1.1rem;
  cursor: pointer;
}

.pharmacy-product__qty-note {
  font-size: 0.8125rem;
  color: var(--vbwd-text-secondary, #888);
  margin: 0;
}

.pharmacy-product__add {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--vbwd-color-primary, #2563eb);
  color: #fff;
}

.pharmacy-product__add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pharmacy-product__view-cart {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--vbwd-color-primary, #2563eb);
  text-decoration: none;
}

.pharmacy-product__compliance {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid var(--vbwd-border-color, #e5e5e5);
  padding-top: 0.75rem;
  margin-top: 0.5rem;
}

.pharmacy-product__withdrawal {
  font-size: 0.8125rem;
  color: var(--vbwd-text-secondary, #777);
  margin: 0;
}

@media (max-width: 640px) {
  .pharmacy-product {
    grid-template-columns: 1fr;
  }
}
</style>
