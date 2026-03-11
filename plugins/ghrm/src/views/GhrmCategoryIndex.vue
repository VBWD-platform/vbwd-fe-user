<template>
  <div class="ghrm-category-index">
    <h1 class="ghrm-category-index__title">
      {{ $t('ghrm.title') }}
    </h1>
    <div class="ghrm-category-grid">
      <router-link
        v-for="cat in categories"
        :key="cat.slug"
        :to="`/category/${cat.slug}`"
        class="ghrm-category-card"
        :data-testid="`ghrm-category-${cat.slug}`"
      >
        <h2 class="ghrm-category-card__title">
          {{ cat.label }}
        </h2>
        <p class="ghrm-category-card__desc">
          {{ cat.desc }}
        </p>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
// Categories from plugin config — matches software_category_slugs
const categories = [
  { slug: 'backend',  label: 'Backend Plugins',  desc: 'Server-side plugins and integrations' },
  { slug: 'fe-user',  label: 'FE User Plugins',  desc: 'User-facing frontend plugins' },
  { slug: 'fe-admin', label: 'FE Admin Plugins', desc: 'Admin dashboard plugins' },
];
</script>

<style scoped>
.ghrm-category-index { max-width: 960px; margin: 40px auto; padding: 0 20px; }
.ghrm-category-index__title { font-size: 2rem; margin-bottom: 32px; color: #2c3e50; }
.ghrm-category-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
.ghrm-category-card { display: block; padding: 28px; background: #fff; border: 2px solid #e9ecef; border-radius: 10px; text-decoration: none; transition: all 0.2s; }
.ghrm-category-card:hover { border-color: #3498db; box-shadow: 0 4px 16px rgba(52,152,219,.12); transform: translateY(-2px); }
.ghrm-category-card__title { font-size: 1.2rem; color: #2c3e50; margin: 0 0 8px; }
.ghrm-category-card__desc { font-size: 0.9rem; color: #6b7280; margin: 0; }
</style>
