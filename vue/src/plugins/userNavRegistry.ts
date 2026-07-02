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
   * Optional generic icon name from the shared fe-core registry
   * (e.g. 'chat', 'layers', 'sparkles'). Rendered by UserLayout via the shared
   * <Icon> component. Keep names domain-agnostic.
   */
  icon?: string;
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
   * i18n key for the collapsible group's own label. Provided on the items of a
   * plugin-defined group (e.g. 'vendor') so UserLayout can render the group
   * header without core knowing the group. The first item that carries it wins.
   */
  groupLabelKey?: string;
  /**
   * Optional generic icon name for the group header (see `icon`).
   */
  groupIcon?: string;
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

  /**
   * Distinct plugin-defined collapsible groups, derived from the registered
   * items that carry a `group`. The core `store` group is rendered explicitly
   * by UserLayout (it also hosts core Tokens), so it is excluded here to avoid
   * a duplicate. Each descriptor carries the group id plus the label/icon taken
   * from the first item that declared them — keeping core agnostic to which
   * plugin owns which group.
   */
  getGroups(exclude: string[] = ['store']): Array<{
    id: string;
    labelKey: string;
    icon?: string;
  }> {
    const groups = new Map<string, { id: string; labelKey: string; icon?: string }>();
    for (const item of this._items.values()) {
      if (!item.group || exclude.includes(item.group)) continue;
      if (!groups.has(item.group)) {
        groups.set(item.group, {
          id: item.group,
          labelKey: item.groupLabelKey ?? item.labelKey,
          icon: item.groupIcon,
        });
      }
    }
    return Array.from(groups.values());
  }
}

export const userNavRegistry = new UserNavRegistry();
