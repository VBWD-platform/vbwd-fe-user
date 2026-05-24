/**
 * Core checkout store — plugin-agnostic.
 *
 * Holds only generic checkout orchestration: the active checkout source, the
 * payment method, the submit lifecycle, and the result. It delegates *what*
 * is being bought (plan, shop cart, …) to a `CheckoutSource` registered by the
 * owning plugin via `checkoutSourceRegistry`. Core names no plugin domain.
 *
 * Subscription-specific checkout state now lives in the subscription plugin's
 * own store; shop-specific state in the shop plugin. See
 * `@/registries/checkoutSourceRegistry`.
 */
import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import {
  checkoutSourceRegistry,
  type CheckoutSource,
  type CheckoutResult,
  type LineItem,
  type CheckoutRouteContext,
} from '@/registries/checkoutSourceRegistry';

// Re-export the generic types so existing `@/stores/checkout` type imports keep working.
export type { LineItem, CheckoutResult, CheckoutRouteContext } from '@/registries/checkoutSourceRegistry';

export const useCheckoutStore = defineStore('checkout', () => {
  // State
  const activeSource = shallowRef<CheckoutSource | null>(null);
  const loading = ref(false);
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const checkoutResult = ref<CheckoutResult | null>(null);
  const isCartCheckout = ref(false);
  const paymentMethodCode = ref<string | null>(null);

  // Computed — projected from the active source's (reactive) plugin state
  const hasActiveSource = computed(() => activeSource.value !== null);
  const lineItems = computed<LineItem[]>(() => activeSource.value?.getLineItems() ?? []);
  const orderTotal = computed<number>(() => activeSource.value?.getOrderTotal() ?? 0);
  const summaryComponent = computed(() => activeSource.value?.summaryComponent ?? null);

  // Actions
  /** Pick the source matching the route context and load its items. */
  async function loadForContext(ctx: CheckoutRouteContext): Promise<void> {
    const source = checkoutSourceRegistry.find(ctx);
    activeSource.value = source;
    if (!source) {
      // No matching source — the view renders its empty state, not an error.
      return;
    }
    isCartCheckout.value = !!ctx.isCart || ctx.source === 'shop';
    loading.value = true;
    error.value = null;
    try {
      await source.load(ctx);
    } catch (e: unknown) {
      const err = e as { message?: string };
      error.value = err.message || 'Failed to load checkout';
    } finally {
      loading.value = false;
    }
  }

  function setPaymentMethod(code: string): void {
    paymentMethodCode.value = code;
  }

  async function submitCheckout(): Promise<void> {
    if (!activeSource.value) {
      error.value = 'No items selected';
      return;
    }
    submitting.value = true;
    error.value = null;
    try {
      checkoutResult.value = await activeSource.value.submit(paymentMethodCode.value);
    } catch (e: unknown) {
      const err = e as { message?: string };
      error.value = err.message || 'Checkout failed';
    } finally {
      submitting.value = false;
    }
  }

  function reset(): void {
    activeSource.value?.reset();
    activeSource.value = null;
    loading.value = false;
    submitting.value = false;
    error.value = null;
    checkoutResult.value = null;
    isCartCheckout.value = false;
    paymentMethodCode.value = null;
  }

  return {
    // State
    loading,
    submitting,
    error,
    checkoutResult,
    isCartCheckout,
    paymentMethodCode,
    // Computed
    hasActiveSource,
    lineItems,
    orderTotal,
    summaryComponent,
    // Actions
    loadForContext,
    setPaymentMethod,
    submitCheckout,
    reset,
  };
});
