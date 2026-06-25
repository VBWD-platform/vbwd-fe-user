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
  /** Absolute route path (e.g. '/dashboard/tarot') */
  to: string;
  /**
   * i18n key for the label (e.g. 'nav.tarot').
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
  /**
   * Collapsible nav group this item belongs to.
   * Items with a group are rendered inside that group's sub-menu and
   * are excluded from getSidebarItems(). Open string so any plugin can
   * contribute to a group (e.g. 'store') without core knowing the value.
   */
  group?: string;
  /**
   * When true, an external-link icon (↗) is shown next to the label
   * to signal that the link opens a public-facing area.
   */
  externalIcon?: boolean;
  /**
   * User-facing permission required to see this nav item.
   * If set, the item is hidden when the user lacks this permission.
   */
  requiredUserPermission?: string;
}

class UserNavRegistry {
  private _items: Map<string, UserNavItem> = reactive(new Map());

  /**
   * Register a plugin nav item.
   * Call from a plugin's activate() hook.
   */
  register(item: UserNavItem): void {
    // Keyed by pluginName + route so a single plugin can register multiple
    // nav items (e.g. subscription → Plans, Add-Ons, Subscription).
    this._items.set(`${item.pluginName}::${item.to}`, item);
  }

  /**
   * Remove a plugin's nav item(s).
   * Call from a plugin's deactivate() hook so the items disappear immediately.
   * Removes every item registered by the plugin (all its routes).
   */
  unregister(pluginName: string): void {
    for (const key of Array.from(this._items.keys())) {
      if (key === pluginName || key.startsWith(`${pluginName}::`)) {
        this._items.delete(key);
      }
    }
  }

  /** All items that appear as top-level sidebar links (no group). */
  getSidebarItems(): UserNavItem[] {
    return Array.from(this._items.values()).filter(
      (i) => (i.placement ?? 'sidebar') === 'sidebar' && !i.group,
    );
  }

  /** All items that appear in the user dropdown menu. */
  getMenuItems(): UserNavItem[] {
    return Array.from(this._items.values()).filter(
      (i) => i.placement === 'menu',
    );
  }

  /** All items registered under a specific collapsible group. */
  getGroupItems(group: string): UserNavItem[] {
    return Array.from(this._items.values()).filter(
      (i) => i.group === group,
    );
  }
}

export const userNavRegistry = new UserNavRegistry();
