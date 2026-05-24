/**
 * Pure JWT helpers used to gate protected UI on the client.
 *
 * IMPORTANT: these are signature-BLIND by design. The backend verifies the
 * JWT signature on every request — that is the real authorization gate.
 * Reading the `exp` claim locally is a *UX* gate: it lets the router refuse
 * a stale session before the dashboard is ever painted, instead of
 * optimistically rendering it and only discovering the 401 after a network
 * round-trip (the flash-of-dashboard bug, sprint 2026-05-23/01).
 *
 * No side effects, no network — kept pure so they are trivially testable.
 */

/**
 * Decode the `exp` claim (seconds since the Unix epoch) from a JWT.
 *
 * Returns `null` when the argument is not a decodable 3-part JWT, or carries
 * no numeric `exp`. Callers treat `null` conservatively (cannot prove
 * expiry → do not lock the user out; let the server be the backstop).
 */
export function decodeJwtExp(token: string): number | null {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as Record<string, unknown>;
    const exp = payload.exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/**
 * Is this token a JWT whose `exp` is in the past?
 *
 * `now` is injected so tests can supply a deterministic clock (defaults to
 * `Date.now`). Tokens we cannot decode return `false` — we never claim a
 * token is expired unless the `exp` claim proves it.
 */
export function isTokenExpired(token: string, now: () => number = Date.now): boolean {
  const exp = decodeJwtExp(token);
  if (exp === null) return false;
  return exp * 1000 <= now();
}
