<template>
  <div class="withdraw-view">
    <h1>{{ t('withdraw.title') }}</h1>
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
