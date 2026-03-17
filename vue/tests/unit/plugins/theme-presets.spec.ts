import { describe, it, expect } from 'vitest'
import { themePresets } from '../../../../plugins/theme-switcher/presets'
import type { ThemePreset } from '../../../../plugins/theme-switcher/presets'

describe('Theme Presets', () => {
  it('should export an array of presets', () => {
    expect(Array.isArray(themePresets)).toBe(true)
    expect(themePresets.length).toBeGreaterThanOrEqual(5)
  })

  it('should include a default preset', () => {
    const defaultPreset = themePresets.find(preset => preset.id === 'default')
    expect(defaultPreset).toBeDefined()
    expect(defaultPreset!.id).toBe('default')
  })

  it('should have all 5 expected presets', () => {
    const ids = themePresets.map(preset => preset.id)
    expect(ids).toContain('default')
    expect(ids).toContain('dark')
    expect(ids).toContain('forest')
    expect(ids).toContain('ocean')
    expect(ids).toContain('sunset')
  })

  it.each(themePresets.map(preset => [preset.id, preset]))('preset "%s" should have required fields', (_id: string, preset: ThemePreset) => {
    expect(preset.id).toBeTruthy()
    expect(preset.name).toBeTruthy()
    expect(preset.description).toBeTruthy()
    expect(typeof preset.colors).toBe('object')
    expect(typeof preset.preview).toBe('object')
  })

  it.each(themePresets.map(preset => [preset.id, preset]))('preset "%s" should define all required CSS variables', (_id: string, preset: ThemePreset) => {
    const requiredVars = [
      '--vbwd-sidebar-bg',
      '--vbwd-sidebar-text',
      '--vbwd-sidebar-active-bg',
      '--vbwd-page-bg',
      '--vbwd-card-bg',
      '--vbwd-color-primary',
      '--vbwd-color-primary-hover',
      '--vbwd-text-heading',
      '--vbwd-text-body',
      '--vbwd-text-muted',
      '--vbwd-color-success',
      '--vbwd-color-danger',
      '--vbwd-color-warning',
      '--vbwd-border-color',
      '--vbwd-border-light',
      '--vbwd-card-shadow',
    ]
    for (const v of requiredVars) {
      expect(preset.colors).toHaveProperty(v)
    }
  })

  it.each(themePresets.map(preset => [preset.id, preset]))('preset "%s" should have all preview fields', (_id: string, preset: ThemePreset) => {
    expect(preset.preview.sidebar).toBeTruthy()
    expect(preset.preview.primary).toBeTruthy()
    expect(preset.preview.background).toBeTruthy()
    expect(preset.preview.card).toBeTruthy()
    expect(preset.preview.text).toBeTruthy()
  })

  it('should use i18n keys for name and description', () => {
    for (const preset of themePresets) {
      expect(preset.name).toMatch(/^theme\.presets\.\w+\.name$/)
      expect(preset.description).toMatch(/^theme\.presets\.\w+\.description$/)
    }
  })

  it('dark preset should have dark background colors', () => {
    const dark = themePresets.find(preset => preset.id === 'dark')!
    // Dark backgrounds should be notably dark
    expect(dark.colors['--vbwd-page-bg']).toMatch(/^#1/)
    expect(dark.colors['--vbwd-card-bg']).toMatch(/^#1/)
  })

  it('each preset should have unique id', () => {
    const ids = themePresets.map(preset => preset.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})
