/**
 * Pure JWT-expiry helpers used to gate protected UI client-side.
 *
 * These are signature-BLIND on purpose: the server still verifies the JWT
 * signature on every request. Reading `exp` locally lets the router refuse
 * a stale session BEFORE painting the dashboard, killing the flash-of-
 * dashboard bug (sprint 2026-05-23/01).
 */
import { describe, test, expect } from 'vitest';
import { decodeJwtExp, isTokenExpired } from '../../../src/api/token';

/** Build an unsigned, decodable JWT-shaped string with the given payload. */
function makeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`;
}

const FROZEN_NOW = 1_700_000_000_000; // ms
const clock = () => FROZEN_NOW;

describe('decodeJwtExp', () => {
  test('returns the exp integer for a well-formed 3-part JWT', () => {
    expect(decodeJwtExp(makeJwt({ exp: 1_700_000_500 }))).toBe(1_700_000_500);
  });

  test('returns null for an empty string', () => {
    expect(decodeJwtExp('')).toBeNull();
  });

  test('returns null for non-JWT garbage', () => {
    expect(decodeJwtExp('not-a-jwt')).toBeNull();
  });

  test('returns null for a 2-part token', () => {
    expect(decodeJwtExp('header.payload')).toBeNull();
  });

  test('returns null when the payload is not valid base64url JSON', () => {
    expect(decodeJwtExp('aaa.@@@notjson@@@.sig')).toBeNull();
  });

  test('returns null when the payload has no exp claim', () => {
    expect(decodeJwtExp(makeJwt({ sub: 'u-1' }))).toBeNull();
  });

  test('returns null when exp is not a number', () => {
    expect(decodeJwtExp(makeJwt({ exp: 'soon' }))).toBeNull();
  });
});

describe('isTokenExpired', () => {
  test('false when exp is in the future (uses injected clock)', () => {
    // exp = now + 1000s
    const token = makeJwt({ exp: FROZEN_NOW / 1000 + 1000 });
    expect(isTokenExpired(token, clock)).toBe(false);
  });

  test('true when exp is in the past', () => {
    const token = makeJwt({ exp: FROZEN_NOW / 1000 - 1 });
    expect(isTokenExpired(token, clock)).toBe(true);
  });

  test('false when exp cannot be decoded (conservative fallback)', () => {
    expect(isTokenExpired('opaque-token', clock)).toBe(false);
  });

  test('uses the injected clock, not wall-clock', () => {
    const token = makeJwt({ exp: FROZEN_NOW / 1000 + 10 });
    // A clock far in the future makes the same token read as expired.
    const future = () => FROZEN_NOW + 1_000_000;
    expect(isTokenExpired(token, future)).toBe(true);
  });
});
