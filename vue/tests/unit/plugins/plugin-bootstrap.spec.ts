import { describe, it, expect, beforeEach } from 'vitest'
import { PluginRegistry, PlatformSDK, PluginStatus } from 'vbwd-view-component'
import type { IPlugin, IPlatformSDK } from 'vbwd-view-component'

function createTestPlugin(overrides: Partial<IPlugin> = {}): IPlugin {
  return {
    name: 'user-test-plugin',
    version: '1.0.0',
    install(sdk: IPlatformSDK) {
      sdk.addComponent('TestWidget', () => Promise.resolve({ default: {} }) as Promise<{ default: unknown }>)
    },
    activate() {},
    deactivate() {},
    ...overrides
  }
}

describe('User App Plugin Bootstrap', () => {
  let registry: PluginRegistry
  let sdk: PlatformSDK

  beforeEach(() => {
    registry = new PluginRegistry()
    sdk = new PlatformSDK()
  })

  // --- Core Bootstrap ---

  it('should instantiate registry and SDK', () => {
    expect(registry).toBeInstanceOf(PluginRegistry)
    expect(sdk).toBeInstanceOf(PlatformSDK)
    expect(sdk.api).toBeDefined()
    expect(sdk.events).toBeDefined()
  })

  it('should register a plugin in user context', () => {
    const plugin = createTestPlugin()
    registry.register(plugin)

    const registered = registry.get('user-test-plugin')
    expect(registered).toBeDefined()
    expect(registered!.name).toBe('user-test-plugin')
    expect(registered!.status).toBe(PluginStatus.REGISTERED)
  })

  it('should register component in SDK during install', async () => {
    const plugin = createTestPlugin()
    registry.register(plugin)
    await registry.installAll(sdk)

    const components = sdk.getComponents()
    expect(components).toHaveProperty('TestWidget')
    expect(typeof components['TestWidget']).toBe('function')
  })

  it('should register route in SDK during install', async () => {
    const plugin = createTestPlugin({
      name: 'route-plugin',
      install(sdk: IPlatformSDK) {
        sdk.addRoute({
          path: '/user-plugin',
          name: 'UserPlugin',
          component: () => Promise.resolve({ default: {} }) as Promise<{ default: unknown }>
        })
      }
    })

    registry.register(plugin)
    await registry.installAll(sdk)

    const routes = sdk.getRoutes()
    expect(routes).toHaveLength(1)
    expect(routes[0].path).toBe('/user-plugin')
  })

  it('should create store in SDK during install', async () => {
    const plugin = createTestPlugin({
      name: 'store-plugin',
      install(sdk: IPlatformSDK) {
        sdk.createStore('userPluginStore', {
          state: () => ({ count: 0 }),
          actions: { increment() { (this as Record<string, unknown>).count = ((this as Record<string, unknown>).count as number) + 1 } }
        })
      }
    })

    registry.register(plugin)
    await registry.installAll(sdk)

    expect(sdk.getStores()).toHaveProperty('userPluginStore')
  })

  it('should complete full lifecycle: register → install → activate → deactivate', async () => {
    const plugin = createTestPlugin()
    registry.register(plugin)
    expect(registry.get('user-test-plugin')!.status).toBe(PluginStatus.REGISTERED)

    await registry.installAll(sdk)
    expect(registry.get('user-test-plugin')!.status).toBe(PluginStatus.INSTALLED)

    await registry.activate('user-test-plugin')
    expect(registry.get('user-test-plugin')!.status).toBe(PluginStatus.ACTIVE)

    await registry.deactivate('user-test-plugin')
    expect(registry.get('user-test-plugin')!.status).toBe(PluginStatus.INACTIVE)
  })

  // --- User-Specific Scenarios ---

  it('should install multiple plugins in dependency order', async () => {
    const installed: string[] = []

    const pluginB: IPlugin = {
      name: 'dep-plugin',
      version: '1.0.0',
      install() { installed.push('dep') }
    }

    const pluginA: IPlugin = {
      name: 'main-plugin',
      version: '1.0.0',
      dependencies: ['dep-plugin'],
      install() { installed.push('main') }
    }

    registry.register(pluginA)
    registry.register(pluginB)
    await registry.installAll(sdk)

    expect(installed).toEqual(['dep', 'main'])
  })

  it('should install plugin with no hooks successfully', async () => {
    const minimalPlugin: IPlugin = {
      name: 'minimal',
      version: '1.0.0'
    }

    registry.register(minimalPlugin)
    await registry.installAll(sdk)
    await registry.activate('minimal')

    expect(registry.get('minimal')!.status).toBe(PluginStatus.ACTIVE)
  })

  it('should handle installAll with empty registry', async () => {
    await registry.installAll(sdk)

    expect(sdk.getRoutes()).toHaveLength(0)
    expect(Object.keys(sdk.getComponents())).toHaveLength(0)
    expect(Object.keys(sdk.getStores())).toHaveLength(0)
  })

  // --- Conditional Registration from plugins.json ---

  it('should only register and install enabled plugins', async () => {
    const pluginA = createTestPlugin({
      name: 'enabled-plugin',
      install(sdk: IPlatformSDK) {
        sdk.addRoute({ path: '/enabled', name: 'Enabled', component: () => Promise.resolve({ default: {} }) as Promise<{ default: unknown }> })
      }
    })
    const pluginB = createTestPlugin({
      name: 'disabled-plugin',
      install(sdk: IPlatformSDK) {
        sdk.addRoute({ path: '/disabled', name: 'Disabled', component: () => Promise.resolve({ default: {} }) as Promise<{ default: unknown }> })
      }
    })

    const availablePlugins: Record<string, IPlugin> = {
      'enabled-plugin': pluginA,
      'disabled-plugin': pluginB
    }

    // Simulate runtime registry fetch: only enabled-plugin is enabled
    const pluginRegistry: Record<string, { enabled: boolean }> = {
      'enabled-plugin': { enabled: true },
      'disabled-plugin': { enabled: false }
    }

    // Only register enabled plugins (matches new main.ts flow)
    for (const [name, entry] of Object.entries(pluginRegistry)) {
      if (entry.enabled && availablePlugins[name]) {
        registry.register(availablePlugins[name])
      }
    }

    await registry.installAll(sdk)

    // Only enabled plugin's route should be registered
    const routes = sdk.getRoutes()
    expect(routes).toHaveLength(1)
    expect(routes[0].path).toBe('/enabled')

    // Disabled plugin should not be in registry at all
    expect(registry.get('enabled-plugin')).toBeDefined()
    expect(registry.get('disabled-plugin')).toBeUndefined()
  })

  it('should not register any routes when all plugins are disabled', async () => {
    const plugin = createTestPlugin({
      name: 'all-disabled',
      install(sdk: IPlatformSDK) {
        sdk.addRoute({ path: '/disabled-route', name: 'DisabledRoute', component: () => Promise.resolve({ default: {} }) as Promise<{ default: unknown }> })
      }
    })

    const availablePlugins: Record<string, IPlugin> = { 'all-disabled': plugin }
    const pluginRegistry: Record<string, { enabled: boolean }> = {
      'all-disabled': { enabled: false }
    }

    for (const [name, entry] of Object.entries(pluginRegistry)) {
      if (entry.enabled && availablePlugins[name]) {
        registry.register(availablePlugins[name])
      }
    }

    await registry.installAll(sdk)

    expect(sdk.getRoutes()).toHaveLength(0)
    expect(registry.get('all-disabled')).toBeUndefined()
  })

  it('should not register routes for uninstalled plugins', async () => {
    const plugin = createTestPlugin({
      name: 'uninstalled-plugin',
      install(sdk: IPlatformSDK) {
        sdk.addRoute({ path: '/uninstalled', name: 'Uninstalled', component: () => Promise.resolve({ default: {} }) as Promise<{ default: unknown }> })
      }
    })

    const availablePlugins: Record<string, IPlugin> = { 'uninstalled-plugin': plugin }

    // Plugin not in registry at all (uninstalled)
    const pluginRegistry: Record<string, { enabled: boolean }> = {}

    for (const [name, entry] of Object.entries(pluginRegistry)) {
      if (entry.enabled && availablePlugins[name]) {
        registry.register(availablePlugins[name])
      }
    }

    await registry.installAll(sdk)

    expect(sdk.getRoutes()).toHaveLength(0)
  })

  // --- CMS / GHRM plugin dependency chain ---

  it('should install landing1 and checkout before cms, cms before ghrm (correct topo order)', async () => {
    const installed: string[] = []

    // Mirror the real plugin dependency declarations
    const landing1: IPlugin = { name: 'landing1', version: '1.0.0', install() { installed.push('landing1') } }
    const checkout: IPlugin = { name: 'checkout', version: '1.0.0', install() { installed.push('checkout') } }
    const cms: IPlugin = { name: 'cms', version: '1.0.0', dependencies: ['landing1'], install() { installed.push('cms') } }
    const ghrm: IPlugin = { name: 'ghrm', version: '1.0.0', dependencies: ['cms', 'checkout'], install() { installed.push('ghrm') } }

    // Register in reverse order to prove topological sort, not insertion order, governs
    registry.register(ghrm)
    registry.register(cms)
    registry.register(checkout)
    registry.register(landing1)
    await registry.installAll(sdk)

    expect(installed.indexOf('landing1')).toBeLessThan(installed.indexOf('cms'))
    expect(installed.indexOf('checkout')).toBeLessThan(installed.indexOf('ghrm'))
    expect(installed.indexOf('cms')).toBeLessThan(installed.indexOf('ghrm'))
    expect(installed).toContain('ghrm')
  })

  it('should throw when deactivating landing1 while cms is active', async () => {
    const landing1: IPlugin = { name: 'landing1', version: '1.0.0' }
    const cms: IPlugin = { name: 'cms', version: '1.0.0', dependencies: ['landing1'] }

    registry.register(landing1)
    registry.register(cms)
    await registry.installAll(sdk)
    await registry.activate('landing1')
    await registry.activate('cms')

    await expect(registry.deactivate('landing1')).rejects.toThrow('active dependents: cms')
  })

  it('should throw when deactivating cms while ghrm is active', async () => {
    const landing1: IPlugin = { name: 'landing1', version: '1.0.0' }
    const checkout: IPlugin = { name: 'checkout', version: '1.0.0' }
    const cms: IPlugin = { name: 'cms', version: '1.0.0', dependencies: ['landing1'] }
    const ghrm: IPlugin = { name: 'ghrm', version: '1.0.0', dependencies: ['cms', 'checkout'] }

    registry.register(landing1)
    registry.register(checkout)
    registry.register(cms)
    registry.register(ghrm)
    await registry.installAll(sdk)
    await registry.activate('cms')
    await registry.activate('ghrm')

    await expect(registry.deactivate('cms')).rejects.toThrow('active dependents: ghrm')
  })

  it('should throw when installing ghrm without cms registered', async () => {
    // Only checkout registered — cms missing
    const checkout: IPlugin = { name: 'checkout', version: '1.0.0' }
    const ghrm: IPlugin = { name: 'ghrm', version: '1.0.0', dependencies: ['cms', 'checkout'] }

    registry.register(checkout)
    registry.register(ghrm)

    await expect(registry.installAll(sdk)).rejects.toThrow('Dependency "cms" not found')
  })

  it('should allow deactivating landing1 after cms is deactivated first', async () => {
    const landing1: IPlugin = { name: 'landing1', version: '1.0.0' }
    const cms: IPlugin = { name: 'cms', version: '1.0.0', dependencies: ['landing1'] }

    registry.register(landing1)
    registry.register(cms)
    await registry.installAll(sdk)
    await registry.activate('landing1')
    await registry.activate('cms')

    await registry.deactivate('cms')
    await registry.deactivate('landing1') // now safe

    expect(registry.get('landing1')!.status).toBe(PluginStatus.INACTIVE)
  })

  // --- Isolation from Admin ---

  it('should keep separate registry instances independent', () => {
    const registryA = new PluginRegistry()
    const registryB = new PluginRegistry()

    registryA.register(createTestPlugin({ name: 'plugin-a' }))
    registryB.register(createTestPlugin({ name: 'plugin-b' }))

    expect(registryA.get('plugin-a')).toBeDefined()
    expect(registryA.get('plugin-b')).toBeUndefined()
    expect(registryB.get('plugin-b')).toBeDefined()
    expect(registryB.get('plugin-a')).toBeUndefined()
  })

  it('should keep separate SDK instances independent', async () => {
    const sdkA = new PlatformSDK()
    const sdkB = new PlatformSDK()

    sdkA.addRoute({
      path: '/route-a',
      name: 'RouteA',
      component: () => Promise.resolve({ default: {} }) as Promise<{ default: unknown }>
    })

    expect(sdkA.getRoutes()).toHaveLength(1)
    expect(sdkB.getRoutes()).toHaveLength(0)
  })
})
