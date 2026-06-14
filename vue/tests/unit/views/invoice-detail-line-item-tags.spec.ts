/**
 * S77 — the user invoice detail renders each line's FROZEN tags + custom
 * fields (snapshotted at issue time) via the fe-core TagChips +
 * CustomFieldsDisplay components, reading the `tags` / `custom_fields` keys
 * already on the line-item payload (no extra fetch, no live join).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { invoiceId: 'inv-uuid-1' } }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>', props: ['to'] },
}))

vi.mock('@/api', () => ({
  api: { get: vi.fn() },
}))

import InvoiceDetail from '../../../src/views/InvoiceDetail.vue'
import { api } from '@/api'

const mockGet = vi.mocked(api.get)

const baseInvoice = {
  id: 'inv-uuid-1',
  invoice_number: 'INV-001',
  status: 'PAID',
  amount: '29.99',
  currency: 'EUR',
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

describe('InvoiceDetail — frozen line tags + custom fields (S77)', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it('renders TagChips + CustomFieldsDisplay from the line payload keys', async () => {
    mockGet.mockResolvedValue({
      ...baseInvoice,
      line_items: [{
        type: 'CUSTOM',
        description: 'Premium Widget',
        quantity: 1,
        unit_price: '29.99',
        total_price: '29.99',
        tags: ['sale', 'bestseller'],
        custom_fields: { warranty: 24 },
      }],
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'TagChips' }).exists()).toBe(true)
    expect(wrapper.text()).toContain('sale')
    expect(wrapper.text()).toContain('bestseller')
    expect(wrapper.find('[data-testid="custom-fields-display"]').exists()).toBe(true)
  })

  it('renders no tag/cf components when the line carries none', async () => {
    mockGet.mockResolvedValue({
      ...baseInvoice,
      line_items: [{
        type: 'CUSTOM',
        description: 'Plain Widget',
        quantity: 1,
        unit_price: '10.00',
        total_price: '10.00',
        tags: [],
        custom_fields: {},
      }],
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'TagChips' }).exists()).toBe(false)
    expect(wrapper.find('[data-testid="custom-fields-display"]').exists()).toBe(false)
  })
})
