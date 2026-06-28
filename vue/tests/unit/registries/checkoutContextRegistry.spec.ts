/**
 * Checkout context registry — must NOT make the registered component reactive.
 *
 * Regression: the registry stored the component in a deep `ref`, so Vue wrapped
 * the component in a reactive proxy ("Vue received a Component that was made a
 * reactive object" warning). On the checkout page that proxy made
 * `<component :is>` churn/remount the context banner (e.g. GhrmCheckoutContext)
 * on every tick — an infinite loop that left "Loading plan details…" spinning
 * forever and hammered the backend with recurring requests. The fix is a
 * `shallowRef` so the component keeps its raw identity.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { isReactive, defineComponent } from 'vue';
import { checkoutContextRegistry } from '@/registries/checkoutContextRegistry';

const Banner = defineComponent({ name: 'Banner', render: () => null });

describe('checkoutContextRegistry', () => {
  beforeEach(() => checkoutContextRegistry.unregister());

  it('stores the component with its raw identity (not a reactive proxy)', () => {
    checkoutContextRegistry.register(Banner);
    // A reactive proxy here !== Banner and would remount <component :is> in a loop.
    expect(checkoutContextRegistry.component.value).toBe(Banner);
    expect(isReactive(checkoutContextRegistry.component.value)).toBe(false);
  });

  it('still reacts to register / unregister at the .value level', () => {
    expect(checkoutContextRegistry.component.value).toBeNull();
    checkoutContextRegistry.register(Banner);
    expect(checkoutContextRegistry.component.value).toBe(Banner);
    checkoutContextRegistry.unregister();
    expect(checkoutContextRegistry.component.value).toBeNull();
  });
});
