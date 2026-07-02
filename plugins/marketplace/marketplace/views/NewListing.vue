<template>
  <div
    class="vendor-view"
    data-testid="new-listing-view"
  >
    <router-link
      class="back-link"
      to="/marketplace/listings"
    >
      ← {{ t('marketplace.edit.backToListings') }}
    </router-link>

    <div class="vendor-header">
      <div class="header-left">
        <h2>{{ t('marketplace.newListing.title') }}</h2>
      </div>
    </div>

    <div
      class="tabs-container"
      role="tablist"
    >
      <button
        v-for="tab in tabs"
        :key="tab"
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === tab }"
        :data-testid="`tab-${tab}`"
        @click="activeTab = tab"
      >
        {{ t(`marketplace.newListing.tabs.${tab}`) }}
      </button>
    </div>

    <!-- Product -->
    <form
      v-if="activeTab === 'product'"
      class="form-section"
      @submit.prevent="submitProduct"
    >
      <div class="form-row">
        <div class="form-group">
          <label>{{ t('marketplace.fields.name') }}</label>
          <input
            v-model="product.name"
            type="text"
            class="form-input"
            data-testid="product-name"
          >
        </div>
        <div class="form-group">
          <label>{{ t('marketplace.fields.slug') }}</label>
          <input
            v-model="product.slug"
            type="text"
            class="form-input"
          >
        </div>
      </div>
      <div class="form-group">
        <label>{{ t('marketplace.fields.description') }}</label>
        <textarea
          v-model="product.description"
          class="form-input"
          rows="3"
        />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>{{ t('marketplace.fields.price') }}</label>
          <input
            v-model.number="product.price"
            type="number"
            step="0.01"
            class="form-input"
            data-testid="product-price"
          >
        </div>
        <div class="form-group form-group--checkbox">
          <label>
            <input
              v-model="product.is_digital"
              type="checkbox"
            >
            {{ t('marketplace.fields.isDigital') }}
          </label>
        </div>
      </div>
      <div class="form-actions">
        <button
          type="submit"
          class="save-btn"
          data-testid="product-submit"
          :disabled="store.loading"
        >
          {{ t('marketplace.newListing.create') }}
        </button>
      </div>
    </form>

    <!-- Category -->
    <form
      v-else-if="activeTab === 'category'"
      class="form-section"
      @submit.prevent="submitCategory"
    >
      <div class="form-row">
        <div class="form-group">
          <label>{{ t('marketplace.fields.name') }}</label>
          <input
            v-model="category.name"
            type="text"
            class="form-input"
            data-testid="category-name"
          >
        </div>
        <div class="form-group">
          <label>{{ t('marketplace.fields.slug') }}</label>
          <input
            v-model="category.slug"
            type="text"
            class="form-input"
          >
        </div>
      </div>
      <div class="form-actions">
        <button
          type="submit"
          class="save-btn"
          data-testid="category-submit"
          :disabled="store.loading"
        >
          {{ t('marketplace.newListing.create') }}
        </button>
      </div>
    </form>

    <!-- Plan -->
    <form
      v-else-if="activeTab === 'plan'"
      class="form-section"
      @submit.prevent="submitPlan"
    >
      <div class="form-row">
        <div class="form-group">
          <label>{{ t('marketplace.fields.name') }}</label>
          <input
            v-model="plan.name"
            type="text"
            class="form-input"
            data-testid="plan-name"
          >
        </div>
        <div class="form-group">
          <label>{{ t('marketplace.fields.price') }}</label>
          <input
            v-model.number="plan.price"
            type="number"
            step="0.01"
            class="form-input"
            data-testid="plan-price"
          >
        </div>
      </div>
      <div class="form-group">
        <label>{{ t('marketplace.fields.description') }}</label>
        <textarea
          v-model="plan.description"
          class="form-input"
          rows="3"
        />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>{{ t('marketplace.fields.billingPeriod') }}</label>
          <select
            v-model="plan.billing_period"
            class="form-input"
            data-testid="plan-period"
          >
            <option value="MONTHLY">
              {{ t('marketplace.periods.monthly') }}
            </option>
            <option value="YEARLY">
              {{ t('marketplace.periods.yearly') }}
            </option>
            <option value="ONE_TIME">
              {{ t('marketplace.periods.oneTime') }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>{{ t('marketplace.fields.trialDays') }}</label>
          <input
            v-model.number="plan.trial_days"
            type="number"
            class="form-input"
          >
        </div>
      </div>
      <div class="form-actions">
        <button
          type="submit"
          class="save-btn"
          data-testid="plan-submit"
          :disabled="store.loading"
        >
          {{ t('marketplace.newListing.create') }}
        </button>
      </div>
    </form>

    <!-- Software -->
    <form
      v-else-if="activeTab === 'software'"
      class="form-section"
      @submit.prevent="submitSoftware"
    >
      <div class="form-row">
        <div class="form-group">
          <label>{{ t('marketplace.fields.name') }}</label>
          <input
            v-model="software.name"
            type="text"
            class="form-input"
            data-testid="software-name"
          >
        </div>
        <div class="form-group">
          <label>{{ t('marketplace.fields.price') }}</label>
          <input
            v-model.number="software.price"
            type="number"
            step="0.01"
            class="form-input"
            data-testid="software-price"
          >
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>{{ t('marketplace.fields.githubOwner') }}</label>
          <input
            v-model="software.github_owner"
            type="text"
            class="form-input"
            data-testid="software-owner"
          >
        </div>
        <div class="form-group">
          <label>{{ t('marketplace.fields.githubRepo') }}</label>
          <input
            v-model="software.github_repo"
            type="text"
            class="form-input"
            data-testid="software-repo"
          >
        </div>
      </div>
      <div class="form-actions">
        <button
          type="submit"
          class="save-btn"
          data-testid="software-submit"
          :disabled="store.loading"
        >
          {{ t('marketplace.newListing.create') }}
        </button>
      </div>
    </form>

    <!-- Booking -->
    <form
      v-else-if="activeTab === 'booking'"
      class="form-section"
      @submit.prevent="submitBooking"
    >
      <div class="form-row">
        <div class="form-group">
          <label>{{ t('marketplace.fields.name') }}</label>
          <input
            v-model="booking.name"
            type="text"
            class="form-input"
            data-testid="booking-name"
          >
        </div>
        <div class="form-group">
          <label>{{ t('marketplace.fields.price') }}</label>
          <input
            v-model.number="booking.price"
            type="number"
            step="0.01"
            class="form-input"
            data-testid="booking-price"
          >
        </div>
      </div>
      <div class="form-group">
        <label>{{ t('marketplace.fields.description') }}</label>
        <textarea
          v-model="booking.description"
          class="form-input"
          rows="3"
        />
      </div>
      <div class="form-group">
        <label>{{ t('marketplace.fields.capacity') }}</label>
        <input
          v-model.number="booking.capacity"
          type="number"
          class="form-input"
        >
      </div>
      <div class="form-actions">
        <button
          type="submit"
          class="save-btn"
          data-testid="booking-submit"
          :disabled="store.loading"
        >
          {{ t('marketplace.newListing.create') }}
        </button>
      </div>
    </form>

    <div
      v-if="successMessage"
      class="vendor-message success"
      data-testid="listing-success"
    >
      {{ successMessage }}
    </div>
    <div
      v-if="store.error"
      class="vendor-message error"
      data-testid="listing-error"
    >
      {{ store.error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useVendorStore } from '../stores/vendor';
import type { BillingPeriod, CreatedEntity } from '../api';

const { t } = useI18n();
const route = useRoute();
const store = useVendorStore();

type TabId = 'product' | 'category' | 'plan' | 'software' | 'booking';
const tabs: TabId[] = ['product', 'category', 'plan', 'software', 'booking'];
const activeTab = ref<TabId>('product');
const successMessage = ref('');

const product = reactive({
  name: '',
  slug: '',
  description: '',
  price: 0,
  is_digital: false,
});
const category = reactive({ name: '', slug: '' });
const plan = reactive({
  name: '',
  slug: '',
  description: '',
  price: 0,
  billing_period: 'MONTHLY' as BillingPeriod,
  trial_days: 0,
});
const software = reactive({
  name: '',
  slug: '',
  description: '',
  github_owner: '',
  github_repo: '',
  price: 0,
});
const booking = reactive({
  name: '',
  slug: '',
  description: '',
  price: 0,
  capacity: 1,
});

function announceSuccess(created: CreatedEntity | null): void {
  if (!created) return;
  const identifier = created.slug ?? created.id ?? '';
  successMessage.value = t('marketplace.newListing.success', { id: identifier });
}

async function submitProduct(): Promise<void> {
  successMessage.value = '';
  announceSuccess(
    await store.createProduct({
      name: product.name,
      slug: product.slug || undefined,
      description: product.description || undefined,
      price: product.price,
      is_digital: product.is_digital,
    }),
  );
}

async function submitCategory(): Promise<void> {
  successMessage.value = '';
  announceSuccess(
    await store.createCategory({
      name: category.name,
      slug: category.slug || undefined,
    }),
  );
}

async function submitPlan(): Promise<void> {
  successMessage.value = '';
  announceSuccess(
    await store.createPlan({
      name: plan.name,
      slug: plan.slug || undefined,
      description: plan.description || undefined,
      price: plan.price,
      billing_period: plan.billing_period,
      trial_days: plan.trial_days || undefined,
    }),
  );
}

async function submitSoftware(): Promise<void> {
  successMessage.value = '';
  announceSuccess(
    await store.createSoftware({
      name: software.name,
      slug: software.slug || undefined,
      description: software.description || undefined,
      github_owner: software.github_owner,
      github_repo: software.github_repo,
      price: software.price,
    }),
  );
}

async function submitBooking(): Promise<void> {
  successMessage.value = '';
  announceSuccess(
    await store.createBookingResource({
      name: booking.name,
      slug: booking.slug || undefined,
      description: booking.description || undefined,
      price: booking.price,
      capacity: booking.capacity || undefined,
    }),
  );
}

onMounted(() => {
  const requested = route.query.tab as string | undefined;
  if (requested && tabs.includes(requested as TabId)) {
    activeTab.value = requested as TabId;
  }
});
</script>

<style scoped src="./vendor-admin.css"></style>
