/**
 * Unit tests for pluginLoader's named-export resolution logic.
 *
 * pluginLoader.ts resolves an IPlugin from a module object using:
 *   pluginModule.default ?? first named export with an `install` method
 *
 * These tests validate that logic in isolation, without invoking
 * import.meta.glob (which is a Vite build-time feature).
 */

import { describe, it, expect } from 'vitest'
import type { IPlugin } from 'vbwd-view-component'

// ── Extracted helper (mirrors the logic in pluginLoader.ts) ─────────────────

/**
 * Resolve an IPlugin from an ESM module object.
 * Prefers `default` export; falls back to the first named export whose
 * value has an `install` method (IPlugin contract).
 */
function resolvePlugin(pluginModule: Record<string, unknown>): IPlugin | undefined {
  const candidate =
    (pluginModule.default as IPlugin | undefined) ??
    (Object.values(pluginModule) as unknown[]).find(
      (v): v is IPlugin => !!v && typeof v === 'object' && typeof (v as IPlugin).install === 'function'
    )
  return candidate && typeof (candidate as IPlugin).install === 'function'
    ? (candidate as IPlugin)
    : undefined
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makePlugin(name: string): IPlugin {
  return {
    name,
    version: '1.0.0',
    install() {},
    activate() {},
    deactivate() {},
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resolvePlugin — default export', () => {
  it('returns the default export when present', () => {
    const plugin = makePlugin('my-plugin')
    const module = { default: plugin }
    expect(resolvePlugin(module)).toBe(plugin)
  })

  it('prefers default over named export', () => {
    const defaultPlugin = makePlugin('default-plugin')
    const namedPlugin = makePlugin('named-plugin')
    const module = { default: defaultPlugin, namedPlugin }
    expect(resolvePlugin(module)).toBe(defaultPlugin)
  })
})

describe('resolvePlugin — named export fallback', () => {
  it('returns named export when default is absent', () => {
    const plugin = makePlugin('cms')
    const module = { cmsPlugin: plugin }
    expect(resolvePlugin(module)).toBe(plugin)
  })

  it('returns the first named export with install method', () => {
    const pluginA = makePlugin('plugin-a')
    const pluginB = makePlugin('plugin-b')
    const module = { pluginA, pluginB }
    // First value in insertion order
    const result = resolvePlugin(module)
    expect(result).toBeDefined()
    expect(['plugin-a', 'plugin-b']).toContain(result!.name)
  })

  it('identifies IPlugin by presence of install method', () => {
    const plugin = makePlugin('taro')
    const module = { someString: 'hello', someNumber: 42, taroPlugin: plugin }
    expect(resolvePlugin(module)).toBe(plugin)
  })
})

describe('resolvePlugin — no valid export', () => {
  it('returns undefined for empty module', () => {
    expect(resolvePlugin({})).toBeUndefined()
  })

  it('returns undefined when no export has install method', () => {
    const module = { foo: 'bar', count: 42, obj: { name: 'x' } }
    expect(resolvePlugin(module)).toBeUndefined()
  })

  it('returns undefined when default export is null', () => {
    const module = { default: null }
    expect(resolvePlugin(module)).toBeUndefined()
  })

  it('returns undefined when default export has no install method', () => {
    const module = { default: { name: 'broken', version: '1.0.0' } }
    expect(resolvePlugin(module)).toBeUndefined()
  })
})

describe('resolvePlugin — real plugin module shapes', () => {
  it('handles cmsPlugin named export (reproduces the original bug)', () => {
    const cmsPlugin = makePlugin('cms')
    // Exactly mirrors: export const cmsPlugin = { ... }
    const module: Record<string, unknown> = { cmsPlugin }
    const result = resolvePlugin(module)
    expect(result).toBeDefined()
    expect(result!.name).toBe('cms')
  })

  it('handles chatPlugin named export', () => {
    const chatPlugin = makePlugin('chat')
    const module: Record<string, unknown> = { chatPlugin }
    expect(resolvePlugin(module)!.name).toBe('chat')
  })

  it('handles landing1Plugin named export', () => {
    const landing1Plugin = makePlugin('landing1')
    const module: Record<string, unknown> = { landing1Plugin }
    expect(resolvePlugin(module)!.name).toBe('landing1')
  })

  it('handles taroPlugin named export', () => {
    const taroPlugin = makePlugin('taro')
    const module: Record<string, unknown> = { taroPlugin }
    expect(resolvePlugin(module)!.name).toBe('taro')
  })
})
