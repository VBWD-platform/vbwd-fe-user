/**
 * Brand Actions Registry
 *
 * A generic, plugin-agnostic seam that lets plugins inject small "brand-area"
 * actions (e.g. a Home link) into the sidebar logo block of UserLayout.
 * Plugins register in their activate() hook and unregister in deactivate();
 * UserLayout reads from this registry dynamically.
 *
 * Core stays agnostic — it never names a specific plugin or action. The
 * internal map is wrapped with Vue's reactive() so computed() properties
 * re-evaluate automatically when plugins register or unregister.
 */

import { reactive, ref } from 'vue';

export interface BrandAction {
  /** Unique id — used as map key for registration/deregistration. */
  id: string;
  /** Vue component rendered by UserLayout via <component :is="...">. */
  component: unknown;
  /** Ascending sort weight (default 100 when omitted). */
  order?: number;
}

const DEFAULT_ORDER = 100;

class BrandActionsRegistry {
  private _actions: Map<string, BrandAction> = reactive(new Map());
  // An optional URL the brand name should link to (e.g. a plugin's public
  // home). Reactive so UserLayout's computed re-evaluates when it changes.
  // Generic on purpose — the registry never names the CMS/home.
  private _brandHref = ref<string | null>(null);

  /** Register a brand action. Call from a plugin's activate() hook. */
  register(action: BrandAction): void {
    this._actions.set(action.id, action);
  }

  /** Remove a brand action by id. Call from a plugin's deactivate() hook. */
  unregister(id: string): void {
    this._actions.delete(id);
  }

  /** All actions, sorted ascending by order (default 100). */
  getAll(): BrandAction[] {
    return Array.from(this._actions.values()).sort(
      (first, second) => (first.order ?? DEFAULT_ORDER) - (second.order ?? DEFAULT_ORDER),
    );
  }

  /**
   * Set the optional URL the brand name should link to (or `null` to clear it).
   * A plugin publishes its own resolved href here; core wraps the brand name in
   * a link without knowing what that URL means.
   */
  setBrandHref(href: string | null): void {
    this._brandHref.value = href;
  }

  /** The currently registered brand-link URL, or `null` when none is set. */
  getBrandHref(): string | null {
    return this._brandHref.value;
  }
}

export const brandActionsRegistry = new BrandActionsRegistry();
