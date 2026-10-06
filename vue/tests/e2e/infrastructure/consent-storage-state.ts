/**
 * Shared browser storage state for every e2e test: a recorded cookie-consent
 * decision, so the CMS CookieConsent backdrop (which intercepts all pointer
 * events until a choice is made) never covers the page under test.
 *
 * Mirrors the record the cms plugin persists (plugins/cms/src/consent):
 * localStorage `vbwd_cookie_consent` = { version, decidedAt, method, categories }.
 * The banner re-opens while `record.version < consent_version` (operator
 * config, default 1), so the seeded version sits well above any realistic bump.
 */
const CONSENT_STORAGE_KEY = 'vbwd_cookie_consent';
const SEEDED_CONSENT_VERSION = 1000;

export function consentStorageState(baseURL: string) {
  const consentRecord = {
    version: SEEDED_CONSENT_VERSION,
    decidedAt: '2026-01-01T00:00:00.000Z',
    method: 'accept_all',
    categories: { necessary: true, preferences: true, statistics: true, marketing: true },
  };
  return {
    cookies: [],
    origins: [
      {
        origin: new URL(baseURL).origin,
        localStorage: [{ name: CONSENT_STORAGE_KEY, value: JSON.stringify(consentRecord) }],
      },
    ],
  };
}
