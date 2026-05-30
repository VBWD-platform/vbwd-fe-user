<template>
  <PairingSheet
    v-if="isE2e && status !== 'ready'"
    :status="status"
    :busy="busy"
    :error="error"
    @submit="onSubmit"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import PairingSheet from './PairingSheet.vue';
import { usePairing } from '../composables/usePairing';
import * as api from '../api';
import { createIdbKeyValueStore } from '../persistence';

// The overlay meinchat renders inside an e2e conversation. It drives the
// pairing passphrase prompt (set on first use, unlock on return) and persists
// ratchet sessions on tab-hide. Self-contained: builds its deps from the api
// module + IndexedDB, so meinchat needs no knowledge of crypto.
const props = defineProps<{ conversation: { protocol?: string } }>();

const isE2e = computed(() => props.conversation?.protocol === 'e2e_v1');
const userId = localStorage.getItem('user_id') ?? '';

const pairing = usePairing({
  userId,
  providerApi: {
    listUserDevices: api.listUserDevices,
    sendEnvelope: api.sendEnvelope,
  },
  bundleApi: { getPrekeyBundle: api.getPrekeyBundle },
  kv: () => createIdbKeyValueStore(),
});

const { status, busy, error } = pairing;

function onSubmit(passphrase: string) {
  if (status.value === 'unpaired') void pairing.pair(passphrase);
  else void pairing.unlock(passphrase);
}

// Persist ratchet sessions when the tab is hidden (cheap; keeps forward-secret
// state durable across reloads).
function persistOnHide() {
  if (document.visibilityState === 'hidden') void pairing.saveSessions();
}

onMounted(() => {
  if (isE2e.value) void pairing.refresh();
  document.addEventListener('visibilitychange', persistOnHide);
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', persistOnHide);
});
</script>
