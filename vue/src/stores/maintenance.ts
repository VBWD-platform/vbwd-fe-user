/**
 * Maintenance store — the fe-user single source of truth for the app-wide
 * "Technical works" state.
 *
 * The public site depends on the CMS backend (config, layouts, page/post
 * render). When an operator enables licensing and the license does not cover
 * CMS, every CMS API answers `HTTP 402 {"error":"License required",
 * "feature":"cms"}`. Rather than paint a broken site, the app flips this store
 * ON (via the CMS maintenance detector, `@/api/cmsMaintenance`) and renders a
 * full-page maintenance screen instead of the router view.
 *
 * The state clears again as soon as a CMS call succeeds, so restoring the
 * license brings the site back without a hard reload.
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useMaintenanceStore = defineStore('maintenance', () => {
  const active = ref(false);

  function activate(): void {
    active.value = true;
  }

  function clear(): void {
    active.value = false;
  }

  return { active, activate, clear };
});
