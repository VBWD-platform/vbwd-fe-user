<template>
  <div class="ghrm-detail">
    <div
      v-if="store.loading"
      class="ghrm-loading"
    >
      Loading...
    </div>
    <div
      v-else-if="store.error || !pkg"
      class="ghrm-error"
    >
      {{ store.error || 'Package not found' }}
    </div>

    <template v-else>
      <!-- Header -->
      <div class="ghrm-detail-header">
        <img
          v-if="pkg.icon_url"
          :src="pkg.icon_url"
          :alt="pkg.name"
          class="ghrm-detail-icon"
        >
        <div class="ghrm-detail-meta">
          <h1 class="ghrm-detail-name">
            {{ pkg.name }}
          </h1>
          <p
            v-if="pkg.author_name"
            class="ghrm-detail-author"
          >
            {{ $t('ghrm.by') }} {{ pkg.author_name }}
          </p>
          <div class="ghrm-detail-badges">
            <span
              v-if="pkg.latest_version"
              class="ghrm-badge ghrm-badge--version"
            >{{ pkg.latest_version }}</span>
            <a
              :href="`https://github.com/${pkg.github_owner}/${pkg.github_repo}`"
              target="_blank"
              rel="noopener"
              class="ghrm-badge ghrm-badge--github"
            >GitHub ↗</a>
            <span class="ghrm-badge ghrm-badge--downloads">↓ {{ pkg.download_counter }}</span>
          </div>
        </div>
        <!-- CTA -->
        <div class="ghrm-detail-cta">
          <router-link
            v-if="!isSubscribed"
            :to="`/checkout?tarif_plan_id=${pkg.id}`"
            class="ghrm-cta-btn"
          >
            {{ $t('ghrm.getPackage') }}
          </router-link>
        </div>
      </div>

      <!-- Tabs -->
      <div class="ghrm-tabs">
        <div class="ghrm-tabs__bar">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="ghrm-tabs__tab"
            :class="{ 'ghrm-tabs__tab--active': activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="ghrm-tabs__panel">
          <!-- Overview -->
          <template v-if="activeTab === 'overview'">
            <GhrmMarkdownRenderer
              v-if="pkg.readme"
              :content="pkg.readme"
            />
            <p
              v-else
              class="ghrm-muted"
            >
              {{ $t('ghrm.noOverview') }}
            </p>
          </template>

          <!-- Screenshots -->
          <template v-else-if="activeTab === 'screenshots'">
            <div
              v-if="pkg.screenshots?.length"
              class="ghrm-screenshots"
            >
              <div
                v-for="(s, i) in pkg.screenshots"
                :key="i"
                class="ghrm-screenshot"
              >
                <img
                  :src="s.url"
                  :alt="s.caption || `Screenshot ${i + 1}`"
                  class="ghrm-screenshot-img"
                >
                <p
                  v-if="s.caption"
                  class="ghrm-screenshot-caption"
                >
                  {{ s.caption }}
                </p>
              </div>
            </div>
            <p
              v-else
              class="ghrm-muted"
            >
              {{ $t('ghrm.noScreenshots') }}
            </p>
          </template>

          <!-- Changelog -->
          <template v-else-if="activeTab === 'changelog'">
            <GhrmMarkdownRenderer
              v-if="pkg.changelog"
              :content="pkg.changelog"
            />
            <p
              v-else
              class="ghrm-muted"
            >
              {{ $t('ghrm.noChangelog') }}
            </p>
          </template>

          <!-- Documentation -->
          <template v-else-if="activeTab === 'docs'">
            <GhrmMarkdownRenderer
              v-if="pkg.docs"
              :content="pkg.docs"
            />
            <p
              v-else
              class="ghrm-muted"
            >
              {{ $t('ghrm.noDocs') }}
            </p>
          </template>

          <!-- Versions -->
          <template v-else-if="activeTab === 'versions'">
            <GhrmVersionsTable :versions="store.versions" />
          </template>

          <!-- Install -->
          <template v-else-if="activeTab === 'install'">
            <template v-if="!accessStatus?.connected">
              <p class="ghrm-muted">
                {{ $t('ghrm.connectGithubToInstall') }}
              </p>
              <GhrmGithubConnectButton />
            </template>
            <template v-else-if="store.installInstructions">
              <GhrmInstallInstructions :instructions="store.installInstructions" />
            </template>
            <template v-else>
              <p class="ghrm-muted">
                {{ $t('ghrm.subscribeToContinue') }}
              </p>
            </template>
          </template>
        </div>
      </div>

      <!-- Related -->
      <div
        v-if="store.relatedPackages.length"
        class="ghrm-related"
      >
        <h2 class="ghrm-related-title">
          {{ $t('ghrm.relatedSoftware') }}
        </h2>
        <div class="ghrm-related-strip">
          <router-link
            v-for="rel in store.relatedPackages"
            :key="rel.id"
            :to="`/category/${categorySlug}/${rel.slug}`"
            class="ghrm-related-card"
          >
            <img
              v-if="rel.icon_url"
              :src="rel.icon_url"
              :alt="rel.name"
              class="ghrm-related-icon"
            >
            <span class="ghrm-related-name">{{ rel.name }}</span>
          </router-link>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useGhrmStore } from '../stores/useGhrmStore';
import GhrmMarkdownRenderer from '../components/GhrmMarkdownRenderer.vue';
import GhrmVersionsTable from '../components/GhrmVersionsTable.vue';
import GhrmInstallInstructions from '../components/GhrmInstallInstructions.vue';
import GhrmGithubConnectButton from '../components/GhrmGithubConnectButton.vue';

const route = useRoute();
const store = useGhrmStore();

const categorySlug = computed(() => route.params.category_slug as string);
const packageSlug = computed(() => route.params.package_slug as string);
const pkg = computed(() => store.currentPackage);
const accessStatus = computed(() => store.accessStatus);

const isSubscribed = computed(() => accessStatus.value?.connected && accessStatus.value?.access_status === 'active');

const activeTab = ref('overview');
const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'screenshots', label: 'Screenshots' },
  { id: 'changelog', label: 'Changelog' },
  { id: 'docs', label: 'Documentation' },
  { id: 'versions', label: 'Versions' },
  { id: 'install', label: 'Install' },
];

async function load() {
  await store.fetchPackage(packageSlug.value);
  await Promise.all([
    store.fetchRelated(packageSlug.value),
    store.fetchVersions(packageSlug.value),
    store.fetchAccessStatus(),
  ]);
  if (isSubscribed.value) {
    store.fetchInstallInstructions(packageSlug.value);
  }
}

onMounted(load);
watch(packageSlug, load);
</script>

<style scoped>
.ghrm-detail { max-width: 1100px; margin: 0 auto; padding: 24px 20px; }
.ghrm-detail-header { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 32px; flex-wrap: wrap; }
.ghrm-detail-icon { width: 80px; height: 80px; object-fit: contain; border-radius: 12px; border: 1px solid #e9ecef; flex-shrink: 0; }
.ghrm-detail-meta { flex: 1; }
.ghrm-detail-name { font-size: 1.8rem; color: #2c3e50; margin: 0 0 4px; }
.ghrm-detail-author { color: #6b7280; font-size: 14px; margin: 0 0 10px; }
.ghrm-detail-badges { display: flex; gap: 8px; flex-wrap: wrap; }
.ghrm-badge { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
.ghrm-badge--version { background: #e8f4fd; color: #1a73e8; font-family: monospace; }
.ghrm-badge--github { background: #24292e; color: #fff; text-decoration: none; }
.ghrm-badge--downloads { background: #f3f4f6; color: #6b7280; }
.ghrm-detail-cta { margin-left: auto; }
.ghrm-cta-btn { display: inline-block; padding: 12px 24px; background: #3498db; color: #fff; border-radius: 6px; font-weight: 600; text-decoration: none; font-size: 15px; }
.ghrm-cta-btn:hover { background: #2980b9; }
.ghrm-tabs { border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden; }
.ghrm-tabs__bar { display: flex; background: #f8f9fa; border-bottom: 1px solid #e9ecef; overflow-x: auto; }
.ghrm-tabs__tab { padding: 12px 20px; background: none; border: none; border-right: 1px solid #e9ecef; cursor: pointer; font-size: 14px; color: #555; white-space: nowrap; }
.ghrm-tabs__tab:hover { background: #e9ecef; }
.ghrm-tabs__tab--active { background: #fff; color: #2c3e50; font-weight: 600; border-bottom: 2px solid #3498db; margin-bottom: -1px; }
.ghrm-tabs__panel { padding: 24px; background: #fff; min-height: 200px; }
.ghrm-screenshots { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.ghrm-screenshot-img { width: 100%; border-radius: 6px; border: 1px solid #e9ecef; }
.ghrm-screenshot-caption { font-size: 12px; color: #6b7280; margin: 4px 0 0; text-align: center; }
.ghrm-related { margin-top: 36px; }
.ghrm-related-title { font-size: 1.2rem; color: #2c3e50; margin-bottom: 16px; }
.ghrm-related-strip { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
.ghrm-related-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; background: #fff; border: 1px solid #e9ecef; border-radius: 8px; text-decoration: none; min-width: 100px; flex-shrink: 0; transition: border-color .2s; }
.ghrm-related-card:hover { border-color: #3498db; }
.ghrm-related-icon { width: 36px; height: 36px; object-fit: contain; }
.ghrm-related-name { font-size: 12px; color: #374151; text-align: center; }
.ghrm-muted { color: #9ca3af; font-style: italic; }
.ghrm-loading, .ghrm-error { text-align: center; padding: 60px 20px; color: #6b7280; }
.ghrm-error { color: #dc2626; }
</style>
