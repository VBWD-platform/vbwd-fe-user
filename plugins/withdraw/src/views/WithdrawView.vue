<template>
  <div class="withdraw-view">
    <div class="withdraw-header">
      <h2>{{ t('withdraw.title') }}</h2>
    </div>
    <!-- Token defaults: the panel falls back to the core token balance
         endpoint + the 'tokens' balance source on its own. -->
    <WithdrawPanel />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import WithdrawPanel from '../components/WithdrawPanel.vue';

const { t } = useI18n();
</script>

<style scoped>
/* Match the vendor/admin card language (see marketplace My earnings). */
.withdraw-view {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
}
.withdraw-header {
  margin-bottom: 20px;
}
.withdraw-header h2 {
  margin: 0;
  color: #2c3e50;
}
</style>
