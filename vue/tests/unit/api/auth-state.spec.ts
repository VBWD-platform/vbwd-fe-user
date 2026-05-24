/**
 * isAuthenticated() must answer "is there a VALID, unexpired session?",
 * not merely "is there a token string?". A stale (expired) JWT left in
 * localStorage after a window close must NOT count as authenticated, and
 * must be purged so no later code path fires a doomed request.
 *
 * Regression cover for the flash-of-dashboard bug (sprint 2026-05-23/01).
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { isAuthenticated, getUserPermissions } from '../../../src/api';

function makeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`;
}

const nowSec = () => Math.floor(Date.now() / 1000);
const validToken = () => makeJwt({ exp: nowSec() + 3600 });
const expiredToken = () => makeJwt({ exp: nowSec() - 3600 });

beforeEach(() => {
  localStorage.clear();
});

describe('isAuthenticated', () => {
  test('false when no token is present', () => {
    expect(isAuthenticated()).toBe(false);
  });

  test('true when the token is a JWT whose exp is in the future', () => {
    localStorage.setItem('auth_token', validToken());
    expect(isAuthenticated()).toBe(true);
    // valid session is left intact
    expect(localStorage.getItem('auth_token')).not.toBeNull();
  });

  test('false AND token purged when the JWT exp is in the past', () => {
    localStorage.setItem('auth_token', expiredToken());
    localStorage.setItem('user_id', 'u-1');
    localStorage.setItem('user_permissions', JSON.stringify(['*']));

    expect(isAuthenticated()).toBe(false);

    // stale session fully cleared so nothing reads it later
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('user_id')).toBeNull();
    expect(localStorage.getItem('user_permissions')).toBeNull();
    expect(getUserPermissions()).toEqual([]);
  });

  test('opaque (non-JWT) token is treated as authenticated (server is the backstop)', () => {
    localStorage.setItem('auth_token', 'opaque-token');
    expect(isAuthenticated()).toBe(true);
  });
});
