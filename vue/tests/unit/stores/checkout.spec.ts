import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCheckoutStore } from '../../../src/stores/checkout';
import {
  checkoutSourceRegistry,
  type CheckoutSource,
  type CheckoutResult,
  type LineItem,
} from '../../../src/registries/checkoutSourceRegistry';

/**
 * The core checkout store is plugin-agnostic: it drives whatever CheckoutSource
 * the registry matches. These tests register a fake source and assert the store
 * delegates load / line items / total / submit / reset to it — never naming any
 * plugin domain.
 */
function makeSource(overrides: Partial<CheckoutSource> = {}): CheckoutSource & {
  loadCalls: number;
  resetCalls: number;
} {
  const items: LineItem[] = [
    { type: 'fake', id: 'x1', name: 'Item One', price: 10 },
    { type: 'fake', id: 'x2', name: 'Item Two', price: 5 },
  ];
  const result: CheckoutResult = {
    invoice: {
      id: 'inv-1',
      invoice_number: 'INV-001',
      status: 'PENDING',
      amount: '15',
      total_amount: '15',
      currency: 'USD',
      line_items: items,
    },
    message: 'ok',
  };
  const source = {
    id: 'fake',
    loadCalls: 0,
    resetCalls: 0,
    matches: (ctx) => ctx.source === 'fake',
    async load() { source.loadCalls += 1; },
    getLineItems: () => items,
    getOrderTotal: () => 15,
    submit: vi.fn(async () => result),
    reset() { source.resetCalls += 1; },
    ...overrides,
  } as CheckoutSource & { loadCalls: number; resetCalls: number };
  return source;
}

describe('core checkout store (agnostic)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    checkoutSourceRegistry.clear();
    vi.clearAllMocks();
  });

  it('initializes empty with no active source', () => {
    const store = useCheckoutStore();
    expect(store.hasActiveSource).toBe(false);
    expect(store.lineItems).toEqual([]);
    expect(store.orderTotal).toBe(0);
    expect(store.checkoutResult).toBeNull();
    expect(store.error).toBeNull();
  });

  it('loads via the matching source and projects its line items + total', async () => {
    const source = makeSource();
    checkoutSourceRegistry.register(source);
    const store = useCheckoutStore();

    await store.loadForContext({ source: 'fake' });

    expect(source.loadCalls).toBe(1);
    expect(store.hasActiveSource).toBe(true);
    expect(store.lineItems).toHaveLength(2);
    expect(store.orderTotal).toBe(15);
  });

  it('leaves no active source when nothing matches (empty state, no error)', async () => {
    const store = useCheckoutStore();
    await store.loadForContext({ source: 'nope' });
    expect(store.hasActiveSource).toBe(false);
    expect(store.error).toBeNull();
  });

  it('surfaces a source load error', async () => {
    const source = makeSource({ load: async () => { throw new Error('Cart is empty'); } });
    checkoutSourceRegistry.register(source);
    const store = useCheckoutStore();

    await store.loadForContext({ source: 'fake' });
    expect(store.error).toBe('Cart is empty');
  });

  it('delegates submit to the active source and stores the result', async () => {
    const source = makeSource();
    checkoutSourceRegistry.register(source);
    const store = useCheckoutStore();
    await store.loadForContext({ source: 'fake' });
    store.setPaymentMethod('stripe');

    await store.submitCheckout();

    expect(source.submit).toHaveBeenCalledWith('stripe');
    expect(store.checkoutResult?.invoice.id).toBe('inv-1');
    expect(store.error).toBeNull();
  });

  it('errors on submit when no source is active', async () => {
    const store = useCheckoutStore();
    await store.submitCheckout();
    expect(store.error).toBe('No items selected');
  });

  it('reset clears state and resets the active source', async () => {
    const source = makeSource();
    checkoutSourceRegistry.register(source);
    const store = useCheckoutStore();
    await store.loadForContext({ source: 'fake' });

    store.reset();

    expect(source.resetCalls).toBe(1);
    expect(store.hasActiveSource).toBe(false);
    expect(store.paymentMethodCode).toBeNull();
    expect(store.checkoutResult).toBeNull();
  });

  it('picks the highest-priority matching source', async () => {
    const low = makeSource({ id: 'low', priority: 1, matches: () => true });
    const high = makeSource({ id: 'high', priority: 10, matches: () => true });
    checkoutSourceRegistry.register(low);
    checkoutSourceRegistry.register(high);
    const store = useCheckoutStore();

    await store.loadForContext({});

    expect(high.loadCalls).toBe(1);
    expect(low.loadCalls).toBe(0);
  });

  it('delegates applyCoupon to the active source and exposes the discount', async () => {
    const source = makeSource({
      applyCoupon: vi.fn(async () => ({ valid: true, discountAmount: 3 })),
      getDiscountAmount: () => 3,
    });
    checkoutSourceRegistry.register(source);
    const store = useCheckoutStore();
    await store.loadForContext({ source: 'fake' });

    await store.applyCoupon('SUB30');

    expect(source.applyCoupon).toHaveBeenCalledWith('SUB30');
    expect(store.couponCode).toBe('SUB30');
    expect(store.couponError).toBeNull();
    expect(store.discountAmount).toBe(3);
  });

  it('records couponError and no code when the source rejects the coupon', async () => {
    const source = makeSource({
      applyCoupon: vi.fn(async () => ({ valid: false, discountAmount: 0, error: 'Coupon not found' })),
      getDiscountAmount: () => 0,
    });
    checkoutSourceRegistry.register(source);
    const store = useCheckoutStore();
    await store.loadForContext({ source: 'fake' });

    await store.applyCoupon('NOPE');

    expect(store.couponCode).toBeNull();
    expect(store.couponError).toBe('Coupon not found');
    expect(store.discountAmount).toBe(0);
  });

  it('clearCoupon delegates to the source and resets coupon state', async () => {
    const clearCoupon = vi.fn();
    const source = makeSource({
      applyCoupon: vi.fn(async () => ({ valid: true, discountAmount: 3 })),
      getDiscountAmount: () => 3,
      clearCoupon,
    });
    checkoutSourceRegistry.register(source);
    const store = useCheckoutStore();
    await store.loadForContext({ source: 'fake' });
    await store.applyCoupon('SUB30');

    store.clearCoupon();

    expect(clearCoupon).toHaveBeenCalled();
    expect(store.couponCode).toBeNull();
    expect(store.couponError).toBeNull();
  });

  it('is agnostic: applyCoupon is a no-op when the source has no coupon support', async () => {
    const source = makeSource(); // no applyCoupon
    checkoutSourceRegistry.register(source);
    const store = useCheckoutStore();
    await store.loadForContext({ source: 'fake' });

    await store.applyCoupon('SUB30');

    expect(store.couponCode).toBeNull();
    expect(store.discountAmount).toBe(0);
  });
});
