<template>
  <div class="ghrm-versions">
    <p
      v-if="!versions.length"
      class="ghrm-empty"
    >
      {{ $t('ghrm.noVersions') }}
    </p>
    <div
      v-else
      class="ghrm-versions-table-wrap"
    >
      <table class="ghrm-versions-table">
        <thead>
          <tr>
            <th>Version</th>
            <th>Released</th>
            <th>Notes</th>
            <th>Downloads</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="v in versions"
            :key="v.tag"
          >
            <td><code class="ghrm-tag">{{ v.tag }}</code></td>
            <td class="ghrm-date">
              {{ formatDate(v.date) }}
            </td>
            <td class="ghrm-notes">
              {{ v.notes?.slice(0, 120) || '—' }}
            </td>
            <td>
              <div class="ghrm-assets">
                <a
                  v-for="asset in v.assets"
                  :key="asset.url"
                  :href="asset.url"
                  target="_blank"
                  rel="noopener"
                  class="ghrm-asset-link"
                >
                  {{ asset.name }}
                </a>
                <span
                  v-if="!v.assets?.length"
                  class="ghrm-muted"
                >—</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  versions: { tag: string; date: string; notes: string; assets: { name: string; url: string }[] }[];
}>();

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
</script>

<style scoped>
.ghrm-versions-table-wrap { overflow-x: auto; }
.ghrm-versions-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.ghrm-versions-table th { background: #f8f9fa; padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e9ecef; }
.ghrm-versions-table td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
.ghrm-tag { background: #e8f4fd; color: #1a73e8; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
.ghrm-date { color: #6b7280; white-space: nowrap; }
.ghrm-notes { color: #374151; max-width: 300px; }
.ghrm-assets { display: flex; flex-direction: column; gap: 4px; }
.ghrm-asset-link { color: #3498db; font-size: 13px; text-decoration: none; }
.ghrm-asset-link:hover { text-decoration: underline; }
.ghrm-muted { color: #9ca3af; }
.ghrm-empty { color: #9ca3af; font-style: italic; }
</style>
