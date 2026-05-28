/**
 * profileSectionsRegistry — agnostic seam for plugins to inject custom
 * cards into the user's Profile page.
 *
 * The meinchat plugin uses this to drop in a "choose nickname" block
 * (mirrors what the iOS app does via ``ProfileNicknameSection``). Future
 * plugins can hook in the same way (e.g. token-payment showing wallet
 * preferences, ghrm showing a connected-GitHub field) without the core
 * Profile view needing to know about any specific plugin.
 *
 * A contributor is just a Vue component — it owns its own surface
 * (typically a ``.card`` div matching the other Profile cards) and its
 * own data fetching/saving. Ordering follows ``order`` (ascending,
 * default 100).
 */
import type { Component } from 'vue';

export interface ProfileSection {
  /** Stable id used as Vue key + ``data-testid`` suffix. */
  id: string;
  /** Vue component to render. Receives no props. */
  component: Component;
  /** Display ordering (ascending). Default 100. */
  order?: number;
}

const registry: ProfileSection[] = [];

export function registerProfileSection(section: ProfileSection): void {
  // Last-write-wins on the same id — matches the override semantics
  // already in checkoutPaymentMethods / paymentDataContributors.
  const existing = registry.findIndex((entry) => entry.id === section.id);
  if (existing >= 0) registry.splice(existing, 1);
  registry.push(section);
}

export function getProfileSections(): ProfileSection[] {
  return [...registry].sort(
    (left, right) => (left.order ?? 100) - (right.order ?? 100),
  );
}

/** Test helper — wipes the registry between specs. */
export function _resetProfileSections(): void {
  registry.length = 0;
}
