import { describe, it, expect } from 'vitest'
import {
  isPurchaseBlocked,
  requiresAgeGate,
  effectiveAgeRestriction,
  effectiveMaxQuantity,
  clampQuantity,
  type GateProfile,
  type GateRegion,
} from '../../shop-pharma/gates'

const region: GateRegion = {
  default_age_restriction_years: 0,
  default_max_quantity_per_order: 5,
}

function profile(overrides: Partial<GateProfile> = {}): GateProfile {
  return {
    product_class: 'OTC',
    age_restriction_years: null,
    max_quantity_per_order: null,
    professional_only: false,
    ...overrides,
  }
}

describe('pharma purchase gates', () => {
  it('blocks RX from direct online purchase', () => {
    expect(isPurchaseBlocked('RX')).toBe(true)
  })

  it('does not block OTC / devices / FMCG', () => {
    expect(isPurchaseBlocked('OTC')).toBe(false)
    expect(isPurchaseBlocked('MEDICAL_DEVICE')).toBe(false)
    expect(isPurchaseBlocked('FMCG_PERSONAL')).toBe(false)
    expect(isPurchaseBlocked('FMCG_HOSPITAL')).toBe(false)
  })

  it('requires an age gate only when an age restriction applies', () => {
    expect(requiresAgeGate(profile({ age_restriction_years: 18 }), region)).toBe(true)
    expect(requiresAgeGate(profile({ age_restriction_years: null }), region)).toBe(false)
  })

  it('falls back to the region default age restriction', () => {
    const ageRegion: GateRegion = { ...region, default_age_restriction_years: 16 }
    expect(effectiveAgeRestriction(profile({ age_restriction_years: null }), ageRegion)).toBe(16)
    expect(requiresAgeGate(profile({ age_restriction_years: null }), ageRegion)).toBe(true)
  })

  it('prefers the per-product age restriction over the region default', () => {
    const ageRegion: GateRegion = { ...region, default_age_restriction_years: 16 }
    expect(effectiveAgeRestriction(profile({ age_restriction_years: 18 }), ageRegion)).toBe(18)
  })

  it('resolves the effective max quantity from product then region', () => {
    expect(effectiveMaxQuantity(profile({ max_quantity_per_order: 3 }), region)).toBe(3)
    expect(effectiveMaxQuantity(profile({ max_quantity_per_order: null }), region)).toBe(5)
  })

  it('returns null max quantity when neither product nor region caps it', () => {
    const noCap: GateRegion = { ...region, default_max_quantity_per_order: null }
    expect(effectiveMaxQuantity(profile({ max_quantity_per_order: null }), noCap)).toBeNull()
  })

  it('clamps a requested quantity to the effective cap', () => {
    expect(clampQuantity(10, profile({ max_quantity_per_order: 3 }), region)).toBe(3)
    expect(clampQuantity(2, profile({ max_quantity_per_order: 3 }), region)).toBe(2)
  })

  it('floors quantity at 1 and to an integer', () => {
    expect(clampQuantity(0, profile(), region)).toBe(1)
    expect(clampQuantity(2.9, profile({ max_quantity_per_order: 10 }), region)).toBe(2)
  })

  it('passes the requested quantity through when uncapped (floored at 1)', () => {
    const noCap: GateRegion = { ...region, default_max_quantity_per_order: null }
    expect(clampQuantity(99, profile({ max_quantity_per_order: null }), noCap)).toBe(99)
  })
})
