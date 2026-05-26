/**
 * Agnostic checkout payment-method extension point (s12).
 *
 * A plugin registers, keyed by the payment-method code from the backend's
 * ``vbwd_payment_method`` table, an optional **detail component** rendered
 * under the selected method (e.g. the "Pay with tokens" quote block) and an
 * optional **instantPay** hook called after invoice creation for methods that
 * complete in-band (no gateway redirect, no PENDING state).
 *
 * Mirrors the s10 `invoicePaymentMethods` registry + the existing checkout
 * `checkout*Registry` pattern — core stays agnostic.
 */
import { markRaw, type Component } from 'vue';

export interface CheckoutPaymentMethodEntry {
  detailComponent?: Component;
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
