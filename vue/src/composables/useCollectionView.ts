/**
 * Shared collection-view logic for the catalog CMS widgets (DRY).
 *
 * The TariffPlanCollection (subscription plugin) and the TokenBundleCollection
 * (checkout plugin) widgets both render a searchable / price-sortable /
 * card-or-table collection. The search, sort, and view-toggle state machine is
 * identical, so it lives here once; each widget supplies only its own item
 * shape via two pure accessors:
 *
 *   - ``searchableText(item)`` — the text the quick-search filters against
 *     (name + description);
 *   - ``sortKey(item)`` — the numeric net price the price-sort compares.
 *
 * The composable is plugin-agnostic and carries no plan/bundle knowledge, so it
 * may live in fe-user core without breaching the core-stays-agnostic rule.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';

export type CollectionViewMode = 'cards' | 'table';
export type CollectionSortDirection = 'asc' | 'desc';

export interface UseCollectionViewOptions<TItem> {
  /** The raw, unfiltered items (reactive). */
  items: Ref<TItem[]> | ComputedRef<TItem[]>;
  /** Lower-cased substring search runs against this text (name + description). */
  searchableText: (item: TItem) => string;
  /** Numeric key the price sort compares (the item's net price). */
  sortKey: (item: TItem) => number;
  /** Initial view from ``config.default_view`` (defaults to ``cards``). */
  initialView?: CollectionViewMode;
}

export interface UseCollectionViewResult<TItem> {
  searchQuery: Ref<string>;
  viewMode: Ref<CollectionViewMode>;
  sortDirection: Ref<CollectionSortDirection>;
  /** The filtered + sorted items the widget renders. */
  visibleItems: ComputedRef<TItem[]>;
  setView: (mode: CollectionViewMode) => void;
  toggleSort: () => void;
}

export function useCollectionView<TItem>(
  options: UseCollectionViewOptions<TItem>,
): UseCollectionViewResult<TItem> {
  const searchQuery = ref('');
  const viewMode = ref<CollectionViewMode>(options.initialView ?? 'cards');
  // Default sort is by price ascending; the toggle flips to descending.
  const sortDirection = ref<CollectionSortDirection>('asc');

  const visibleItems = computed<TItem[]>(() => {
    const query = searchQuery.value.trim().toLowerCase();
    const filtered = query
      ? options.items.value.filter((item) =>
          options.searchableText(item).toLowerCase().includes(query),
        )
      : [...options.items.value];

    const ascending = sortDirection.value === 'asc';
    return filtered.sort((firstItem, secondItem) => {
      const difference = options.sortKey(firstItem) - options.sortKey(secondItem);
      return ascending ? difference : -difference;
    });
  });

  function setView(mode: CollectionViewMode): void {
    viewMode.value = mode;
  }

  function toggleSort(): void {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  }

  return { searchQuery, viewMode, sortDirection, visibleItems, setView, toggleSort };
}
