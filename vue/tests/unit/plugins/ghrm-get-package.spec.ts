import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GhrmPackageDetail from '../../../../plugins/ghrm/src/views/GhrmPackageDetail.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  createI18n: vi.fn(),
}))

const mockPush = vi.fn()
let mockRouteParams: Record<string, string> = {}

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ params: mockRouteParams, query: {}, fullPath: '/category/backend/loopai-core', path: '/category/backend/loopai-core' }),
}))

const mockFetchPackage = vi.fn()
const mockFetchRelated = vi.fn()
const mockFetchVersions = vi.fn()
const mockFetchAccessStatus = vi.fn()

vi.mock('../../../../plugins/ghrm/src/stores/useGhrmStore', () => ({
  useGhrmStore: () => ({
    loading: false,
    error: null,
    currentPackage: {
      id: 'pkg-uuid-111',
      slug: 'loopai-core',
      name: 'LoopAI Core',
      tariff_plan_id: 'plan-uuid-999',
      author_name: 'dantweb',
      icon_url: null,
      github_owner: 'dantweb',
      github_repo: 'loopai-core',
      github_protected_branch: 'release',
      download_counter: 42,
      readme: '# Hello',
      changelog: null,
      docs: null,
      screenshots: [],
      cached_releases: [],
      latest_version: '1.0.0',
      latest_released_at: null,
      last_synced_at: null,
      related_slugs: [],
    },
    relatedPackages: [],
    versions: [],
    accessStatus: null,
    fetchPackage: mockFetchPackage,
    fetchRelated: mockFetchRelated,
    fetchVersions: mockFetchVersions,
    fetchAccessStatus: mockFetchAccessStatus,
  }),
}))

vi.mock('vbwd-view-component', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('../../../../plugins/ghrm/src/components/GhrmMarkdownRenderer.vue', () => ({
  default: { template: '<div />', props: ['content'] },
}))
vi.mock('../../../../plugins/ghrm/src/components/GhrmVersionsTable.vue', () => ({
  default: { template: '<div />', props: ['versions'] },
}))
vi.mock('../../../../plugins/ghrm/src/components/GhrmGithubConnectButton.vue', () => ({
  default: { template: '<div />' },
}))

import { useAuthStore } from 'vbwd-view-component'

function mountDetail(isAuthenticated: boolean) {
  setActivePinia(createPinia())
  vi.mocked(useAuthStore).mockReturnValue({ isAuthenticated } as ReturnType<typeof useAuthStore>)
  return mount(GhrmPackageDetail, {
    global: {
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
      mocks: { $t: (key: string) => key },
    },
  })
}

describe('GhrmPackageDetail — Get Package button', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockRouteParams = { category_slug: 'backend', package_slug: 'loopai-core' }
  })

  it('renders Get Package button when not subscribed', () => {
    const wrapper = mountDetail(false)
    expect(wrapper.find('[data-testid="ghrm-get-package-btn"]').exists()).toBe(true)
  })

  it('navigates to /checkout for anonymous users without requiring login', async () => {
    const wrapper = mountDetail(false)
    await wrapper.find('[data-testid="ghrm-get-package-btn"]').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({
      path: '/checkout',
      query: {
        tarif_plan_id: 'plan-uuid-999',
        package_name: 'LoopAI Core',
        package_slug: 'loopai-core',
      },
    })
  })

  it('navigates to /checkout for authenticated users', async () => {
    const wrapper = mountDetail(true)
    await wrapper.find('[data-testid="ghrm-get-package-btn"]').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({
      path: '/checkout',
      query: {
        tarif_plan_id: 'plan-uuid-999',
        package_name: 'LoopAI Core',
        package_slug: 'loopai-core',
      },
    })
  })

  it('does NOT pass the GHRM package id (pkg.id) as tarif_plan_id', async () => {
    const wrapper = mountDetail(true)
    await wrapper.find('[data-testid="ghrm-get-package-btn"]').trigger('click')
    const call = mockPush.mock.calls[0][0]
    expect(call.query.tarif_plan_id).not.toBe('pkg-uuid-111')
    expect(call.query.tarif_plan_id).toBe('plan-uuid-999')
  })
})
