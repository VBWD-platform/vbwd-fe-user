/**
 * fe-user self-service API-key store (S52).
 *
 * Backs the permission-gated "Manage API" page. A user manages THEIR OWN keys
 * via the core self-service endpoints. Wires the shared fe-core ApiKeysManager
 * component's events to the `api` singleton — identical-by-construction to the
 * fe-admin API tab (DRY).
 */
import { defineStore } from 'pinia';
import { api } from '@/api';
import type { ApiKey, ApiScope } from 'vbwd-view-component';

interface ScopeCatalogue {
  [source: string]: ApiScope[];
}

function flattenScopes(catalogue: ScopeCatalogue): ApiScope[] {
  const scopes: ApiScope[] = [];
  for (const source of Object.keys(catalogue)) {
    for (const scope of catalogue[source] || []) {
      scopes.push(scope);
    }
  }
  return scopes;
}

export const useApiKeysStore = defineStore('apiKeys', {
  state: () => ({
    keys: [] as ApiKey[],
    scopes: [] as ApiScope[],
    createdPlaintext: null as string | null,
    loading: false,
    error: null as string | null,
  }),

  actions: {
    async fetchKeys(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const response = (await api.get('/api-keys')) as { api_keys: ApiKey[] };
        this.keys = response.api_keys;
      } catch (error) {
        this.error = (error as Error).message || 'Failed to load API keys';
      } finally {
        this.loading = false;
      }
    },

    async fetchScopes(): Promise<void> {
      try {
        const response = (await api.get('/api-keys/scopes')) as {
          scopes: ScopeCatalogue;
        };
        this.scopes = flattenScopes(response.scopes);
      } catch (error) {
        this.error = (error as Error).message || 'Failed to load scopes';
      }
    },

    async createKey(payload: {
      label: string;
      scopes: string[];
      ipWhitelist: string[];
    }): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const response = (await api.post('/api-keys', {
          label: payload.label,
          scopes: payload.scopes,
          ip_whitelist: payload.ipWhitelist,
        })) as { api_key: ApiKey & { plaintext: string } };
        this.createdPlaintext = response.api_key.plaintext;
        await this.fetchKeys();
      } catch (error) {
        this.error = (error as Error).message || 'Failed to create API key';
      } finally {
        this.loading = false;
      }
    },

    async revokeKey(keyId: string): Promise<void> {
      await api.post(`/api-keys/${keyId}/revoke`);
      await this.fetchKeys();
    },

    async deleteKey(keyId: string): Promise<void> {
      await api.delete(`/api-keys/${keyId}`);
      await this.fetchKeys();
    },

    dismissPlaintext(): void {
      this.createdPlaintext = null;
    },
  },
});
