<template>
  <div class="ghrm-connect">
    <template v-if="!status?.connected">
      <button
        class="ghrm-connect-btn"
        :disabled="connecting"
        data-testid="ghrm-connect-github"
        @click="connect"
      >
        {{ connecting ? 'Redirecting...' : $t('ghrm.connectGithub') }}
      </button>
    </template>
    <template v-else>
      <span
        class="ghrm-connected-badge"
        data-testid="ghrm-connected-badge"
      >
        {{ $t('ghrm.githubConnected') }} <strong>@{{ status.github_username }}</strong>
        <span
          class="ghrm-status-badge"
          :class="`ghrm-status--${status.access_status}`"
        >
          {{ status.access_status }}
        </span>
      </span>
      <button
        class="ghrm-disconnect-btn"
        :disabled="disconnecting"
        data-testid="ghrm-disconnect-github"
        @click="disconnect"
      >
        {{ disconnecting ? 'Disconnecting...' : $t('ghrm.disconnectGithub') }}
      </button>
    </template>
    <p
      v-if="errorMsg"
      class="ghrm-connect-error"
    >
      {{ errorMsg }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useGhrmStore } from '../stores/useGhrmStore';
import { ghrmApi } from '../api/ghrmApi';

const store = useGhrmStore();
const status = ref(store.accessStatus);
const connecting = ref(false);
const disconnecting = ref(false);
const errorMsg = ref('');

async function connect() {
  connecting.value = true;
  errorMsg.value = '';
  try {
    const { url } = await ghrmApi.getOAuthUrl();
    window.location.href = url;
  } catch (e) {
    errorMsg.value = (e as Error).message;
    connecting.value = false;
  }
}

async function disconnect() {
  disconnecting.value = true;
  try {
    await store.disconnect();
    status.value = store.accessStatus;
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    disconnecting.value = false;
  }
}

onMounted(async () => {
  await store.fetchAccessStatus();
  status.value = store.accessStatus;
});
</script>

<style scoped>
.ghrm-connect { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ghrm-connect-btn { padding: 10px 18px; background: #24292e; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; }
.ghrm-connect-btn:hover:not(:disabled) { background: #444d56; }
.ghrm-disconnect-btn { padding: 6px 12px; background: transparent; color: #e74c3c; border: 1px solid #e74c3c; border-radius: 4px; cursor: pointer; font-size: 13px; }
.ghrm-disconnect-btn:hover:not(:disabled) { background: #fef2f2; }
.ghrm-connected-badge { font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px; }
.ghrm-status-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
.ghrm-status--active { background: #d1fae5; color: #065f46; }
.ghrm-status--grace { background: #fef3c7; color: #92400e; }
.ghrm-status--revoked { background: #fee2e2; color: #991b1b; }
.ghrm-connect-error { color: #dc2626; font-size: 13px; margin: 4px 0 0; width: 100%; }
</style>
