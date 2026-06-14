import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withdrawPlugin } from '../../index';
import { userNavRegistry } from '@/plugins/userNavRegistry';

interface AddedRoute {
  path: string;
  name: string;
  meta?: Record<string, unknown>;
}

function makeSdkSpy() {
  return {
    addRoute: vi.fn(),
    addTranslations: vi.fn(),
    addComponent: vi.fn(),
  };
}

const ALL_APP_LOCALES = ['de', 'en', 'es', 'fr', 'ja', 'ru', 'th', 'zh'];

describe('withdraw plugin registration', () => {
  beforeEach(() => {
    userNavRegistry.unregister('withdraw');
  });

  it('uses a named export with the plugin contract', () => {
    expect(withdrawPlugin.name).toBe('withdraw');
    expect(typeof withdrawPlugin.install).toBe('function');
    expect(typeof withdrawPlugin.activate).toBe('function');
    expect(typeof withdrawPlugin.deactivate).toBe('function');
  });

  it('registers the auth-guarded /withdraw and /withdraw/:id routes', () => {
    const sdk = makeSdkSpy();
    withdrawPlugin.install!(sdk as never);

    const routes: AddedRoute[] = sdk.addRoute.mock.calls.map(
      (call) => call[0] as AddedRoute,
    );
    const listRoute = routes.find((route) => route.path === '/withdraw');
    const detailRoute = routes.find((route) => route.path === '/withdraw/:id');

    expect(listRoute).toBeDefined();
    expect(listRoute!.meta?.requiresAuth).toBe(true);
    expect(detailRoute).toBeDefined();
    expect(detailRoute!.meta?.requiresAuth).toBe(true);
  });

  it('registers translations for every app locale, each with withdraw.title', () => {
    const sdk = makeSdkSpy();
    withdrawPlugin.install!(sdk as never);

    const registeredLocales = sdk.addTranslations.mock.calls
      .map((call) => call[0] as string)
      .sort();
    expect(registeredLocales).toEqual(ALL_APP_LOCALES);

    for (const call of sdk.addTranslations.mock.calls) {
      const messages = call[1] as { withdraw?: { title?: string } };
      expect(messages.withdraw?.title, `locale ${call[0]}`).toBeTruthy();
    }
  });

  it('registers the reusable WithdrawPanel via sdk.addComponent (D8)', () => {
    const sdk = makeSdkSpy();
    withdrawPlugin.install!(sdk as never);

    const componentNames = sdk.addComponent.mock.calls.map(
      (call) => call[0] as string,
    );
    expect(componentNames).toContain('WithdrawPanel');
  });

  it('activate registers the nav item; deactivate removes it', () => {
    withdrawPlugin.activate!();

    const navItem = userNavRegistry
      .getSidebarItems()
      .find((item) => item.pluginName === 'withdraw');
    expect(navItem).toBeDefined();
    expect(navItem!.to).toBe('/withdraw');
    expect(navItem!.labelKey).toBe('withdraw.title');
    expect(navItem!.testId).toBe('nav-withdraw');

    withdrawPlugin.deactivate!();
    const afterDeactivate = userNavRegistry
      .getSidebarItems()
      .find((item) => item.pluginName === 'withdraw');
    expect(afterDeactivate).toBeUndefined();
  });
});
