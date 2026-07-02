/**
 * TDD: fe-user InvoiceDetail must let a plugin contribute a per-line link via
 * the generic invoiceLineLinkRegistry — while the hardcoded core cases
 * (SUBSCRIPTION / TOKEN_BUNDLE / ADD_ON / booking) keep their existing links.
 *
 * A CUSTOM dataset line (unlinked by core) becomes clickable purely because a
 * plugin registered a resolver that maps it to /dashboard/datasets/<slug>.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { invoiceId: 'inv-uuid-1' } }),
  useRouter: () => ({ push: mockPush }),
  RouterLink: { template: '<a><slot /></a>', props: ['to'] },
}))

vi.mock('@/api', () => ({
  api: { get: vi.fn() },
}))

import InvoiceDetail from '../../../src/views/InvoiceDetail.vue'
import { api } from '@/api'
import { invoiceLineLinkRegistry } from '@/registries/invoiceLineLinkRegistry'

const mockGet = vi.mocked(api.get)

const baseInvoice = {
  id: 'inv-uuid-1',
  invoice_number: 'INV-001',
  status: 'PAID',
  amount: '29.99',
  currency: 'USD',
  created_at: '2026-01-01T00:00:00Z',
}

function mountView() {
  setActivePinia(createPinia())
  return mount(InvoiceDetail, {
    global: {
      mocks: { $t: (k: string) => k },
      stubs: { RouterLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } },
    },
  })
}

describe('InvoiceDetail line items — registry-contributed links', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPush.mockClear()
    invoiceLineLinkRegistry.clear()
  })

  afterEach(() => {
    invoiceLineLinkRegistry.clear()
  })

  it('a CUSTOM dataset line becomes clickable via a registered resolver', async () => {
    invoiceLineLinkRegistry.register((item) =>
      item.type?.toUpperCase() === 'CUSTOM' && item.extra_data?.plugin === 'dataset'
        ? `/dashboard/datasets/${(item.extra_data as { slug?: string }).slug}`
        : null,
    )

    mockGet.mockResolvedValue({
      ...baseInvoice,
      line_items: [{
        type: 'CUSTOM',
        item_id: 'ds-line-1',
        description: 'Air Quality dataset',
        quantity: 1,
        unit_price: '29.99',
        total_price: '29.99',
        extra_data: { plugin: 'dataset', slug: 'air-quality' },
      }],
    })

    const wrapper = mountView()
    await flushPromises()

    const row = wrapper.find('tbody tr')
    expect(row.exists()).toBe(true)
    expect(row.attributes('style')).toContain('cursor: pointer')
    await row.trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/dashboard/datasets/air-quality')
  })

  it('a SUBSCRIPTION line keeps its hardcoded link even with a resolver registered', async () => {
    invoiceLineLinkRegistry.register((item) =>
      item.type?.toUpperCase() === 'CUSTOM' ? '/dashboard/datasets/x' : null,
    )

    mockGet.mockResolvedValue({
      ...baseInvoice,
      line_items: [{
        type: 'SUBSCRIPTION',
        item_id: 'sub-uuid-111',
        catalog_item_id: 'plan-uuid-999',
        description: 'Pro Plan - Monthly',
        quantity: 1,
        unit_price: '29.99',
        total_price: '29.99',
      }],
    })

    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('tbody tr').trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/dashboard/plan/plan-uuid-999')
  })

  it('an unmatched CUSTOM line stays non-clickable when no resolver matches', async () => {
    mockGet.mockResolvedValue({
      ...baseInvoice,
      line_items: [{
        type: 'CUSTOM',
        item_id: 'misc-1',
        description: 'Miscellaneous charge',
        quantity: 1,
        unit_price: '5.00',
        total_price: '5.00',
      }],
    })

    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('tbody tr').trigger('click')

    expect(mockPush).not.toHaveBeenCalled()
  })
})
