<template>
  <div
    class="meinchat-plus-pairing"
    data-testid="pairing-sheet"
  >
    <h2 class="meinchat-plus-pairing__title">
      {{ isFirstPair
        ? $t('meinchatPlus.pairing.setTitle', 'Set a passphrase to enable secure chat')
        : $t('meinchatPlus.pairing.unlockTitle', 'Unlock secure chat') }}
    </h2>
    <p class="meinchat-plus-pairing__hint">
      {{ isFirstPair
        ? $t('meinchatPlus.pairing.setHint', 'Your messages are end-to-end encrypted. This passphrase protects your keys on this device — it is never sent to the server.')
        : $t('meinchatPlus.pairing.unlockHint', 'Enter your secure-chat passphrase to unlock messages on this device.') }}
    </p>

    <form @submit.prevent="submit">
      <input
        ref="input"
        v-model="passphrase"
        type="password"
        autocomplete="off"
        data-testid="passphrase-input"
        :placeholder="$t('meinchatPlus.pairing.placeholder', 'Passphrase')"
        :disabled="busy"
      >
      <button
        type="submit"
        data-testid="pairing-submit"
        :disabled="busy || !passphrase"
      >
        {{ busy
          ? $t('meinchatPlus.pairing.working', 'Working…')
          : isFirstPair
            ? $t('meinchatPlus.pairing.enable', 'Enable secure chat')
            : $t('meinchatPlus.pairing.unlock', 'Unlock') }}
      </button>
    </form>

    <p
      v-if="error"
      class="meinchat-plus-pairing__error"
      data-testid="pairing-error"
    >
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PairingStatus } from '../composables/usePairing';

const props = defineProps<{
  status: PairingStatus;
  busy: boolean;
  error: string;
}>();

const emit = defineEmits<{ (e: 'submit', passphrase: string): void }>();

const passphrase = ref('');
const isFirstPair = computed(() => props.status === 'unpaired');

function submit() {
  if (!passphrase.value || props.busy) return;
  emit('submit', passphrase.value);
}
</script>
