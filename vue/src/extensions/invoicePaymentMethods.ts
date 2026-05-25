/**
 * Agnostic extension point for invoice payment methods.
 *
 * Plugins register a component that `InvoiceDetail.vue` renders for PENDING
 * invoices. Core never names a concrete method (token balance, etc.) — it just
 * renders whatever plugins registered. Mirrors fe-admin's extensionRegistry
 * pattern (S6). Each registered component receives an `invoice` prop and may
 * emit `paid` to ask the host view to refresh.
 */
import { markRaw, type Component } from 'vue';

const invoicePaymentMethods: Component[] = [];

export function registerInvoicePaymentMethod(component: Component): void {
  invoicePaymentMethods.push(markRaw(component));
}

export function getInvoicePaymentMethods(): Component[] {
  return invoicePaymentMethods;
}

/** Test helper: clear the registry between tests. */
export function _resetInvoicePaymentMethods(): void {
  invoicePaymentMethods.length = 0;
}
