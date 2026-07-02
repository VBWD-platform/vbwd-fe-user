<template>
  <div
    class="vendor-view"
    data-testid="edit-category-view"
  >
    <router-link
      class="back-link"
      to="/marketplace/categories"
    >
      ← {{ t('marketplace.edit.backToCategories') }}
    </router-link>

    <div class="vendor-header">
      <div class="header-left">
        <h2>{{ t('marketplace.categories.editTitle') }}</h2>
      </div>
    </div>

    <div
      v-if="store.loading && !loaded"
      class="loading-state"
      data-testid="edit-category-loading"
    >
      <div class="spinner" />
      <p>{{ t('marketplace.common.loading') }}</p>
    </div>

    <div
      v-else-if="notFound"
      class="empty-state"
      data-testid="edit-category-not-found"
    >
      <p>{{ t('marketplace.categories.notFound') }}</p>
    </div>

    <form
      v-else
      class="form-section"
      data-testid="edit-category-form"
      @submit.prevent="save"
    >
      <div class="form-group">
        <label>{{ t('marketplace.fields.name') }}</label>
        <input
          v-model="form.name"
          type="text"
          class="form-input"
          data-testid="edit-category-name"
        >
      </div>
      <div class="form-group">
        <label>{{ t('marketplace.fields.slug') }}</label>
        <input
          v-model="form.slug"
          type="text"
          class="form-input"
        >
      </div>
      <div class="form-group">
        <label>{{ t('marketplace.fields.description') }}</label>
        <textarea
          v-model="form.description"
          class="form-input"
          rows="3"
        />
      </div>

      <div
        v-if="store.error"
        class="vendor-message error"
        data-testid="edit-category-error"
      >
        {{ store.error }}
      </div>
      <div
        v-if="saved"
        class="vendor-message success"
        data-testid="edit-category-saved"
      >
        {{ t('marketplace.edit.saved') }}
      </div>

      <div class="form-actions">
        <button
          type="submit"
          class="save-btn"
          data-testid="edit-category-save"
          :disabled="store.loading"
        >
          {{ t('marketplace.edit.save') }}
        </button>
        <router-link
          class="cancel-btn"
          to="/marketplace/categories"
        >
          {{ t('marketplace.edit.cancel') }}
        </router-link>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useVendorStore } from '../stores/vendor';

const { t } = useI18n();
const route = useRoute();
const store = useVendorStore();

const id = route.params.id as string;
const loaded = ref(false);
const notFound = ref(false);
const saved = ref(false);

const form = reactive({
  name: '',
  slug: '',
  description: '',
});

async function save(): Promise<void> {
  saved.value = false;
  const ok = await store.updateCategory(id, {
    name: form.name,
    slug: form.slug || undefined,
    description: form.description || undefined,
  });
  if (ok) {
    saved.value = true;
    setTimeout(() => {
      saved.value = false;
    }, 3000);
  }
}

onMounted(async () => {
  const category = await store.fetchCategory(id);
  if (!category) {
    notFound.value = true;
    loaded.value = true;
    return;
  }
  form.name = String(category.name ?? '');
  form.slug = String(category.slug ?? '');
  form.description = String(category.description ?? '');
  loaded.value = true;
});
</script>

<style scoped src="./vendor-admin.css"></style>
