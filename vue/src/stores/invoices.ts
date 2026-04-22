import { defineStore } from 'pinia';
import { api } from '@/api';
import { downloadAuthenticatedFile } from '@/utils/download';

export interface Invoice {
  id: string;
  user_id: string;
  tarif_plan_id: string;
  subscription_id: string | null;
  invoice_number: string;
  amount: string;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  payment_method: string | null;
  payment_ref: string | null;
  is_payable: boolean;
  invoiced_at: string | null;
  paid_at: string | null;
  expires_at: string | null;
  created_at?: string;
}

export const useInvoicesStore = defineStore('invoices', {
  state: () => ({
    invoices: [] as Invoice[],
    loading: false,
    error: null as string | null
  }),

  getters: {
    // Helper to get formatted invoice list for display
    formattedInvoices(): Array<{
      id: string;
      number: string;
      date: string;
      amount: string;
      currency: string;
      status: string;
      is_payable: boolean;
    }> {
      return this.invoices.map(inv => ({
        id: inv.id,
        number: inv.invoice_number,
        date: inv.invoiced_at || '',
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        is_payable: inv.is_payable,
      }));
    }
  },

  actions: {
    async fetchInvoices() {
      this.loading = true;
      this.error = null;

      try {
        const response = await api.get('/user/invoices') as { invoices: Invoice[] };
        this.invoices = response.invoices || [];
        return response;
      } catch (error) {
        this.error = (error as Error).message || 'Failed to fetch invoices';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async getInvoice(invoiceId: string): Promise<Invoice | null> {
      try {
        const response = await api.get(`/user/invoices/${invoiceId}`) as { invoice: Invoice };
        return response.invoice;
      } catch (error) {
        this.error = (error as Error).message || 'Failed to fetch invoice';
        return null;
      }
    },

    async downloadInvoice(invoiceId: string, invoiceNumber?: string): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const filename = `invoice-${invoiceNumber || invoiceId}.pdf`;
        await downloadAuthenticatedFile(
          `/user/invoices/${invoiceId}/pdf`,
          filename,
        );
      } catch (error) {
        this.error = (error as Error).message || 'Failed to download invoice';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    getInvoiceById(invoiceId: string): Invoice | undefined {
      return this.invoices.find(inv => inv.id === invoiceId);
    },

    reset() {
      this.invoices = [];
      this.error = null;
      this.loading = false;
    }
  }
});
