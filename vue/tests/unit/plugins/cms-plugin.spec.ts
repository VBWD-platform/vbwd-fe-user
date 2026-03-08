import { describe, it, expect, beforeEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { PluginRegistry, PlatformSDK } from 'vbwd-view-component'
import { cmsPlugin } from '../../../../plugins/cms'

const NotFoundStub = { template: '<div>404</div>' }

describe('CMS Plugin — metadata', () => {
  it('has correct name and version', () => {
    expect(cmsPlugin.name).toBe('cms')
    expect(cmsPlugin.version).toBe('1.0.0')
  })

  it('has an install method', () => {
    expect(typeof cmsPlugin.install).toBe('function')
  })
})

describe('CMS Plugin — route registration', () => {
  let registry: PluginRegistry
  let sdk: PlatformSDK

  beforeEach(() => {
    registry = new PluginRegistry()
    sdk = new PlatformSDK()
  })

  it('registers /:slug(.+) route (not /page/:slug)', async () => {
    registry.register(cmsPlugin)
    await registry.installAll(sdk)

    const routes = sdk.getRoutes()
    const slugRoute = routes.find(r => r.name === 'cms-page')
    expect(slugRoute).toBeDefined()
    expect(slugRoute!.path).toBe('/:slug(.+)')
  })

  it('registers /pages index route', async () => {
    registry.register(cmsPlugin)
    await registry.installAll(sdk)

    const routes = sdk.getRoutes()
    const indexRoute = routes.find(r => r.name === 'cms-page-index')
    expect(indexRoute).toBeDefined()
    expect(indexRoute!.path).toBe('/pages')
  })

  it('cms-page route does NOT require auth', async () => {
    registry.register(cmsPlugin)
    await registry.installAll(sdk)

    const route = sdk.getRoutes().find(r => r.name === 'cms-page')
    expect(route!.meta?.requiresAuth).toBe(false)
  })

  it('cms-page-index route does NOT require auth', async () => {
    registry.register(cmsPlugin)
    await registry.installAll(sdk)

    const route = sdk.getRoutes().find(r => r.name === 'cms-page-index')
    expect(route!.meta?.requiresAuth).toBe(false)
  })

  it('adds english translations on install', async () => {
    registry.register(cmsPlugin)
    await registry.installAll(sdk)

    const translations = sdk.getTranslations()
    expect(translations['en']).toBeDefined()
    expect((translations['en'] as any).cms).toBeDefined()
    expect((translations['en'] as any).cms.loading).toBe('Loading…')
    expect((translations['en'] as any).cms.notFound).toBe('Page not found.')
  })
})

describe('CMS Plugin — Vue Router integration', () => {
  it('/:slug resolves to cms-page for slug-only paths', async () => {
    const registry = new PluginRegistry()
    const sdk = new PlatformSDK()

    registry.register(cmsPlugin)
    await registry.installAll(sdk)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div>Login</div>' } },
        { path: '/dashboard', name: 'dashboard', component: { template: '<div>Dashboard</div>' } },
        { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundStub },
      ]
    })

    for (const route of sdk.getRoutes()) {
      router.addRoute(route as Parameters<typeof router.addRoute>[0])
    }

    await router.push('/test')
    expect(router.currentRoute.value.name).toBe('cms-page')
    expect(router.currentRoute.value.params.slug).toBe('test')
  })

  it('static routes take priority over /:slug', async () => {
    const registry = new PluginRegistry()
    const sdk = new PlatformSDK()

    registry.register(cmsPlugin)
    await registry.installAll(sdk)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div>Login</div>' } },
        { path: '/dashboard', name: 'dashboard', component: { template: '<div>Dashboard</div>' } },
        { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundStub },
      ]
    })

    for (const route of sdk.getRoutes()) {
      router.addRoute(route as Parameters<typeof router.addRoute>[0])
    }

    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('login')

    await router.push('/dashboard')
    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('/pages resolves to cms-page-index, not /:slug(.+)', async () => {
    const registry = new PluginRegistry()
    const sdk = new PlatformSDK()

    registry.register(cmsPlugin)
    await registry.installAll(sdk)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundStub },
      ]
    })

    for (const route of sdk.getRoutes()) {
      router.addRoute(route as Parameters<typeof router.addRoute>[0])
    }

    await router.push('/pages')
    expect(router.currentRoute.value.name).toBe('cms-page-index')
  })

  it('multi-segment slug resolves to cms-page with full path as slug', async () => {
    const registry = new PluginRegistry()
    const sdk = new PlatformSDK()

    registry.register(cmsPlugin)
    await registry.installAll(sdk)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div>Login</div>' } },
        { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundStub },
      ]
    })

    for (const route of sdk.getRoutes()) {
      router.addRoute(route as Parameters<typeof router.addRoute>[0])
    }

    await router.push('/blog/2026/my-article')
    expect(router.currentRoute.value.name).toBe('cms-page')
    expect(router.currentRoute.value.params.slug).toBe('blog/2026/my-article')
  })

  it('static routes still take priority over multi-segment /:slug(.+)', async () => {
    const registry = new PluginRegistry()
    const sdk = new PlatformSDK()

    registry.register(cmsPlugin)
    await registry.installAll(sdk)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div>Login</div>' } },
        { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundStub },
      ]
    })

    for (const route of sdk.getRoutes()) {
      router.addRoute(route as Parameters<typeof router.addRoute>[0])
    }

    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('login')
  })
})

describe('CMS Plugin — lifecycle', () => {
  it('activate sets _active to true', () => {
    const plugin = cmsPlugin as typeof cmsPlugin & { _active: boolean }
    plugin._active = false
    plugin.activate!()
    expect(plugin._active).toBe(true)
  })

  it('deactivate sets _active to false', () => {
    const plugin = cmsPlugin as typeof cmsPlugin & { _active: boolean }
    plugin._active = true
    plugin.deactivate!()
    expect(plugin._active).toBe(false)
  })
})
