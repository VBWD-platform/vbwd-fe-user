/**
 * User Nav Registry
 *
 * Plugins register their nav items here in activate() and unregister in deactivate().
 * UserLayout reads from this registry dynamically.
 *
 * Keeps the core user app agnostic to specific plugins.
 * The internal map is wrapped with Vue's reactive() so computed() properties
 * re-evaluate automatically when plugins register or unregister.
 */

import { reactive } from 'vue';

export interface UserNavItem {
  /** Unique plugin ID – used as map key for registration/deregistration */
  pluginName: string;
  /** Absolute route path (e.g. '/dashboard/taro') */
  to: string;
  /**
   * i18n key for the label (e.g. 'nav.taro').
   * The plugin MUST provide this translation via sdk.addTranslations().
   */
  labelKey: string;
  /** Optional data-testid attribute */
  testId?: string;
  /**
   * Where the item appears:
   *   'sidebar' – top-level nav link in the sidebar (default)
   *   'menu'    – entry in the user dropdown menu
   */
  placement?: 'sidebar' | 'menu';
}

class UserNavRegistry {
  private _items: Map<string, UserNavItem> = reactive(new Map());

  /**
   * Register a plugin nav item.
   * Call from a plugin's activate() hook.
   */
  register(item: UserNavItem): void {
    this._items.set(item.pluginName, item);
  }

  /**
   * Remove a plugin nav item.
   * Call from a plugin's deactivate() hook so the item disappears immediately.
   */
  unregister(pluginName: string): void {
    this._items.delete(pluginName);
  }

  /** All items that appear in the sidebar nav. */
  getSidebarItems(): UserNavItem[] {
    return Array.from(this._items.values()).filter(
      (i) => (i.placement ?? 'sidebar') === 'sidebar',
    );
  }

  /** All items that appear in the user dropdown menu. */
  getMenuItems(): UserNavItem[] {
    return Array.from(this._items.values()).filter(
      (i) => i.placement === 'menu',
    );
  }
}

export const userNavRegistry = new UserNavRegistry();
