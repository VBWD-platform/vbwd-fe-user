import { describe, it, expect, beforeEach } from 'vitest'
import { PlatformSDK } from 'vbwd-view-component'
import { paypalPaymentPlugin } from '../../../../plugins/paypal-payment'

describe('PayPal Payment Plugin', () => {
  let sdk: PlatformSDK

  beforeEach(() => {
    sdk = new PlatformSDK()
  })

  it('should have correct plugin name', () => {
    expect(paypalPaymentPlugin.name).toBe('paypal-payment')
  })

  it('should have correct version', () => {
    expect(paypalPaymentPlugin.version).toBe('26.6.1')
  })

  it('should register three routes on install', async () => {
    paypalPaymentPlugin.install!(sdk)
    const routes = sdk.getRoutes()
    expect(routes).toHaveLength(3)
  })

  it('should register correct route paths', async () => {
    paypalPaymentPlugin.install!(sdk)
    const routes = sdk.getRoutes()
    const paths = routes.map(r => r.path)
    expect(paths).toContain('/pay/paypal')
    expect(paths).toContain('/pay/paypal/success')
    expect(paths).toContain('/pay/paypal/cancel')
  })

  it('should mark all routes as requiring auth', async () => {
    paypalPaymentPlugin.install!(sdk)
    const routes = sdk.getRoutes()
    for (const route of routes) {
      expect(route.meta?.requiresAuth).toBe(true)
    }
  })

  it('should toggle _active on activate/deactivate', () => {
    expect(paypalPaymentPlugin._active).toBe(false)
    paypalPaymentPlugin.activate!()
    expect(paypalPaymentPlugin._active).toBe(true)
    paypalPaymentPlugin.deactivate!()
    expect(paypalPaymentPlugin._active).toBe(false)
  })
})
