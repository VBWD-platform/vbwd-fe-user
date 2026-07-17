import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MaintenanceScreen from '@/components/MaintenanceScreen.vue';
import en from '@/i18n/locales/en.json';

/**
 * The "Technical works" maintenance screen is a real, localized, full-page
 * view shown app-wide when the CMS backend is license-blocked. It reads its
 * copy from the i18n `maintenance.*` keys (localized, theme-aware).
 */
describe('MaintenanceScreen', () => {
  function mountScreen() {
    return mount(MaintenanceScreen, {
      global: {
        mocks: { $t: (key: string) => key },
      },
    });
  }

  it('renders the localized headline and body i18n keys', () => {
    const wrapper = mountScreen();
    const text = wrapper.text();
    expect(text).toContain('maintenance.title');
    expect(text).toContain('maintenance.message');
  });

  it('ships the en locale strings the screen depends on', () => {
    const maintenance = (en as unknown as Record<string, Record<string, string>>).maintenance;
    expect(maintenance).toBeTruthy();
    expect(typeof maintenance.title).toBe('string');
    expect(maintenance.title.length).toBeGreaterThan(0);
    expect(typeof maintenance.message).toBe('string');
    expect(maintenance.message.length).toBeGreaterThan(0);
  });
});
