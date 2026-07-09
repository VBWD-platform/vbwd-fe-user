/**
 * UserLayout sidebar-logo refinements.
 *
 * Covers the white-label brand name and the optional brand link:
 *  - the sidebar logo renders the brand name from appConfig.siteName (default
 *    "VBWD", overridden by the configured site_name);
 *  - when a plugin publishes a brand href via the generic brandActionsRegistry,
 *    the brand name is wrapped in an <a class="logo-brand-link"> pointing at it;
 *    with no brand href, the brand name is plain (no link).
 *
 * Core stays agnostic: the layout never names the CMS/home — it only reads a
 * generic "optional URL the brand name should link to" from the registry.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import { brandActionsRegistry } from '@/plugins/brandActionsRegistry';

// The brand name is sourced from the app-config store; control it per test.
const siteNameRef = ref('VBWD');
vi.mock('@/stores/appConfig', () => ({
  useAppConfigStore: () => ({ siteName: siteNameRef }),
}));

// storeToRefs is used for both the cart store and the app-config store; the
// mocked stores already expose refs, so return them as-is.
vi.mock('pinia', () => ({
  storeToRefs: (store: Record<string, unknown>) => store,
}));

vi.mock('vbwd-view-component', () => ({
  useCartStore: () => ({
    items: ref([]),
    itemCount: ref(0),
    total: ref(0),
    isEmpty: ref(true),
    removeItem: vi.fn(),
  }),
  Icon: { props: ['name'], template: '<span class="vbwd-icon" :data-icon="name" />' },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), resolve: vi.fn(() => ({ href: '/' })) }),
}));

vi.mock('@/plugins/userNavRegistry', () => ({
  userNavRegistry: {
    getSidebarItems: () => [],
    getMenuItems: () => [],
    getGroups: () => [],
    getGroupItems: () => [],
  },
}));

vi.mock('@/api', () => ({ hasUserPermission: () => false }));

vi.mock('@/composables/useDisplayPrice', () => ({
  useDisplayPrice: () => ({ formatInDisplay: (value: number) => `${value}` }),
}));

import UserLayout from '@/layouts/UserLayout.vue';

function mountLayout() {
  return mount(UserLayout, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        ToastHost: true,
        RouterLink: { props: ['to'], template: '<a><slot /></a>' },
      },
    },
  });
}

describe('UserLayout sidebar logo', () => {
  beforeEach(() => {
    siteNameRef.value = 'VBWD';
    brandActionsRegistry.setBrandHref(null);
  });

  it('renders the default "VBWD" brand name', () => {
    const wrapper = mountLayout();
    expect(wrapper.find('.logo').text()).toContain('VBWD');
  });

  it('renders a configured white-label brand name from appConfig.siteName', () => {
    siteNameRef.value = 'Acme Corp';
    const wrapper = mountLayout();
    expect(wrapper.find('.logo').text()).toContain('Acme Corp');
    expect(wrapper.find('.logo').text()).not.toContain('VBWD');
  });

  it('renders the brand name as plain text when no brand href is registered', () => {
    const wrapper = mountLayout();
    expect(wrapper.find('.logo .logo-brand-link').exists()).toBe(false);
    expect(wrapper.find('.logo h2').text()).toBe('VBWD');
  });

  it('wraps the brand name in a link to the registered brand href', () => {
    brandActionsRegistry.setBrandHref('/?public_home=1');
    const wrapper = mountLayout();
    const link = wrapper.find('.logo .logo-brand-link');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('/?public_home=1');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.text()).toContain('VBWD');
  });
});
