import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

// App-wide maintenance state, controlled per test.
const maintenanceActiveRef = ref(false);
vi.mock('@/stores/maintenance', () => ({
  useMaintenanceStore: () => ({ active: maintenanceActiveRef }),
}));

// Keep the real pinia (fe-core stores call defineStore at import time); only
// override storeToRefs so the mocked maintenance store's refs pass through.
vi.mock('pinia', async () => {
  const actual = await vi.importActual<typeof import('pinia')>('pinia');
  return { ...actual, storeToRefs: (store: Record<string, unknown>) => store };
});

// The app-config store loads onMounted; stub it to a no-op.
vi.mock('@/stores/appConfig', () => ({
  useAppConfigStore: () => ({ load: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('@/api', () => ({ isAuthenticated: () => false }));

// A bare public route so the non-maintenance branch renders the plain
// <router-view /> (no UserLayout, which would pull in fe-core stores).
const routeMeta = ref<Record<string, unknown>>({});
vi.mock('vue-router', () => ({
  useRoute: () => ({ meta: routeMeta.value }),
}));

import App from '@/App.vue';

function mountApp() {
  return mount(App, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        UserLayout: { template: '<div class="user-layout"><slot /></div>' },
        SessionExpiredModal: true,
        RouterView: { template: '<div class="router-view" />' },
        MaintenanceScreen: { template: '<div class="maintenance-screen" />' },
      },
    },
  });
}

describe('App.vue maintenance rendering', () => {
  beforeEach(() => {
    maintenanceActiveRef.value = false;
    routeMeta.value = {};
  });

  it('renders the normal content (router-view) when maintenance is inactive', () => {
    const wrapper = mountApp();
    expect(wrapper.find('.router-view').exists()).toBe(true);
    expect(wrapper.find('.maintenance-screen').exists()).toBe(false);
  });

  it('renders the "Technical works" screen INSTEAD of content when maintenance is active', () => {
    maintenanceActiveRef.value = true;
    const wrapper = mountApp();
    expect(wrapper.find('.maintenance-screen').exists()).toBe(true);
    expect(wrapper.find('.router-view').exists()).toBe(false);
    expect(wrapper.find('.user-layout').exists()).toBe(false);
  });

  it('marks #app with app--public-light on public CMS pages (cmsLayout route) so the app dark theme never bleeds onto public content', () => {
    routeMeta.value = { cmsLayout: true };
    const wrapper = mountApp();
    expect(wrapper.find('#app').classes()).toContain('app--public-light');
  });

  it('marks #app with app--public-light on bare public routes (noLayout, e.g. /checkout, /login)', () => {
    routeMeta.value = { requiresAuth: false, noLayout: true };
    const wrapper = mountApp();
    expect(wrapper.find('#app').classes()).toContain('app--public-light');
  });

  it('does NOT mark #app with app--public-light on authenticated app/dashboard routes (keeps the dark app chrome)', () => {
    routeMeta.value = { requiresAuth: true };
    const wrapper = mountApp();
    expect(wrapper.find('#app').classes()).not.toContain('app--public-light');
  });
});
