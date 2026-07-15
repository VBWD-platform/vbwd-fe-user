/**
 * Shared API Client Instance
 *
 * Singleton ApiClient used by all stores and components.
 * This ensures the auth token is shared across the application.
 */
import { ApiClient } from 'vbwd-view-component';
import { ref } from 'vue';
import { isTokenExpired } from './token';
import { installCmsMaintenanceDetector } from './cmsMaintenance';

// Session expired state - reactive so components can react to it
export const sessionExpired = ref(false);
export const sessionExpiredMessage = ref('');

// Singleton API client instance
export const api = new ApiClient({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1'
});

// Observe every request for a license-blocked CMS response (HTTP 402). When
// the public site's CMS backend is license-gated, this flips the app-wide
// "Technical works" maintenance state (see @/stores/maintenance). Installed on
// the host's own singleton so the shared fe-core client stays untouched.
installCmsMaintenanceDetector(api);

/**
 * Initialize API client with token from localStorage
 * Call this on app startup to restore authentication state
 */
export function initializeApi(): void {
  const token = localStorage.getItem('auth_token');
  if (token) {
    api.setToken(token);
  }

  // Setup token expiry handler
  api.on('token-expired', () => {
    handleSessionExpiry('Your session has expired. Please log in again.');
  });
}

/**
 * Handle session expiry
 * Clears auth state and sets the expired flag
 *
 * Special-case: on /checkout/* routes the user is treated as a fresh
 * anonymous visitor (the checkout view supports inline login/signup via
 * EmailBlock — there is no guest checkout, but the user picks their own
 * path). Showing the "Session Expired → Log In" modal forces a full
 * detour through the login page and loses checkout context. Instead we
 * silently clear auth state and reload so the view re-mounts in its
 * anonymous flow.
 */
export function handleSessionExpiry(message = 'Session expired'): void {
  // Only trigger once
  if (sessionExpired.value) return;

  // Capture BEFORE clearing: was there actually a session to expire?
  const hadToken =
    typeof localStorage !== 'undefined' && !!localStorage.getItem('auth_token');

  // Always clear auth — whether or not we show the modal.
  clearApiAuth();

  if (isOnCheckoutRoute()) {
    // Reload so PublicCheckoutView's `isAuthenticated` ref re-reads
    // localStorage and re-renders the EmailBlock in its anonymous state
    // (login + sign-up tabs). No modal, no /login redirect.
    //
    // BUT only when a token actually existed: ApiClient emits `token-expired`
    // on *every* 401, including those an already-anonymous visitor gets from an
    // auth-gated checkout call (e.g. a paid-plan token-payment quote). Reloading
    // there fixes nothing — the next load re-fires the same 401 — so the page
    // reloads ~3×/s forever. Guarding on `hadToken` breaks that loop.
    if (hadToken && typeof window !== 'undefined') {
      window.location.reload();
    }
    return;
  }

  sessionExpired.value = true;
  sessionExpiredMessage.value = message;
}

function isOnCheckoutRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/checkout');
}

/**
 * Clear session expired state
 * Call this after user acknowledges the expiry modal
 */
export function clearSessionExpiry(): void {
  sessionExpired.value = false;
  sessionExpiredMessage.value = '';
}

/**
 * Clear API authentication
 * Call this on logout to clear the token
 */
export function clearApiAuth(): void {
  api.clearToken();
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_permissions');
}

/**
 * Check if the user has a valid, unexpired session.
 *
 * This is the single source of truth for "am I authenticated?" — the router
 * guard, App.vue's layout switch, and Home.vue all go through it.
 *
 * A token string alone is NOT enough: a JWT left in localStorage after a
 * window close may already be expired. We read the `exp` claim client-side
 * (zero network cost) and, if the token is provably expired, purge it and
 * report unauthenticated — so protected views (the dashboard) are never
 * painted to a dead session. Tokens we cannot decode fall through to
 * "present ⇒ authenticated"; the server's 401 remains the backstop.
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem('auth_token');
  if (!token) return false;
  if (isTokenExpired(token)) {
    clearApiAuth();
    return false;
  }
  return true;
}

/**
 * Check if user has a specific user-facing permission.
 * Permissions are stored in localStorage on login.
 */
export function hasUserPermission(permission: string): boolean {
  try {
    const raw = localStorage.getItem('user_permissions');
    if (!raw) return false;
    const perms: string[] = JSON.parse(raw);
    if (perms.includes('*')) return true;
    if (perms.includes(permission)) return true;
    return perms.some(
      (p) => p.endsWith('.*') && permission.startsWith(p.slice(0, -1))
    );
  } catch {
    return false;
  }
}

/**
 * Get all user permissions from localStorage.
 */
export function getUserPermissions(): string[] {
  try {
    const raw = localStorage.getItem('user_permissions');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Initialize on module load
initializeApi();
