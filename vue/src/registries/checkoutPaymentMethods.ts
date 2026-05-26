/**
 * Agnostic checkout payment-method extension point.
 *
 * A plugin registers, keyed by the payment-method code from the backend's
 * ``vbwd_payment_method`` table, any of:
 *   - ``detailComponent`` — rendered under the selected method on the checkout
 *     page (e.g. the "Pay with tokens" live quote).
 *   - ``redirectPath(invoiceId)`` — for gateway methods (stripe / paypal /
 *     yookassa / …) that hop to a per-plugin ``/pay/<name>`` view after the
 *     invoice is created.
 *   - ``instantPay(invoiceId)`` — for in-band methods (e.g. token balance)
 *     that finish in one HTTP call and then land on ``/checkout/confirmation``.
 *
 * Core's checkout never names a concrete method: the registry is the single
 * dispatch table. Mirrors fe-admin's extensionRegistry + the existing
 * ``checkout*Registry`` pattern.
 */
import { markRaw, type Component } from 'vue';

export interface CheckoutPaymentMethodEntry {
  detailComponent?: Component;
  redirectPath?: (invoiceId: string) => string;
  instantPay?: (invoiceId: string) => Promise<unknown>;
}

const entries: Record<string, CheckoutPaymentMethodEntry> = {};

export function registerCheckoutPaymentMethod(
  code: string,
  entry: CheckoutPaymentMethodEntry,
): void {
  const merged: CheckoutPaymentMethodEntry = { ...entries[code], ...entry };
  if (merged.detailComponent) merged.detailComponent = markRaw(merged.detailComponent);
  entries[code] = merged;
}

export function getCheckoutPaymentMethod(
  code: string,
): CheckoutPaymentMethodEntry | undefined {
  return entries[code];
}

/** Test helper. */
export function _resetCheckoutPaymentMethods(): void {
  for (const code of Object.keys(entries)) delete entries[code];
}
