<template>
  <div class="manage-api">
    <h1>{{ $t('manageApi.title') }}</h1>
    <p class="manage-api__intro">
      {{ $t('manageApi.intro') }}
    </p>

    <ApiKeysManager
      :keys="store.keys"
      :available-scopes="store.scopes"
      :loading="store.loading"
      :error="store.error"
      :created-plaintext="store.createdPlaintext"
      :can-delete="true"
      @create="onCreate"
      @revoke="onRevoke"
      @delete="onDelete"
      @dismiss-plaintext="store.dismissPlaintext"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { ApiKeysManager } from 'vbwd-view-component';
import { useApiKeysStore } from '@/stores/apiKeys';

const store = useApiKeysStore();

onMounted(async () => {
  await Promise.all([store.fetchScopes(), store.fetchKeys()]);
});

async function onCreate(payload: {
  label: string;
  scopes: string[];
  ipWhitelist: string[];
}): Promise<void> {
  await store.createKey(payload);
}

async function onRevoke(keyId: string): Promise<void> {
  await store.revokeKey(keyId);
}

async function onDelete(keyId: string): Promise<void> {
  await store.deleteKey(keyId);
}
</script>

<style scoped>
.manage-api {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem;
}

.manage-api__intro {
  color: var(--vbwd-text-muted, #6b7280);
  margin-bottom: 1.5rem;
}
</style>
