/**
 * Class-aware purchase gates (UX layer only).
 *
 * The backend pharma plugin is the authoritative gate — it rejects RX lines,
 * over-quantity lines and age-restricted lines at add-to-cart / checkout. These
 * helpers mirror that policy in the storefront so the buyer sees the reason
 * before submitting; they never replace the server check.
 *
 * The five product classes map to gating behaviour:
 *   RX            -> blocked from direct online purchase ("prescription required")
 *   OTC           -> sold with an age gate + per-order max-quantity guard
 *   MEDICAL_DEVICE-> sold with regulatory (CE/UKCA) info, no purchase block
 *   FMCG_PERSONAL -> sold freely
 *   FMCG_HOSPITAL -> sold (optionally professional-only, operator flag)
 */

export type ProductClass =
  | 'RX'
  | 'OTC'
  | 'MEDICAL_DEVICE'
  | 'FMCG_PERSONAL'
  | 'FMCG_HOSPITAL';

/** The subset of the pharma profile the gates need. */
export interface GateProfile {
  product_class: ProductClass | string | null;
  age_restriction_years: number | null;
  max_quantity_per_order: number | null;
  professional_only: boolean | null;
}

/** The subset of the active region the gates need. */
export interface GateRegion {
  default_age_restriction_years: number | null;
  default_max_quantity_per_order: number | null;
}

/**
 * Whether the class is blocked from direct online purchase. Only RX is blocked
 * by default (prescription required; e-prescription dispensing is deferred).
 */
export function isPurchaseBlocked(productClass: ProductClass | string | null): boolean {
  return productClass === 'RX';
}

/** Whether an OTC age gate applies (age restriction > 0 after region default). */
export function requiresAgeGate(profile: GateProfile, region: GateRegion): boolean {
  return effectiveAgeRestriction(profile, region) > 0;
}

/** Per-product age restriction, falling back to the region default. */
export function effectiveAgeRestriction(profile: GateProfile, region: GateRegion): number {
  const productValue = profile.age_restriction_years;
  if (productValue !== null && productValue !== undefined) {
    return productValue;
  }
  return region.default_age_restriction_years ?? 0;
}

/**
 * The effective per-order maximum quantity, falling back to the region default.
 * Returns ``null`` when neither the product nor the region caps quantity.
 */
export function effectiveMaxQuantity(profile: GateProfile, region: GateRegion): number | null {
  const productValue = profile.max_quantity_per_order;
  if (productValue !== null && productValue !== undefined) {
    return productValue;
  }
  const regionValue = region.default_max_quantity_per_order;
  return regionValue !== null && regionValue !== undefined ? regionValue : null;
}

/**
 * Clamp a requested quantity to the effective per-order cap (min 1). With no
 * cap the requested quantity passes through unchanged (still floored at 1).
 */
export function clampQuantity(
  requested: number,
  profile: GateProfile,
  region: GateRegion,
): number {
  const floored = Math.max(1, Math.floor(requested));
  const cap = effectiveMaxQuantity(profile, region);
  if (cap === null) {
    return floored;
  }
  return Math.min(floored, cap);
}
