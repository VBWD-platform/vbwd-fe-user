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

export type ProfileSectionPlacement = 'top' | 'bottom';

export interface ProfileSection {
  /** Stable id used as Vue key + ``data-testid`` suffix. */
  id: string;
  /** Vue component to render. Receives no props. */
  component: Component;
  /** Display ordering within the same placement (ascending). Default 100. */
  order?: number;
  /**
   * Where to render relative to the core Profile cards.
   *
   *   - ``'top'``    — above the Account Information card (use for blocks
   *                     the user should see *first*, e.g. picking a
   *                     nickname before browsing the rest of Profile).
   *   - ``'bottom'`` — below the Change Password card (default; for
   *                     supplementary cards like plugin settings).
   */
  placement?: ProfileSectionPlacement;
}

const registry: ProfileSection[] = [];

export function registerProfileSection(section: ProfileSection): void {
  // Last-write-wins on the same id — matches the override semantics
  // already in checkoutPaymentMethods / paymentDataContributors.
  const existing = registry.findIndex((entry) => entry.id === section.id);
  if (existing >= 0) registry.splice(existing, 1);
  registry.push(section);
}

/**
 * Return registered sections, optionally filtered by placement.
 *
 * Sort is stable within a placement: ascending ``order`` (default 100),
 * then insertion order. The host renders the ``'top'`` slot above the
 * Account Information card and the ``'bottom'`` slot below the
 * Change Password card.
 */
export function getProfileSections(
  placement?: ProfileSectionPlacement,
): ProfileSection[] {
  const filtered =
    placement === undefined
      ? [...registry]
      : registry.filter(
          (section) => (section.placement ?? 'bottom') === placement,
        );
  return filtered.sort(
    (left, right) => (left.order ?? 100) - (right.order ?? 100),
  );
}

/** Test helper — wipes the registry between specs. */
export function _resetProfileSections(): void {
  registry.length = 0;
}
