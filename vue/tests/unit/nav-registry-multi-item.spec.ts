/**
 * Sprint 07 — userNavRegistry supports multiple items per plugin, and core
 * no longer hardcodes a subscription nav group (it's plugin-owned).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect, beforeEach } from 'vitest'

import { userNavRegistry } from '../../src/plugins/userNavRegistry'

const SRC = resolve(__dirname, '../../src')

describe('userNavRegistry — multiple items per plugin', () => {
  beforeEach(() => {
    userNavRegistry.unregister('subscription')
    userNavRegistry.unregister('p')
  })

  it('keeps multiple items registered by one plugin', () => {
    userNavRegistry.register({ pluginName: 'p', to: '/a', labelKey: 'a' })
    userNavRegistry.register({ pluginName: 'p', to: '/b', labelKey: 'b', group: 'store' })
    const sidebar = userNavRegistry.getSidebarItems().filter((i) => i.pluginName === 'p')
    const store = userNavRegistry.getGroupItems('store').filter((i) => i.pluginName === 'p')
    expect(sidebar.map((i) => i.to)).toEqual(['/a'])
    expect(store.map((i) => i.to)).toEqual(['/b'])
  })

  it('unregister(pluginName) removes ALL of that plugin\'s items', () => {
    userNavRegistry.register({ pluginName: 'p', to: '/a', labelKey: 'a' })
    userNavRegistry.register({ pluginName: 'p', to: '/b', labelKey: 'b', group: 'store' })
    userNavRegistry.unregister('p')
    expect(userNavRegistry.getSidebarItems().some((i) => i.pluginName === 'p')).toBe(false)
    expect(userNavRegistry.getGroupItems('store').some((i) => i.pluginName === 'p')).toBe(false)
  })
})

describe('UserLayout — subscription nav is plugin-owned, invoices is core', () => {
  const layout = readFileSync(resolve(SRC, 'layouts/UserLayout.vue'), 'utf8')

  it('has no hardcoded Subscription nav group', () => {
    expect(layout).not.toMatch(/expandedGroups\.subscription/)
    expect(layout).not.toMatch(/toggleGroup\('subscription'\)/)
  })

  it('renders a core top-level Invoices link', () => {
    expect(layout).toMatch(/nav-invoices/)
    expect(layout).toMatch(/\$t\('nav\.invoices'\)/)
  })
})
