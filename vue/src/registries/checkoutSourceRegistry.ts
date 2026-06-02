/**
 * Checkout Source Registry
 *
 * Makes the core checkout **store** plugin-agnostic. Each plugin that can be
 * purchased (subscription plans, the shop cart, …) registers a CheckoutSource
 * describing how to load its line items, total them, and submit them to its own
 * API endpoint. Core never names a plugin domain — it just drives whichever
 * source matches the current route context.
 *
 * Mirrors the backend line-item registry pattern (resolve/recurring handlers).
 *
 * Usage (from a plugin's install() hook):
 *   import { checkoutSourceRegistry } from '@/registries/checkoutSourceRegistry';
 *   checkoutSourceRegistry.register({
 *     id: 'subscription',
 *     matches: (ctx) => !!ctx.planSlug || ctx.cartType === 'subscription',
 *     load: (ctx) => store.loadPlan(ctx.planSlug!),
 *     getLineItems: () => store.lineItems,
 *     getOrderTotal: () => store.orderTotal,
 *     submit: (pm) => store.submit(pm),
 *     reset: () => store.reset(),
 *     summaryComponent: PlanCheckoutSummary,
 *   });
 */
import type { Component } from 'vue';

/** A single purchasable line in a checkout. `type` is an opaque plugin string. */
export interface LineItem {
  type: string;
  id: string;
  name: string;
  price: number;
  description?: string;
  total_price?: string;
  token_amount?: number;
  quantity?: number;
  currency?: string;
}

/** Generic checkout result. Plugins may extend with their own fields. */
export interface CheckoutResult {
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    amount: string;
    total_amount: string;
    currency: string;
    line_items: LineItem[];
  };
  message: string;
  [key: string]: unknown;
}

/** Route-derived context used to pick the matching checkout source. */
export interface CheckoutRouteContext {
  /** Subscription plan slug (e.g. `?tarif_plan_id=pro`). */
  planSlug?: string;
  /** Source hint from the route (e.g. `?source=shop`). */
  source?: string;
  /** Whether this checkout is driven by a cart. */
  isCart?: boolean;
  [key: string]: unknown;
}

export interface CheckoutSource {
  /** Unique id (also used to unregister). */
  id: string;
  /** Higher wins when several sources match (default 0). */
  priority?: number;
  /** Does this source handle the given route context? */
  matches(ctx: CheckoutRouteContext): boolean;
  /** Load this source's items for the given context. May throw on error. */
  load(ctx: CheckoutRouteContext): Promise<void>;
  /** Current line items (read reactive plugin state). */
  getLineItems(): LineItem[];
  /** Current order total (read reactive plugin state). */
  getOrderTotal(): number;
  /** Submit and resolve to a checkout result. May throw on error. */
  submit(paymentMethodCode: string | null): Promise<CheckoutResult>;
  /** Clear this source's state. */
  reset(): void;
  /** Optional component rendering this source's order summary (items + total). */
  summaryComponent?: Component;

  // ── Optional coupon support (additive — sources that omit these behave as
  //    today, no coupon). `getOrderTotal()` returns the NET total: a source
  //    that applies a coupon subtracts its own discount. ──────────────────────
  /** Validate + apply a coupon code; resolves with the discount it grants. */
  applyCoupon?(code: string): Promise<{ valid: boolean; discountAmount: number; error?: string }>;
  /** Current discount amount (0 when none applied). */
  getDiscountAmount?(): number;
  /** Clear any applied coupon. */
  clearCoupon?(): void;
}

class CheckoutSourceRegistry {
  private sources: Map<string, CheckoutSource> = new Map();

  register(source: CheckoutSource): void {
    this.sources.set(source.id, source);
  }

  unregister(id: string): void {
    this.sources.delete(id);
  }

  get(id: string): CheckoutSource | null {
    return this.sources.get(id) ?? null;
  }

  /** Highest-priority source whose `matches(ctx)` is true, or null. */
  find(ctx: CheckoutRouteContext): CheckoutSource | null {
    let best: CheckoutSource | null = null;
    this.sources.forEach((source) => {
      if (source.matches(ctx)) {
        if (!best || (source.priority ?? 0) > (best.priority ?? 0)) {
          best = source;
        }
      }
    });
    return best;
  }

  /** Test helper. */
  clear(): void {
    this.sources.clear();
  }
}

export const checkoutSourceRegistry = new CheckoutSourceRegistry();
