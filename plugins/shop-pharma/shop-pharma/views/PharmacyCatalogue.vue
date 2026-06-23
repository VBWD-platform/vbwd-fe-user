<template>
  <div
    class="pharmacy-catalogue"
    data-testid="pharmacy-catalogue"
  >
    <header class="pharmacy-catalogue__header">
      <h1 class="pharmacy-catalogue__title">
        Pharmacy
      </h1>
      <img
        v-if="store.region?.registered_pharmacy_logo_url"
        :src="store.region.registered_pharmacy_logo_url"
        :alt="`Registered pharmacy — ${store.region.name}`"
        class="pharmacy-catalogue__logo"
        data-testid="pharmacy-region-logo"
      >
    </header>

    <div
      v-if="store.loading"
      class="pharmacy-catalogue__status"
      data-testid="pharmacy-catalogue-loading"
    >
      Loading catalogue…
    </div>

    <div
      v-else-if="store.error"
      class="pharmacy-catalogue__status pharmacy-catalogue__status--error"
      data-testid="pharmacy-catalogue-error"
    >
      {{ store.error }}
    </div>

    <div
      v-else-if="!store.populatedSegments.length"
      class="pharmacy-catalogue__status"
      data-testid="pharmacy-catalogue-empty"
    >
      No products available.
    </div>

    <section
      v-for="segment in store.populatedSegments"
      v-else
      :key="segment.category_slug"
      class="pharmacy-catalogue__segment"
      :data-testid="`pharmacy-segment-${segment.product_class}`"
    >
      <div class="pharmacy-catalogue__segment-head">
        <h2 class="pharmacy-catalogue__segment-title">
          {{ segment.category_name }}
        </h2>
        <span
          class="pharmacy-catalogue__class-badge"
          :class="`pharmacy-catalogue__class-badge--${segment.product_class}`"
          :data-testid="`pharmacy-class-badge-${segment.product_class}`"
        >
          {{ classLabel(segment.product_class) }}
        </span>
      </div>

      <div class="pharmacy-catalogue__grid">
        <router-link
          v-for="product in segment.products"
          :key="product.id"
          class="pharmacy-card"
          :to="{ name: 'pharmacy-product', params: { slug: product.slug } }"
          :data-testid="`pharmacy-card-${product.slug}`"
        >
          <div class="pharmacy-card__image-wrap">
            <img
              v-if="product.primary_image_url"
              :src="product.primary_image_url"
              :alt="product.name"
              class="pharmacy-card__image"
            >
            <div
              v-else
              class="pharmacy-card__image pharmacy-card__image--placeholder"
            >
              {{ classLabel(segment.product_class) }}
            </div>
          </div>
          <div class="pharmacy-card__body">
            <span class="pharmacy-card__name">{{ product.name }}</span>
            <span
              v-if="product.pharma_profile.strength"
              class="pharmacy-card__strength"
            >{{ product.pharma_profile.strength }}</span>
            <span
              class="pharmacy-card__class"
              :class="`pharmacy-card__class--${segment.product_class}`"
            >{{ classLabel(segment.product_class) }}</span>
          </div>
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { usePharmacyStore } from '../stores/pharmacy';
import { classLabel } from '../classLabels';

const store = usePharmacyStore();
const route = useRoute();

onMounted(() => {
  const categorySlug = route.params.slug as string | undefined;
  store.fetchCatalogue(categorySlug || undefined);
});
</script>

<style scoped>
.pharmacy-catalogue {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem;
}

.pharmacy-catalogue__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.pharmacy-catalogue__title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  color: var(--vbwd-text-primary, #1a1a1a);
}

.pharmacy-catalogue__logo {
  height: 48px;
  width: auto;
  object-fit: contain;
}

.pharmacy-catalogue__status {
  padding: 2rem;
  text-align: center;
  color: var(--vbwd-text-secondary, #666);
}

.pharmacy-catalogue__status--error {
  color: var(--vbwd-color-danger, #dc3545);
}

.pharmacy-catalogue__segment {
  margin-bottom: 2.5rem;
}

.pharmacy-catalogue__segment-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid var(--vbwd-border-color, #e5e5e5);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.pharmacy-catalogue__segment-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: var(--vbwd-text-primary, #222);
}

.pharmacy-catalogue__class-badge {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--vbwd-bg-muted, #eef);
  color: var(--vbwd-text-secondary, #445);
}

.pharmacy-catalogue__class-badge--RX {
  background: #fde8e8;
  color: #b42318;
}

.pharmacy-catalogue__class-badge--OTC {
  background: #e7f4ea;
  color: #1a7f37;
}

.pharmacy-catalogue__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.pharmacy-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vbwd-border-color, #e5e5e5);
  border-radius: 8px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  background: var(--vbwd-bg-surface, #fff);
  transition: box-shadow 0.15s, transform 0.15s;
}

.pharmacy-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.pharmacy-card__image-wrap {
  aspect-ratio: 1;
  background: var(--vbwd-bg-muted, #f6f6f6);
}

.pharmacy-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pharmacy-card__image--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--vbwd-text-secondary, #999);
}

.pharmacy-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
}

.pharmacy-card__name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--vbwd-text-primary, #1a1a1a);
}

.pharmacy-card__strength {
  font-size: 0.8125rem;
  color: var(--vbwd-text-secondary, #666);
}

.pharmacy-card__class {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--vbwd-text-secondary, #888);
}

.pharmacy-card__class--RX {
  color: #b42318;
}
</style>
