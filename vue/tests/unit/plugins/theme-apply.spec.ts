import { describe, it, expect, beforeEach } from 'vitest'
import { applyTheme, clearTheme } from '../../../../plugins/theme-switcher/apply-theme'
import { themePresets } from '../../../../plugins/theme-switcher/presets'

describe('applyTheme / clearTheme', () => {
  beforeEach(() => {
    // Reset all custom properties
    for (const preset of themePresets) {
      for (const property of Object.keys(preset.colors)) {
        document.documentElement.style.removeProperty(property)
      }
    }
  })

  it('should set CSS variables on document root', () => {
    const defaultPreset = themePresets.find(preset => preset.id === 'default')!
    applyTheme(defaultPreset)

    expect(document.documentElement.style.getPropertyValue('--vbwd-sidebar-bg')).toBe('#2c3e50')
    expect(document.documentElement.style.getPropertyValue('--vbwd-color-primary')).toBe('#3498db')
  })

  it('should apply dark theme variables', () => {
    const dark = themePresets.find(preset => preset.id === 'dark')!
    applyTheme(dark)

    expect(document.documentElement.style.getPropertyValue('--vbwd-page-bg')).toBe('#16213e')
    expect(document.documentElement.style.getPropertyValue('--vbwd-color-primary')).toBe('#60a5fa')
  })

  it('should overwrite previous theme variables', () => {
    const defaultPreset = themePresets.find(preset => preset.id === 'default')!
    const dark = themePresets.find(preset => preset.id === 'dark')!

    applyTheme(defaultPreset)
    expect(document.documentElement.style.getPropertyValue('--vbwd-color-primary')).toBe('#3498db')

    applyTheme(dark)
    expect(document.documentElement.style.getPropertyValue('--vbwd-color-primary')).toBe('#60a5fa')
  })

  it('should set all CSS variables defined in a preset', () => {
    const forest = themePresets.find(preset => preset.id === 'forest')!
    applyTheme(forest)

    for (const [property, value] of Object.entries(forest.colors)) {
      expect(document.documentElement.style.getPropertyValue(property)).toBe(value)
    }
  })

  it('clearTheme should remove all CSS variables for a preset', () => {
    const ocean = themePresets.find(preset => preset.id === 'ocean')!
    applyTheme(ocean)

    // Verify they're set
    expect(document.documentElement.style.getPropertyValue('--vbwd-color-primary')).toBe('#0284c7')

    clearTheme(ocean)

    for (const property of Object.keys(ocean.colors)) {
      expect(document.documentElement.style.getPropertyValue(property)).toBe('')
    }
  })

  it('clearTheme should not affect other CSS properties', () => {
    document.documentElement.style.setProperty('--custom-prop', 'red')
    const sunset = themePresets.find(preset => preset.id === 'sunset')!

    applyTheme(sunset)
    clearTheme(sunset)

    expect(document.documentElement.style.getPropertyValue('--custom-prop')).toBe('red')
    document.documentElement.style.removeProperty('--custom-prop')
  })

  it('should handle applying theme with all preset types', () => {
    for (const preset of themePresets) {
      applyTheme(preset)
      // Verify at least one variable was set
      expect(document.documentElement.style.getPropertyValue('--vbwd-sidebar-bg')).toBe(preset.colors['--vbwd-sidebar-bg'])
    }
  })
})
