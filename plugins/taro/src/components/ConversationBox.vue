<template>
  <div
    ref="boxEl"
    class="conversation-box"
  >
    <div
      v-for="(msg, idx) in messages"
      :key="idx"
      :class="['conversation-message', `${msg.role}-message`]"
    >
      <div class="message-role">
        {{ msg.role === 'oracle' ? $t('taro.assistant') : $t('taro.you') }}
      </div>
      <div class="message-content">
        <FormattedMessage :content="msg.content" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { ConversationMessage } from '@/stores';
import FormattedMessage from './FormattedMessage.vue';

interface Props {
  messages: ConversationMessage[];
}

const props = defineProps<Props>();
const boxEl = ref<HTMLElement | null>(null);

watch(() => props.messages.length, async () => {
  await nextTick();
  if (boxEl.value) boxEl.value.scrollTop = boxEl.value.scrollHeight;
});
</script>

<style scoped>
.conversation-box {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-background);
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--color-border);
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: var(--spacing-md);
}

.conversation-message {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.message-role {
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
}

.oracle-message .message-role {
  color: var(--color-primary);
}

.user-message .message-role {
  color: var(--color-success);
}

.message-content {
  color: var(--color-text-primary);
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
</style>
