import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { PluginRegistry, PlatformSDK } from 'vbwd-view-component'
import type { IPlugin } from 'vbwd-view-component'
import { landing1Plugin } from '../../../../plugins/landing1'
import Landing1View from '../../../../plugins/landing1/Landing1View.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ params: {}, query: {} })
}))

const RouterLinkStub = {
  template: '<a><slot /></a>',
  props: ['to']
}

describe('Landing1 Plugin', () => {
  let registry: PluginRegistry
  let sdk: PlatformSDK

  beforeEach(() => {
    registry = new PluginRegistry()
    sdk = new PlatformSDK()
    vi.clearAllMocks()
  })

  it('should register correctly', () => {
    registry.register(landing1Plugin)
    const plugin = registry.get('landing1')
    expect(plugin).toBeDefined()
    expect(plugin!.name).toBe('landing1')
    expect(plugin!.version).toBe('26.6.1')
  })

  it('should install route /landing1 with requiresAuth: false', async () => {
    registry.register(landing1Plugin)
    await registry.installAll(sdk)

    const routes = sdk.getRoutes()
    const landing1Route = routes.find(r => r.path === '/landing1')
    expect(landing1Route).toBeDefined()
    expect(landing1Route!.name).toBe('landing1')
    expect(landing1Route!.meta).toEqual({ requiresAuth: false, cmsLayout: true })
  })

  it('should have activate method', () => {
    expect(typeof landing1Plugin.activate).toBe('function')
  })

  it('should have deactivate method', () => {
    expect(typeof landing1Plugin.deactivate).toBe('function')
  })

  it('should set _active to true on activate', () => {
    const plugin = landing1Plugin as IPlugin & { _active: boolean }
    plugin._active = false
    plugin.activate!()
    expect(plugin._active).toBe(true)
  })

  it('should set _active to false on deactivate', () => {
    const plugin = landing1Plugin as IPlugin & { _active: boolean }
    plugin._active = true
    plugin.deactivate!()
    expect(plugin._active).toBe(false)
  })
})

describe('Landing1View', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Reset fetch mock
    vi.restoreAllMocks()
  })

  function mountView() {
    return mount(Landing1View, {
      global: {
        plugins: [createPinia()],
        stubs: { 'router-link': RouterLinkStub },
        mocks: { $t: (key: string) => key }
      }
    })
  }

  it('should render loading state initially', async () => {
    // Mock fetch to hang indefinitely
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
    const wrapper = mountView()
    // onMounted sets loading = true synchronously, then awaits fetch
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="landing1-loading"]').exists()).toBe(true)
  })

  it('should render plan cards after fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        plans: [
          { id: '1', name: 'Basic', slug: 'basic', display_price: 9.99, display_currency: 'USD', billing_period: 'monthly', is_active: true },
          { id: '2', name: 'Pro', slug: 'pro', display_price: 29.99, display_currency: 'USD', billing_period: 'monthly', is_active: true },
        ]
      })
    } as Response)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="landing1-plans"]').exists()).toBe(true)
    expect(wrapper.findAll('.plan-card')).toHaveLength(2)
    expect(wrapper.find('[data-testid="plan-card-basic"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="plan-card-pro"]').exists()).toBe(true)
  })

  it('should show empty state when no plans', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ plans: [] })
    } as Response)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="landing1-empty"]').exists()).toBe(true)
  })

  it('should show error state on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({})
    } as Response)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="landing1-error"]').exists()).toBe(true)
  })

  it('should navigate to /checkout on "Choose Plan" click', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        plans: [
          { id: '1', name: 'Basic', slug: 'basic', display_price: 9.99, display_currency: 'USD', billing_period: 'monthly', is_active: true },
        ]
      })
    } as Response)

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-testid="choose-plan-basic"]').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({
      path: '/checkout',
      query: { tarif_plan_id: 'basic' }
    })
  })

  it('should filter out inactive plans', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        plans: [
          { id: '1', name: 'Basic', slug: 'basic', display_price: 9.99, display_currency: 'USD', billing_period: 'monthly', is_active: true },
          { id: '2', name: 'Legacy', slug: 'legacy', display_price: 4.99, display_currency: 'USD', billing_period: 'monthly', is_active: false },
        ]
      })
    } as Response)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('.plan-card')).toHaveLength(1)
    expect(wrapper.find('[data-testid="plan-card-basic"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="plan-card-legacy"]').exists()).toBe(false)
  })
})
