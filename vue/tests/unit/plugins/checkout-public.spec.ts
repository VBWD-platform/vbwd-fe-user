import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { PluginRegistry, PlatformSDK } from 'vbwd-view-component'
import type { IPlugin } from 'vbwd-view-component'
import { checkoutPlugin } from '../../../../plugins/checkout'
import PublicCheckoutView from '../../../../plugins/checkout/PublicCheckoutView.vue'
import { api } from '../../../src/api'

vi.mock('../../../src/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    setToken: vi.fn(),
    clearToken: vi.fn()
  },
  initializeApi: vi.fn(),
  clearApiAuth: vi.fn(),
  isAuthenticated: vi.fn(() => false)
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mockPush = vi.fn()
let mockQuery: Record<string, string> = {}

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ params: {}, query: mockQuery })
}))

// Stub child components to avoid deep rendering
vi.mock('../../../src/components/checkout/EmailBlock.vue', () => ({
  default: { template: '<div data-testid="email-block">EmailBlock</div>', props: ['initialEmail', 'isAuthenticated'] }
}))
vi.mock('../../../src/components/checkout/BillingAddressBlock.vue', () => ({
  default: { template: '<div data-testid="billing-block">BillingAddressBlock</div>', props: ['readonly'] }
}))
vi.mock('../../../src/components/checkout/PaymentMethodsBlock.vue', () => ({
  default: { template: '<div data-testid="payment-block">PaymentMethodsBlock</div>' }
}))
vi.mock('../../../src/components/checkout/TermsCheckbox.vue', () => ({
  default: { template: '<div data-testid="terms-block">TermsCheckbox</div>' }
}))

// Stub composables used by EmailBlock (in case stubs leak)
vi.mock('../../../src/composables/useEmailCheck', () => ({
  useEmailCheck: () => ({
    email: { value: '' },
    state: { value: 'idle' },
    isChecking: { value: false },
    isNewUser: { value: false },
    isExistingUser: { value: false },
    checkEmail: vi.fn(),
    reset: vi.fn()
  })
}))
vi.mock('../../../src/composables/useAnalytics', () => ({
  useAnalytics: () => ({ track: vi.fn() })
}))
vi.mock('../../../src/utils/debounce', () => ({
  debounce: (fn: (...args: unknown[]) => unknown) => fn
}))

const RouterLinkStub = {
  template: '<a><slot /></a>',
  props: ['to']
}

describe('Checkout Public Plugin', () => {
  let registry: PluginRegistry
  let sdk: PlatformSDK

  beforeEach(() => {
    registry = new PluginRegistry()
    sdk = new PlatformSDK()
  })

  it('should register correctly', () => {
    registry.register(checkoutPlugin)
    const plugin = registry.get('checkout')
    expect(plugin).toBeDefined()
    expect(plugin!.name).toBe('checkout')
    expect(plugin!.version).toBe('1.0.0')
  })

  it('should install route /checkout with requiresAuth: false', async () => {
    registry.register(checkoutPlugin)
    await registry.installAll(sdk)

    const routes = sdk.getRoutes()
    expect(routes).toHaveLength(1)
    expect(routes[0].path).toBe('/checkout')
    expect(routes[0].name).toBe('checkout-public')
    expect(routes[0].meta).toEqual({ requiresAuth: false, noLayout: true })
  })

  it('should have activate method', () => {
    expect(typeof checkoutPlugin.activate).toBe('function')
  })

  it('should have deactivate method', () => {
    expect(typeof checkoutPlugin.deactivate).toBe('function')
  })

  it('should set _active to true on activate', () => {
    const plugin = checkoutPlugin as IPlugin & { _active: boolean }
    plugin._active = false
    plugin.activate!()
    expect(plugin._active).toBe(true)
  })

  it('should set _active to false on deactivate', () => {
    const plugin = checkoutPlugin as IPlugin & { _active: boolean }
    plugin._active = true
    plugin.deactivate!()
    expect(plugin._active).toBe(false)
  })
})

describe('PublicCheckoutView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockQuery = {}
  })

  function mountView() {
    return mount(PublicCheckoutView, {
      global: {
        plugins: [createPinia()],
        stubs: { 'router-link': RouterLinkStub },
        mocks: { $t: (key: string) => key }
      }
    })
  }

  it('should show no-plan state when tarif_plan_id is missing', () => {
    mockQuery = {}
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="checkout-no-plan"]').exists()).toBe(true)
  })

  it('should read tarif_plan_id from query params', async () => {
    mockQuery = { tarif_plan_id: 'pro' }
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/tarif-plans/pro') {
        return Promise.resolve({
          plan: { id: '1', name: 'Pro', slug: 'pro', price: 29.99, currency: 'USD', billing_period: 'monthly' }
        })
      }
      return Promise.resolve({})
    })

    mountView()
    await flushPromises()

    expect(api.get).toHaveBeenCalledWith('/tarif-plans/pro')
  })

  it('should render plan details after fetch', async () => {
    mockQuery = { tarif_plan_id: 'pro' }
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/tarif-plans/pro') {
        return Promise.resolve({
          plan: { id: '1', name: 'Pro Plan', slug: 'pro', price: 29.99, currency: 'USD', billing_period: 'monthly' }
        })
      }
      return Promise.resolve({})
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="order-summary"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="plan-name"]').text()).toContain('Pro Plan')
  })

  it('should show all form blocks', async () => {
    mockQuery = { tarif_plan_id: 'basic' }
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/tarif-plans/basic') {
        return Promise.resolve({
          plan: { id: '1', name: 'Basic', slug: 'basic', price: 9.99, currency: 'USD', billing_period: 'monthly' }
        })
      }
      return Promise.resolve({})
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="email-block"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="billing-block"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="payment-block"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="terms-block"]').exists()).toBe(true)
  })

  it('should show error when plan load fails', async () => {
    mockQuery = { tarif_plan_id: 'nonexistent' }
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/tarif-plans/nonexistent') {
        return Promise.reject(new Error('Plan not found'))
      }
      return Promise.resolve({})
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="checkout-error"]').exists()).toBe(true)
  })
})
