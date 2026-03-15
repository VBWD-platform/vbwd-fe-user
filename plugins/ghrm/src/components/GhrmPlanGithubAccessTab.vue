<template>
  <div class="ghrm-github-access-tab">
    <div class="access-section">
      <h3 class="section-title">
        GitHub Connection
      </h3>
      <GhrmGithubConnectButton />
    </div>

    <div
      v-if="noPackage"
      class="access-message access-message--info"
      data-testid="no-package-message"
    >
      This plan does not include a software package with GitHub repository access.
    </div>

    <div
      v-else-if="store.accessStatus"
      class="access-section"
    >
      <h3 class="section-title">
        Access Status
      </h3>

      <div
        v-if="!store.accessStatus.connected"
        class="access-message access-message--info"
        data-testid="not-connected-message"
      >
        Connect your GitHub account above to get clone instructions.
      </div>

      <template v-else>
        <p
          class="connected-label"
          data-testid="connected-label"
        >
          Connected as <strong>@{{ store.accessStatus.github_username }}</strong>
        </p>

        <div
          v-if="loadingInstructions"
          class="access-message"
        >
          Loading instructions...
        </div>

        <template v-else-if="canAccess && store.installInstructions">
          <div
            class="install-block"
            data-testid="install-instructions"
          >
            <div
              v-for="(cmd, key) in installCommands"
              :key="key"
              class="install-command"
            >
              <span class="install-label">{{ key }}</span>
              <div class="install-row">
                <pre class="install-pre"><code>{{ cmd }}</code></pre>
                <button
                  type="button"
                  class="copy-btn"
                  :data-testid="`copy-${key}`"
                  @click="copyCommand(cmd)"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </template>

        <div
          v-else-if="!canAccess"
          class="access-message access-message--warning"
          data-testid="inactive-message"
        >
          You cannot clone or update your local code with a pending or inactive subscription.
          Renew your plan to restore access.
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useGhrmStore } from '../stores/useGhrmStore';
import { ghrmApi } from '../api/ghrmApi';
import GhrmGithubConnectButton from './GhrmGithubConnectButton.vue';

const props = defineProps<{ planSlug: string; planId: string }>();

const store = useGhrmStore();
const loadingInstructions = ref(false);
const noPackage = ref(false);

const canAccess = computed(() => {
  const status = store.accessStatus;
  if (!status?.connected) return false;
  return status.access_status === 'active';
});

const installCommands = computed(() => {
  const instr = store.installInstructions;
  if (!instr) return {};
  return {
    git: instr.git,
    npm: instr.npm,
    pip: instr.pip,
    composer: instr.composer,
  };
});

onMounted(async () => {
  await store.fetchAccessStatus();
  if (!store.accessStatus?.connected) return;
  try {
    const packageData = await ghrmApi.getPackageByPlan(props.planId);
    if (canAccess.value) {
      loadingInstructions.value = true;
      await store.fetchInstallInstructions(packageData.slug);
    }
  } catch {
    noPackage.value = true;
  } finally {
    loadingInstructions.value = false;
  }
});

function copyCommand(cmd: string): void {
  navigator.clipboard.writeText(cmd).catch(() => {});
}
</script>

<style scoped>
.ghrm-github-access-tab { }
.access-section { margin-bottom: 28px; }
.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--vbwd-text-heading, #2c3e50);
  margin: 0 0 12px;
}
.connected-label {
  color: var(--vbwd-text-body, #333);
  margin-bottom: 16px;
}
.access-message {
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
  color: var(--vbwd-text-body, #333);
  background: var(--vbwd-card-bg, #f8f9fa);
  border: 1px solid var(--vbwd-border-color, #ddd);
}
.access-message--info { border-color: var(--vbwd-color-primary, #3498db); }
.access-message--warning {
  background: color-mix(in srgb, var(--vbwd-color-warning, #f39c12) 10%, white);
  border-color: var(--vbwd-color-warning, #f39c12);
  color: var(--vbwd-text-heading, #2c3e50);
}
.install-block { display: flex; flex-direction: column; gap: 16px; }
.install-command { }
.install-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--vbwd-text-muted, #666);
  margin-bottom: 4px;
  display: block;
}
.install-row { display: flex; align-items: stretch; gap: 8px; }
.install-pre {
  flex: 1;
  background: var(--vbwd-text-heading, #1e1e1e);
  color: #d4d4d4;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  overflow-x: auto;
  margin: 0;
}
.copy-btn {
  padding: 0 14px;
  background: var(--vbwd-color-primary, #3498db);
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}
.copy-btn:hover { background: var(--vbwd-color-primary-hover, #2980b9); }
</style>
