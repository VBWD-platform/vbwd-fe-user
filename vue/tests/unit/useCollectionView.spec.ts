/**
 * Shared collection-view composable (search + price-sort + view toggle).
 *
 * Both the TariffPlanCollection (subscription plugin) and the
 * TokenBundleCollection (checkout plugin) CMS widgets reuse this single piece
 * so the search/sort/view-toggle logic lives in exactly one place (DRY). The
 * composable is plugin-agnostic: callers supply the raw items plus pure
 * accessors for the searchable text and the numeric sort key (net price).
 */
import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useCollectionView } from '@/composables/useCollectionView';

interface Row {
  name: string;
  description: string;
  netPrice: number;
}

const rows: Row[] = [
  { name: 'Gamma', description: 'cheapest tier', netPrice: 5 },
  { name: 'Alpha', description: 'mid tier', netPrice: 20 },
  { name: 'Beta', description: 'premium tier', netPrice: 10 },
];

function build(initialView: 'cards' | 'table' = 'cards') {
  return useCollectionView({
    items: ref(rows),
    searchableText: (row: Row) => `${row.name} ${row.description}`,
    sortKey: (row: Row) => row.netPrice,
    initialView,
  });
}

describe('useCollectionView', () => {
  it('defaults to ascending price sort', () => {
    const view = build();
    expect(view.visibleItems.value.map((row) => row.name)).toEqual(['Gamma', 'Beta', 'Alpha']);
    expect(view.sortDirection.value).toBe('asc');
  });

  it('flips to descending when the price-sort toggle is invoked', () => {
    const view = build();
    view.toggleSort();
    expect(view.sortDirection.value).toBe('desc');
    expect(view.visibleItems.value.map((row) => row.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('filters by the searchable text (name + description), case-insensitive', () => {
    const view = build();
    view.searchQuery.value = 'PREMIUM';
    expect(view.visibleItems.value.map((row) => row.name)).toEqual(['Beta']);
    view.searchQuery.value = 'alp';
    expect(view.visibleItems.value.map((row) => row.name)).toEqual(['Alpha']);
  });

  it('honours the initial view and toggles between cards and table', () => {
    const view = build('table');
    expect(view.viewMode.value).toBe('table');
    view.setView('cards');
    expect(view.viewMode.value).toBe('cards');
  });

  it('keeps search and sort composable — filtered set stays sorted', () => {
    const view = build();
    view.searchQuery.value = 'tier';
    view.toggleSort();
    expect(view.visibleItems.value.map((row) => row.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});
