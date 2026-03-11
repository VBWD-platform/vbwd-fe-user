import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ghrmApi, type GhrmPackage, type GhrmPackageListItem, type GhrmPaginated, type GhrmInstallInstructions, type GhrmAccessStatus } from '../api/ghrmApi';

export const useGhrmStore = defineStore('ghrm', () => {
  const packages = ref<GhrmPaginated<GhrmPackageListItem> | null>(null);
  const currentPackage = ref<GhrmPackage | null>(null);
  const relatedPackages = ref<GhrmPackageListItem[]>([]);
  const versions = ref<{ tag: string; date: string; notes: string; assets: { name: string; url: string }[] }[]>([]);
  const installInstructions = ref<GhrmInstallInstructions | null>(null);
  const accessStatus = ref<GhrmAccessStatus | null>(null);
  const searchResults = ref<GhrmPaginated<GhrmPackageListItem> | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchPackages(params: Record<string, string> = {}) {
    loading.value = true;
    error.value = null;
    try {
      packages.value = await ghrmApi.listPackages(params);
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function fetchPackage(slug: string) {
    loading.value = true;
    error.value = null;
    currentPackage.value = null;
    try {
      currentPackage.value = await ghrmApi.getPackage(slug);
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function fetchRelated(slug: string) {
    try {
      relatedPackages.value = await ghrmApi.getRelated(slug);
    } catch {
      relatedPackages.value = [];
    }
  }

  async function fetchVersions(slug: string) {
    try {
      versions.value = await ghrmApi.getVersions(slug);
    } catch {
      versions.value = [];
    }
  }

  async function fetchInstallInstructions(slug: string) {
    installInstructions.value = null;
    try {
      installInstructions.value = await ghrmApi.getInstallInstructions(slug);
    } catch {
      installInstructions.value = null;
    }
  }

  async function fetchAccessStatus() {
    try {
      accessStatus.value = await ghrmApi.getAccessStatus();
    } catch {
      accessStatus.value = { connected: false };
    }
  }

  async function search(query: string, page = 1) {
    loading.value = true;
    error.value = null;
    try {
      searchResults.value = await ghrmApi.listPackages({ q: query, page: String(page) });
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function disconnect() {
    await ghrmApi.disconnect();
    accessStatus.value = { connected: false };
  }

  return {
    packages, currentPackage, relatedPackages, versions,
    installInstructions, accessStatus, searchResults, loading, error,
    fetchPackages, fetchPackage, fetchRelated, fetchVersions,
    fetchInstallInstructions, fetchAccessStatus, search, disconnect,
  };
});
