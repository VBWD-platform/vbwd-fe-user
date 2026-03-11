<template>
  <div class="ghrm-callback">
    <div
      v-if="status === 'loading'"
      class="ghrm-callback-msg"
    >
      <div class="ghrm-spinner" />
      <p>Connecting your GitHub account...</p>
    </div>
    <div
      v-else-if="status === 'success'"
      class="ghrm-callback-msg ghrm-callback-msg--success"
    >
      <p>{{ $t('ghrm.oauthSuccess') }}</p>
      <p class="ghrm-callback-sub">
        {{ $t('ghrm.oauthRedirecting') }}
      </p>
    </div>
    <div
      v-else
      class="ghrm-callback-msg ghrm-callback-msg--error"
    >
      <p>{{ $t('ghrm.oauthError') }}</p>
      <p class="ghrm-callback-sub">
        {{ errorMsg }}
      </p>
      <router-link to="/dashboard/settings">
        Back to settings
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ghrmApi } from '../api/ghrmApi';

const router = useRouter();
const status = ref<'loading' | 'success' | 'error'>('loading');
const errorMsg = ref('');

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || '';
  const state = params.get('state') || '';

  if (!code) {
    status.value = 'error';
    errorMsg.value = 'No authorization code received from GitHub.';
    return;
  }

  try {
    await ghrmApi.handleOAuthCallback(code, state);
    status.value = 'success';
    setTimeout(() => router.push('/dashboard/settings#github'), 1500);
  } catch (e) {
    status.value = 'error';
    errorMsg.value = (e as Error).message;
  }
});
</script>

<style scoped>
.ghrm-callback { display: flex; justify-content: center; align-items: center; min-height: 60vh; }
.ghrm-callback-msg { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; font-size: 16px; }
.ghrm-callback-msg--success { color: #059669; }
.ghrm-callback-msg--error { color: #dc2626; }
.ghrm-callback-sub { color: #6b7280; font-size: 14px; }
.ghrm-spinner { width: 36px; height: 36px; border: 3px solid #e9ecef; border-top-color: #3498db; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
