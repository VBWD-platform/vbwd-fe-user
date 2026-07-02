<template>
  <div
    class="vendor-view"
    data-testid="edit-listing-view"
  >
    <router-link
      class="back-link"
      to="/marketplace/listings"
    >
      ← {{ t('marketplace.edit.backToListings') }}
    </router-link>

    <div class="vendor-header">
      <div class="header-left">
        <h2>{{ t('marketplace.edit.title') }}</h2>
        <span class="type-badge">{{ t(`marketplace.types.${type}`) }}</span>
      </div>
    </div>

    <div
      v-if="store.loading && !loaded"
      class="loading-state"
      data-testid="edit-loading"
    >
      <div class="spinner" />
      <p>{{ t('marketplace.common.loading') }}</p>
    </div>

    <div
      v-else-if="notFound"
      class="empty-state"
      data-testid="edit-not-found"
    >
      <p>{{ t('marketplace.edit.notFound') }}</p>
    </div>

    <form
      v-else
      class="form-section"
      data-testid="edit-form"
      @submit.prevent="save"
    >
      <div class="form-row">
        <div class="form-group">
          <label>{{ t('marketplace.fields.name') }}</label>
          <input
            v-model="form.name"
            type="text"
            class="form-input"
            data-testid="edit-name"
          >
        </div>
        <div
          v-if="hasField('slug')"
          class="form-group"
        >
          <label>{{ t('marketplace.fields.slug') }}</label>
          <input
            v-model="form.slug"
            type="text"
            class="form-input"
          >
        </div>
      </div>

      <div
        v-if="hasField('description')"
        class="form-group"
      >
        <label>{{ t('marketplace.fields.description') }}</label>
        <textarea
          v-model="form.description"
          class="form-input"
          rows="3"
        />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>{{ t('marketplace.fields.price') }}</label>
          <input
            v-model.number="form.price"
            type="number"
            step="0.01"
            class="form-input"
            data-testid="edit-price"
          >
        </div>
        <div
          v-if="type === 'booking'"
          class="form-group"
        >
          <label>{{ t('marketplace.fields.capacity') }}</label>
          <input
            v-model.number="form.capacity"
            type="number"
            class="form-input"
          >
        </div>
        <div
          v-if="type === 'plan'"
          class="form-group"
        >
          <label>{{ t('marketplace.fields.billingPeriod') }}</label>
          <select
            v-model="form.billing_period"
            class="form-input"
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
        <div
          v-if="type === 'plan'"
          class="form-group"
        >
          <label>{{ t('marketplace.fields.trialDays') }}</label>
          <input
            v-model.number="form.trial_days"
            type="number"
            class="form-input"
          >
        </div>
      </div>

      <div
        v-if="type === 'software'"
        class="form-row"
      >
        <div class="form-group">
          <label>{{ t('marketplace.fields.githubOwner') }}</label>
          <input
            v-model="form.github_owner"
            type="text"
            class="form-input"
          >
        </div>
        <div class="form-group">
          <label>{{ t('marketplace.fields.githubRepo') }}</label>
          <input
            v-model="form.github_repo"
            type="text"
            class="form-input"
          >
        </div>
      </div>

      <div class="form-row">
        <div
          v-if="type === 'product'"
          class="form-group form-group--checkbox"
        >
          <label>
            <input
              v-model="form.is_digital"
              type="checkbox"
            >
            {{ t('marketplace.fields.isDigital') }}
          </label>
        </div>
        <div class="form-group form-group--checkbox">
          <label>
            <input
              v-model="form.is_active"
              type="checkbox"
              data-testid="edit-active"
            >
            {{ t('marketplace.common.active') }}
          </label>
        </div>
      </div>

      <div
        v-if="store.error"
        class="vendor-message error"
        data-testid="edit-error"
      >
        {{ store.error }}
      </div>
      <div
        v-if="saved"
        class="vendor-message success"
        data-testid="edit-saved"
      >
        {{ t('marketplace.edit.saved') }}
      </div>

      <div class="form-actions">
        <button
          type="submit"
          class="save-btn"
          data-testid="edit-save"
          :disabled="store.loading"
        >
          {{ t('marketplace.edit.save') }}
        </button>
        <router-link
          class="cancel-btn"
          to="/marketplace/listings"
        >
          {{ t('marketplace.edit.cancel') }}
        </router-link>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useVendorStore } from '../stores/vendor';
import type { ListingType } from '../api';

const { t } = useI18n();
const route = useRoute();
const store = useVendorStore();

const type = computed(() => route.params.type as ListingType);
const id = computed(() => route.params.id as string);

const loaded = ref(false);
const notFound = ref(false);
const saved = ref(false);

interface EditForm {
  name: string;
  slug: string;
  description: string;
  price: number;
  is_active: boolean;
  is_digital: boolean;
  capacity: number;
  billing_period: string;
  trial_days: number;
  github_owner: string;
  github_repo: string;
}

const form = reactive<EditForm>({
  name: '',
  slug: '',
  description: '',
  price: 0,
  is_active: true,
  is_digital: false,
  capacity: 1,
  billing_period: 'MONTHLY',
  trial_days: 0,
  github_owner: '',
  github_repo: '',
});

// Fields not applicable to every vertical (software has no user-facing slug).
function hasField(field: 'slug' | 'description'): boolean {
  if (field === 'slug') return type.value !== 'software';
  return true;
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildPayload(): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: form.name,
    price: form.price,
    is_active: form.is_active,
  };
  if (hasField('slug') && form.slug) base.slug = form.slug;
  if (form.description) base.description = form.description;
  if (type.value === 'product') base.is_digital = form.is_digital;
  if (type.value === 'booking') base.capacity = form.capacity;
  if (type.value === 'plan') {
    base.billing_period = form.billing_period;
    base.trial_days = form.trial_days;
  }
  if (type.value === 'software') {
    base.github_owner = form.github_owner;
    base.github_repo = form.github_repo;
  }
  return base;
}

async function save(): Promise<void> {
  saved.value = false;
  const ok = await store.updateListing(type.value, id.value, buildPayload());
  if (ok) {
    saved.value = true;
    setTimeout(() => {
      saved.value = false;
    }, 3000);
  }
}

onMounted(async () => {
  const raw = await store.fetchListing(type.value, id.value);
  if (!raw) {
    notFound.value = true;
    loaded.value = true;
    return;
  }
  form.name = String(raw.name ?? raw.title ?? '');
  form.slug = String(raw.slug ?? '');
  form.description = String(raw.description ?? '');
  form.price = num(raw.price);
  form.is_active = raw.is_active !== false;
  form.is_digital = raw.is_digital === true;
  form.capacity = num(raw.capacity, 1);
  form.billing_period = String(raw.billing_period ?? 'MONTHLY');
  form.trial_days = num(raw.trial_days);
  form.github_owner = String(raw.github_owner ?? '');
  form.github_repo = String(raw.github_repo ?? '');
  loaded.value = true;
});
</script>

<style scoped src="./vendor-admin.css"></style>
