<template>
  <div class="ghrm-install">
    <div class="ghrm-deploy-token">
      <label class="ghrm-install-label">Deploy Token</label>
      <div class="ghrm-token-row">
        <input
          :value="instructions.deploy_token"
          class="ghrm-token-input"
          readonly
          type="password"
          data-testid="ghrm-deploy-token"
        >
        <button
          class="ghrm-copy-btn"
          type="button"
          @click="copyToken"
        >
          {{ copied ? $t('ghrm.tokenCopied') : $t('ghrm.copyToken') }}
        </button>
      </div>
    </div>

    <div
      v-for="(cmd, manager) in managers"
      :key="manager"
      class="ghrm-cmd-block"
    >
      <label class="ghrm-install-label">{{ managerLabel(manager) }}</label>
      <div class="ghrm-cmd-row">
        <pre class="ghrm-cmd">{{ cmd }}</pre>
        <button
          class="ghrm-copy-btn ghrm-copy-btn--sm"
          type="button"
          @click="copyCmd(cmd)"
        >
          {{ copiedCmd === cmd ? 'Copied!' : 'Copy' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { GhrmInstallInstructions } from '../api/ghrmApi';

const props = defineProps<{ instructions: GhrmInstallInstructions }>();
const copied = ref(false);
const copiedCmd = ref('');

const managers = computed(() => ({
  npm: props.instructions.npm,
  composer: props.instructions.composer,
  pip: props.instructions.pip,
  git: props.instructions.git,
}));

function managerLabel(m: string): string {
  return { npm: 'npm', composer: 'Composer (PHP)', pip: 'pip (Python)', git: 'Git' }[m] || m;
}

async function copyToken() {
  await navigator.clipboard.writeText(props.instructions.deploy_token);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

async function copyCmd(cmd: string) {
  await navigator.clipboard.writeText(cmd);
  copiedCmd.value = cmd;
  setTimeout(() => { copiedCmd.value = ''; }, 2000);
}
</script>

<style scoped>
.ghrm-install { display: flex; flex-direction: column; gap: 20px; }
.ghrm-install-label { display: block; font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
.ghrm-token-row, .ghrm-cmd-row { display: flex; gap: 8px; align-items: center; }
.ghrm-token-input { flex: 1; padding: 8px 12px; font-family: monospace; font-size: 13px; border: 1px solid #d1d5db; border-radius: 4px; background: #f9fafb; }
.ghrm-cmd { flex: 1; margin: 0; padding: 12px 14px; background: #1e1e1e; color: #d4d4d4; border-radius: 6px; font-size: 12px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
.ghrm-copy-btn { padding: 8px 14px; background: #3498db; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; white-space: nowrap; flex-shrink: 0; }
.ghrm-copy-btn:hover { background: #2980b9; }
.ghrm-copy-btn--sm { padding: 6px 10px; font-size: 12px; align-self: flex-start; margin-top: 4px; }
</style>
