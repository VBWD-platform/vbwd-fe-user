/**
 * Session-expiry behaviour:
 *   - On regular routes → modal shown via sessionExpired ref.
 *   - On /checkout/* routes → no modal; auth is cleared and the page
 *     reloads so PublicCheckoutView re-mounts in its anonymous state.
 *
 * Regression cover for the 2026-05-10 incident where a logged-in user
 * whose JWT expired during checkout was greeted with a "Session Expired
 * → Log In" modal that forced a /login detour. There is no guest
 * checkout, but checkout already supports anonymous-with-login-or-signup,
 * so the modal was the wrong UX there.
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  handleSessionExpiry,
  clearSessionExpiry,
  sessionExpired,
  sessionExpiredMessage,
} from '../../../src/api';

const setLocation = (pathname: string) => {
  // Replace location with a writable stub (jsdom's location is read-only).
  const reload = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname, reload },
  });
  return reload;
};

beforeEach(() => {
  clearSessionExpiry();
  localStorage.clear();
  localStorage.setItem('auth_token', 'stub-token');
  localStorage.setItem('user_id', 'u-1');
});

describe('handleSessionExpiry', () => {
  test('on a regular route → sets sessionExpired flag (modal shows)', () => {
    setLocation('/dashboard');
    handleSessionExpiry('jwt expired');

    expect(sessionExpired.value).toBe(true);
    expect(sessionExpiredMessage.value).toBe('jwt expired');
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  test('on /checkout → no modal, auth cleared, page reloads', () => {
    const reload = setLocation('/checkout?tarif_plan_id=basic');
    handleSessionExpiry('jwt expired');

    expect(sessionExpired.value).toBe(false);
    expect(sessionExpiredMessage.value).toBe('');
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('on /checkout while ANONYMOUS (no token) → does NOT reload (prevents the 401 reload loop)', () => {
    // Repro: a paid-plan quote 401s for an anonymous visitor → ApiClient emits
    // token-expired → handleSessionExpiry. With no token there is no session to
    // drop into anonymous mode, so reloading just re-fires the same 401 forever.
    localStorage.removeItem('auth_token');
    const reload = setLocation('/checkout?tarif_plan_id=enterprise');
    handleSessionExpiry('jwt expired');

    expect(reload).not.toHaveBeenCalled();
    expect(sessionExpired.value).toBe(false); // still no modal on checkout
  });

  test('on /checkout/confirmation → no modal, no redirect', () => {
    const reload = setLocation('/checkout/confirmation?invoice_id=abc');
    handleSessionExpiry('jwt expired');

    expect(sessionExpired.value).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('idempotent: second call after modal already showing is a no-op', () => {
    setLocation('/dashboard');
    handleSessionExpiry('first');
    handleSessionExpiry('second');

    expect(sessionExpiredMessage.value).toBe('first');
  });
});
