<template>
  <div class="maintenance-screen">
    <div class="maintenance-card">
      <div
        class="maintenance-icon"
        aria-hidden="true"
      >
        &#9881;
      </div>
      <h1 class="maintenance-title">
        {{ $t('maintenance.title') }}
      </h1>
      <p class="maintenance-subtitle">
        {{ $t('maintenance.subtitle') }}
      </p>
      <p class="maintenance-message">
        {{ $t('maintenance.message') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
// Full-page "Technical works" maintenance screen shown app-wide when the CMS
// backend is license-blocked (see @/stores/maintenance). Copy is localized via
// the i18n `maintenance.*` keys; colours come from the fe-user design tokens
// so the screen follows the active theme.
</script>

<style scoped>
.maintenance-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  background-color: var(--vbwd-page-bg, #f5f5f5);
  color: var(--vbwd-text-body, #333);
}

.maintenance-card {
  max-width: 32rem;
  width: 100%;
  text-align: center;
  padding: 3rem 2rem;
  background: var(--vbwd-surface, #fff);
  border: 1px solid var(--vbwd-border, #e9ecef);
  border-radius: var(--vbwd-radius-card, 8px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);
}

.maintenance-icon {
  font-size: 3rem;
  line-height: 1;
  margin-bottom: 1.25rem;
  color: var(--vbwd-primary, #3498db);
}

.maintenance-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  color: var(--vbwd-heading, #2c3e50);
}

.maintenance-subtitle {
  font-size: 1.1rem;
  margin-bottom: 1rem;
  color: var(--vbwd-text-body, #333);
}

.maintenance-message {
  font-size: 0.95rem;
  color: var(--vbwd-muted, #666);
}
</style>
