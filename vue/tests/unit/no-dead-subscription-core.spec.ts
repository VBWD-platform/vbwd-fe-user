/**
 * Agnosticism fence (Sprint 02, Phase 0).
 *
 * The subscription experience is owned by `plugins/subscription/`. The
 * pre-extraction duplicate views/stores in fe-user core were deleted; these
 * assertions keep them gone and keep the core barrel free of subscription
 * exports.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const SRC = resolve(__dirname, '../../src')

const DEAD_VIEWS = [
  'views/Plans.vue',
  'views/Subscription.vue',
  'views/AddOns.vue',
  'views/AddonDetail.vue',
  'views/AddonInfoView.vue',
  'views/Checkout.vue',
  'views/PlanDetailView.vue',
  'views/TarifPlanDetail.vue',
]
// stores/checkout.ts and components/checkout/* are intentionally NOT here:
// they are live, generic checkout building blocks shared via the core
// @/stores/checkout / @/components/checkout aliases by plugins/checkout,
// plugins/booking and plugins/subscription. Decoupling the subscription
// usage is Phase 1 — they are not Phase 0 dead duplicates.
const DEAD_STORES = ['stores/subscription.ts', 'stores/plans.ts']
const DEAD_COMPONENTS: string[] = []

describe('fe-user core — no dead subscription duplicates', () => {
  it.each([...DEAD_VIEWS, ...DEAD_STORES, ...DEAD_COMPONENTS])(
    'core file %s no longer exists (owned by the plugin)',
    (relPath) => {
      expect(existsSync(resolve(SRC, relPath))).toBe(false)
    },
  )

  it('store barrel exports no subscription/plans store', () => {
    const barrel = readFileSync(resolve(SRC, 'stores/index.ts'), 'utf8')
    expect(barrel).not.toMatch(/useSubscriptionStore|usePlansStore/)
    expect(barrel).not.toMatch(/from '\.\/(subscription|plans)'/)
  })

  it('router registers none of the deleted subscription views', () => {
    const router = readFileSync(resolve(SRC, 'router/index.ts'), 'utf8')
    for (const view of DEAD_VIEWS) {
      const name = view.replace('views/', '').replace('.vue', '')
      expect(router).not.toMatch(new RegExp(`views/${name}\\.vue`))
    }
  })
})
