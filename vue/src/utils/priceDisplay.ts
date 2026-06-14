/**
 * Netto/brutto price-display resolution (S72.4).
 *
 * The single source of truth that every entity price renderer reuses to pick
 * the displayed number and decide whether the "netto price" tag applies.
 *
 * The FE does NOT recompute the effective mode — the pricing payload already
 * carries ``effective_display_mode`` (= per-entity ``price_display_mode``
 * override ?? global ``prices_display_mode``, computed by the backend). This
 * helper only:
 *   - picks net vs gross from that effective mode, and
 *   - decides the tag from the effective mode together with the global mode
 *     (the tag needs the global because ``effective === "netto"`` alone cannot
 *     distinguish "global netto, no tag" from "item override under a brutto
 *     global, tag").
 *
 * Locked decision D-tag: show ``net_amount`` for ``netto``, ``gross_amount``
 * for ``brutto``; render the "netto price" tag only when the effective mode is
 * ``netto`` AND the global mode is ``brutto`` (the item differs from a brutto
 * global). When the global itself is netto, everything shows net with no tag.
 */

export type PriceDisplayMode = 'netto' | 'brutto';

/** One applied tax line from the computed Price VO (S85): code, name, %, amount. */
export interface PriceTaxVO {
  code: string;
  name?: string;
  rate: number;
  amount: number;
}

/**
 * The computed Price value object (S85) as exposed on sellable / invoice
 * payloads: net + per-tax breakdown + gross, in one currency. The fe never
 * recomputes any of these — it only chooses a side and formats.
 */
export interface PriceVO {
  netto: number;
  taxes: PriceTaxVO[];
  brutto: number;
  currency: string;
}

/** Viewer billing-identity type (S74), surfaced via the fe auth store. */
export type ViewerAccountType = 'private' | 'business';

/** Brutto (tax-included) is the platform default when no mode is known. */
const DEFAULT_DISPLAY_MODE: PriceDisplayMode = 'brutto';

export interface DisplaySideInput {
  /** The entity's per-item ``price_display_mode`` override (if any). */
  itemMode?: PriceDisplayMode | null;
  /** The global ``prices_display_mode`` core setting. */
  globalMode?: PriceDisplayMode | null;
  /**
   * The authenticated viewer's ``account_type`` (S74). ``business`` forces
   * netto (B2B norm); anonymous viewers omit this entirely.
   */
  accountType?: ViewerAccountType | null;
}

/**
 * Resolve which side of the price (netto vs brutto) the UI shows, per the
 * D9 strict precedence (display concern only — never touches stored prices,
 * the Price VO, or the charged brutto):
 *
 *   1. authenticated ``business`` viewer ⇒ netto — strongest, B2B norm, wins
 *      even over a per-item ``brutto`` override;
 *   2. else the per-item ``price_display_mode`` override (``netto``\|``brutto``);
 *   3. else the global ``prices_display_mode`` (default ``brutto``).
 *
 * Anonymous / ``private`` viewers therefore fall through to ``item ?? global``.
 */
export function resolveDisplaySide(input: DisplaySideInput): PriceDisplayMode {
  if (input.accountType === 'business') {
    return 'netto';
  }
  return input.itemMode || input.globalMode || DEFAULT_DISPLAY_MODE;
}

export interface PriceDisplayInput {
  /**
   * The entity's effective display mode from the pricing payload
   * (``override ?? global``). ``undefined`` falls back to the global mode.
   */
  effectiveDisplayMode?: PriceDisplayMode | null;
  /** The global ``prices_display_mode`` core setting. */
  globalMode?: PriceDisplayMode | null;
  /** Net (tax-excluded) amount from the pricing payload. */
  netAmount: number;
  /** Gross (tax-included) amount from the pricing payload. */
  grossAmount: number;
  /**
   * The authenticated viewer's ``account_type`` (S74). When ``business`` the
   * D9 overlay forces the netto side regardless of the effective mode.
   */
  accountType?: ViewerAccountType | null;
}

export interface ResolvedPriceDisplay {
  /** The amount to render (net for netto, gross for brutto). */
  amount: number;
  /** Whether to render the localized "netto price" tag next to the amount. */
  showNettoTag: boolean;
}

export function resolvePriceDisplay(input: PriceDisplayInput): ResolvedPriceDisplay {
  // The pricing payload already merges the per-item override into
  // ``effectiveDisplayMode`` (= override ?? global). Feed that as ``itemMode``
  // so the single ``resolveDisplaySide`` precedence (incl. the business
  // overlay) decides the side.
  const side = resolveDisplaySide({
    itemMode: input.effectiveDisplayMode,
    globalMode: input.globalMode,
    accountType: input.accountType,
  });

  const amount = side === 'netto' ? input.netAmount : input.grossAmount;
  // The "netto price" tag flags a net amount shown under a brutto global — so
  // either an explicit netto override or the business overlay against a brutto
  // global both warrant the tag.
  const showNettoTag = side === 'netto' && input.globalMode === 'brutto';

  return { amount, showNettoTag };
}
