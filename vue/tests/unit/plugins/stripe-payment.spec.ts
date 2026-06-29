import { describe, it, expect, beforeEach } from 'vitest'
import { PlatformSDK } from 'vbwd-view-component'
import { stripePaymentPlugin } from '../../../../plugins/stripe-payment'

describe('Stripe Payment Plugin', () => {
  let sdk: PlatformSDK

  beforeEach(() => {
    sdk = new PlatformSDK()
  })

  it('should have correct plugin name', () => {
    expect(stripePaymentPlugin.name).toBe('stripe-payment')
  })

  it('should have correct version', () => {
    expect(stripePaymentPlugin.version).toBe('26.6.1')
  })

  it('should register three routes on install', async () => {
    stripePaymentPlugin.install!(sdk)
    const routes = sdk.getRoutes()
    expect(routes).toHaveLength(3)
  })

  it('should register correct route paths', async () => {
    stripePaymentPlugin.install!(sdk)
    const routes = sdk.getRoutes()
    const paths = routes.map(r => r.path)
    expect(paths).toContain('/pay/stripe')
    expect(paths).toContain('/pay/stripe/success')
    expect(paths).toContain('/pay/stripe/cancel')
  })

  it('should mark all routes as requiring auth', async () => {
    stripePaymentPlugin.install!(sdk)
    const routes = sdk.getRoutes()
    for (const route of routes) {
      expect(route.meta?.requiresAuth).toBe(true)
    }
  })

  it('should toggle _active on activate/deactivate', () => {
    expect(stripePaymentPlugin._active).toBe(false)
    stripePaymentPlugin.activate!()
    expect(stripePaymentPlugin._active).toBe(true)
    stripePaymentPlugin.deactivate!()
    expect(stripePaymentPlugin._active).toBe(false)
  })
})
