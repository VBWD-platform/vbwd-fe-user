/**
 * EmailBlock — logged-in checkout header.
 *
 * When the viewer is authenticated the block must:
 *   - show the account email (sourced from /user/profile, NOT the local
 *     `user_email` fallback that only the in-checkout login populates), and
 *   - show the profile name rendered in bold ("Logged in as <b>Name</b>").
 *
 * Regression: a user who logged in via the main login page never sets
 * localStorage `user_email`, so the header previously rendered a blank email.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('@/api', () => ({
  api: { get: apiGet, post: vi.fn(), setToken: vi.fn() },
  isAuthenticated: () => true,
  clearApiAuth: vi.fn(),
}));

vi.mock('@/composables/useEmailCheck', () => ({
  useEmailCheck: () => ({
    state: ref('idle'),
    email: ref(''),
    checkEmail: vi.fn(),
    reset: vi.fn(),
    isNewUser: computed(() => false),
    isExistingUser: computed(() => false),
    isChecking: computed(() => false),
  }),
}));

vi.mock('@/composables/useAnalytics', () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock('@/utils/debounce', () => ({
  debounce: (fn: (...args: unknown[]) => unknown) => fn,
}));

import EmailBlock from '@/components/checkout/EmailBlock.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      components: {
        emailBlock: {
          title: 'Email',
          emailPlaceholder: 'Your email',
          checking: 'Checking…',
          loggedIn: {
            loggedInAs: 'Logged in as {email}',
            loggedInAsName: 'Logged in as {name}, email {email}',
            logoutButton: 'Logout',
          },
        },
      },
    },
  },
});

function mountBlock() {
  return mount(EmailBlock, {
    props: { isAuthenticated: true, initialEmail: '' },
    global: { plugins: [i18n] },
  });
}

describe('EmailBlock — logged-in state', () => {
  beforeEach(() => {
    apiGet.mockReset();
    localStorage.clear();
  });

  it('shows the email from /user/profile even when localStorage user_email is unset', async () => {
    apiGet.mockResolvedValue({
      user: { email: 'jane@example.com' },
      details: { first_name: 'Jane', last_name: 'Doe' },
    });

    const wrapper = mountBlock();
    await flushPromises();

    expect(apiGet).toHaveBeenCalledWith('/user/profile');
    expect(wrapper.get('[data-testid="logged-in-email"]').text()).toBe('jane@example.com');
  });

  it('renders the profile name in bold', async () => {
    apiGet.mockResolvedValue({
      user: { email: 'jane@example.com' },
      details: { first_name: 'Jane', last_name: 'Doe' },
    });

    const wrapper = mountBlock();
    await flushPromises();

    const nameEl = wrapper.get('[data-testid="logged-in-name"]');
    expect(nameEl.element.tagName).toBe('STRONG');
    expect(nameEl.text()).toBe('Jane Doe');
  });

  it('falls back to the email-only line when the profile has no name', async () => {
    apiGet.mockResolvedValue({
      user: { email: 'jane@example.com' },
      details: null,
    });

    const wrapper = mountBlock();
    await flushPromises();

    expect(wrapper.find('[data-testid="logged-in-name"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="logged-in-email"]').text()).toContain('jane@example.com');
  });
});
