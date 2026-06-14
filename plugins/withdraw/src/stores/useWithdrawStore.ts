import { defineStore } from 'pinia';
import {
  getProviders,
  getBalance,
  listRequests,
  submitWithdraw,
} from '../api';
import type {
  WithdrawProvider,
  WithdrawConfig,
  WithdrawRequestRow,
} from '../api';

interface WithdrawState {
  providers: WithdrawProvider[];
  config: WithdrawConfig | null;
  requests: WithdrawRequestRow[];
  balance: number | null;
  submitting: boolean;
  error: string | null;
}

export interface WithdrawSubmitInput {
  provider: string;
  amount: number;
  destination: Record<string, string>;
  balanceSource: string;
}

export const useWithdrawStore = defineStore('withdraw', {
  state: (): WithdrawState => ({
    providers: [],
    config: null,
    requests: [],
    balance: null,
    submitting: false,
    error: null,
  }),

  actions: {
    async loadProviders() {
      const data = await getProviders();
      this.providers = data.providers;
      this.config = data.config;
    },

    async loadBalance(endpoint: string) {
      const data = await getBalance(endpoint);
      this.balance = data.balance;
    },

    async loadRequests() {
      const data = await listRequests();
      this.requests = data.requests;
    },

    /**
     * POST the withdraw request. On success the request history is
     * refreshed; on failure the backend's error message lands in
     * `error` for the panel to display, and null is returned.
     */
    async submit(input: WithdrawSubmitInput): Promise<WithdrawRequestRow | null> {
      this.submitting = true;
      this.error = null;
      try {
        const created = await submitWithdraw({
          provider: input.provider,
          amount: input.amount,
          destination: input.destination,
          balance_source: input.balanceSource,
        });
        await this.loadRequests();
        return created;
      } catch (caught) {
        this.error = caught instanceof Error ? caught.message : String(caught);
        return null;
      } finally {
        this.submitting = false;
      }
    },
  },
});
