/**
 * Checkout Context Registry
 *
 * Plugins can register a Vue component that will be rendered inside the checkout
 * page immediately after the email/auth block. The component receives no props —
 * it should read what it needs from the route query or its own store.
 *
 * This keeps the checkout plugin agnostic: it renders whatever component is
 * registered, with no knowledge of which plugin provided it.
 *
 * Usage (from another plugin's install() hook):
 *   import { checkoutContextRegistry } from '../checkout/checkoutContextRegistry';
 *   import MyContextBanner from './components/MyContextBanner.vue';
 *   checkoutContextRegistry.register(MyContextBanner);
 *
 * Usage (from another plugin's deactivate() hook):
 *   checkoutContextRegistry.unregister();
 */

import { shallowRef, type Component } from 'vue';

class CheckoutContextRegistry {
  // shallowRef — NOT ref: a deep ref wraps the registered component in a reactive
  // proxy, which makes <component :is> churn/remount the context banner on every
  // tick (infinite loop → "Loading plan details…" forever + recurring backend
  // requests). shallowRef keeps the component's raw identity while still reacting
  // to register()/unregister() at the .value level.
  private readonly _component = shallowRef<Component | null>(null);

  /** Register a component to render as checkout context. Only one at a time. */
  register(component: Component): void {
    this._component.value = component;
  }

  /** Remove the registered context component. */
  unregister(): void {
    this._component.value = null;
  }

  /** Reactive ref — use directly in template via v-if / :is */
  readonly component = this._component;
}

export const checkoutContextRegistry = new CheckoutContextRegistry();
