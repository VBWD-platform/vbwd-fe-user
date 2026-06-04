/**
 * TDD: GHRM tabs (Software, GitHub Access) must NOT show package content
 * on plans that have no linked GhrmSoftwarePackage (404 from by-plan endpoint).
 * They should render a "no-package" placeholder instead.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
  createI18n: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {} }),
}))

vi.mock('../../../../plugins/ghrm/src/api/ghrmApi', () => ({
  ghrmApi: { getPackageByPlan: vi.fn() },
}))

const accessStatusRef = ref<Record<string, unknown> | null>(null)

vi.mock('../../../../plugins/ghrm/src/stores/useGhrmStore', () => ({
  useGhrmStore: () => ({
    get accessStatus() { return accessStatusRef.value },
    installInstructions: null,
    currentPackage: null,
    fetchAccessStatus: vi.fn(),
    fetchInstallInstructions: vi.fn(),
  }),
}))

vi.mock('../../../../plugins/ghrm/src/components/GhrmGithubConnectButton.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('../../../../plugins/ghrm/src/components/GhrmMarkdownRenderer.vue', () => ({
  default: { template: '<div />', props: ['content'] },
}))
vi.mock('../../../../plugins/ghrm/src/components/GhrmVersionsTable.vue', () => ({
  default: { template: '<div />', props: ['versions'] },
}))

import GhrmPlanSoftwareTab from '../../../../plugins/ghrm/src/components/GhrmPlanSoftwareTab.vue'
import { ghrmApi } from '../../../../plugins/ghrm/src/api/ghrmApi'

const mockGetPackageByPlan = vi.mocked(ghrmApi.getPackageByPlan)

describe('GHRM tabs on non-GHRM plans (no linked package)', () => {
  beforeEach(() => {
    mockGetPackageByPlan.mockReset()
    accessStatusRef.value = null
  })

  it('GhrmPlanSoftwareTab shows no-package message when plan has no linked GHRM package', async () => {
    mockGetPackageByPlan.mockRejectedValue(new Error('GET failed: 404'))

    setActivePinia(createPinia())
    const wrapper = mount(GhrmPlanSoftwareTab, {
      props: { planSlug: 'enterprise', planId: 'enterprise-uuid-000' },
      global: { mocks: { $t: (k: string) => k } },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="no-package-message"]').exists()).toBe(true)
  })
})
