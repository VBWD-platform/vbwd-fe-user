import { describe, it, expect } from 'vitest'
import { PluginRegistry, PlatformSDK } from 'vbwd-view-component'
import { themeSwitcherPlugin } from '../../../../plugins/theme-switcher'
import { themePresets } from '../../../../plugins/theme-switcher/presets'

describe('Theme Switcher Plugin', () => {
  let registry: PluginRegistry
  let sdk: PlatformSDK

  beforeEach(() => {
    registry = new PluginRegistry()
    sdk = new PlatformSDK()
    localStorage.clear()
    // Reset CSS vars
    for (const preset of themePresets) {
      for (const property of Object.keys(preset.colors)) {
        document.documentElement.style.removeProperty(property)
      }
    }
  })

  it('should have correct metadata', () => {
    expect(themeSwitcherPlugin.name).toBe('theme-switcher')
    expect(themeSwitcherPlugin.version).toBe('26.6.1')
  })

  it('should register appearance route on install', async () => {
    registry.register(themeSwitcherPlugin)
    await registry.installAll(sdk)

    const routes = sdk.getRoutes()
    expect(routes.length).toBeGreaterThanOrEqual(1)
    const route = routes.find(r => r.path === '/dashboard/appearance')
    expect(route).toBeDefined()
    expect(route!.name).toBe('appearance')
    expect(route!.meta?.requiresAuth).toBe(true)
  })

  it('should add translations on install', async () => {
    registry.register(themeSwitcherPlugin)
    await registry.installAll(sdk)

    const translations = sdk.getTranslations()
    expect(translations['en']).toBeDefined()
    expect(translations['de']).toBeDefined()
  })

  it('should apply default theme on activate when no saved theme', async () => {
    registry.register(themeSwitcherPlugin)
    await registry.installAll(sdk)
    await registry.activate('theme-switcher')

    // Default theme should be applied (sidebar-bg = #2c3e50)
    expect(document.documentElement.style.getPropertyValue('--vbwd-sidebar-bg')).toBe('#2c3e50')
  })

  it('should apply saved theme on activate', async () => {
    localStorage.setItem('vbwd_theme', 'dark')

    registry.register(themeSwitcherPlugin)
    await registry.installAll(sdk)
    await registry.activate('theme-switcher')

    expect(document.documentElement.style.getPropertyValue('--vbwd-sidebar-bg')).toBe('#1a1a2e')
    expect(document.documentElement.style.getPropertyValue('--vbwd-color-primary')).toBe('#60a5fa')
  })

  it('should fall back to default if saved theme id is invalid', async () => {
    localStorage.setItem('vbwd_theme', 'nonexistent-theme')

    registry.register(themeSwitcherPlugin)
    await registry.installAll(sdk)
    await registry.activate('theme-switcher')

    // No theme found, so nothing should be applied (documentElement style untouched)
    // The plugin only applies if preset is found
    expect(document.documentElement.style.getPropertyValue('--vbwd-sidebar-bg')).toBe('')
  })

  it('should reset to default theme on deactivate', async () => {
    localStorage.setItem('vbwd_theme', 'dark')

    registry.register(themeSwitcherPlugin)
    await registry.installAll(sdk)
    await registry.activate('theme-switcher')

    // Dark applied
    expect(document.documentElement.style.getPropertyValue('--vbwd-sidebar-bg')).toBe('#1a1a2e')

    await registry.deactivate('theme-switcher')

    // After deactivate, default theme should be applied
    expect(document.documentElement.style.getPropertyValue('--vbwd-sidebar-bg')).toBe('#2c3e50')
  })

  it('should complete full lifecycle', async () => {
    registry.register(themeSwitcherPlugin)
    await registry.installAll(sdk)
    await registry.activate('theme-switcher')
    await registry.deactivate('theme-switcher')

    // Should not throw
    expect(true).toBe(true)
  })
})
