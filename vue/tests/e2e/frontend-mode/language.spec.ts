/**
 * S152-11 spec 6 — R8/D13 language defined by the CMS. A German page renders in
 * both modes; in theme mode the document says `lang="de"`, the `vbwd_lang` cookie
 * sets the language of a language-neutral page, and the switcher moves between
 * the translations of one `translation_group_id`. (The SPA sets no `<html lang>`
 * and has no switcher, so those assertions are theme-only.) S152-05b: a German
 * themed page shows German UI strings from the theme `de.json` catalogs.
 */
import { randomUUID } from 'node:crypto';
import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import {
  CmsAdminFixtures,
  FRONTEND_MODE,
  IS_THEME_MODE,
  THEME_ONLY_REASON,
  backendPluginSavedConfig,
  loginAdmin,
  uniqueSlug,
} from './frontend-mode-support';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const FALLBACK_DEFAULT_LANGUAGE = 'en';
// fe-user `vue/src/i18n/locales/de.json` `login.loginButton`, via the basic theme's de.json.
const GERMAN_LOGIN_BUTTON = 'Anmelden';

/**
 * An enabled cms language other than the default. D13 caps the cookie to the cms
 * `enabled_languages`, resolved by cms itself (`GET /admin/cms/languages`).
 */
async function nonDefaultEnabledLanguage(api: APIRequestContext, adminToken: string): Promise<string | undefined> {
  const cmsConfig = await backendPluginSavedConfig(api, adminToken, 'cms');
  const defaultLanguage = String(cmsConfig.default_language ?? '').trim() || FALLBACK_DEFAULT_LANGUAGE;
  const response = await api.get('/api/v1/admin/cms/languages', { headers: { Authorization: `Bearer ${adminToken}` } });
  if (!response.ok()) {
    throw new Error(`cms languages lookup failed: ${response.status()} ${await response.text()}`);
  }
  const { languages } = (await response.json()) as { languages: { code: string }[] };
  return languages.map((language) => language.code).find((code) => code !== defaultLanguage);
}

test.describe(`CMS-defined language (${FRONTEND_MODE})`, () => {
  let api: APIRequestContext;
  let cms: CmsAdminFixtures;
  let englishSlug: string;
  let germanSlug: string;
  let cookieLanguage: string | undefined;
  const germanTitle = uniqueSlug('S152 Deutsche Seite');

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: BASE_URL });
    const adminToken = await loginAdmin(api);
    cms = new CmsAdminFixtures(api, adminToken);
    cookieLanguage = await nonDefaultEnabledLanguage(api, adminToken);
    const translationGroupId = randomUUID();
    englishSlug = (await cms.post({
      title: uniqueSlug('S152 English page'),
      language: 'en',
      translation_group_id: translationGroupId,
      content_html: '<p>English body</p>',
    })).slug;
    germanSlug = (await cms.post({
      title: germanTitle,
      language: 'de',
      translation_group_id: translationGroupId,
      content_html: '<p>Deutscher Inhalt</p>',
    })).slug;
  });

  test.afterAll(async () => {
    await cms?.cleanup();
    await api?.dispose();
  });

  test('a German page renders its content (lang="de" in theme mode)', async ({ page }) => {
    await page.goto(`/${germanSlug}`);

    await expect(page.locator('h1.cms-page__title')).toHaveText(germanTitle);
    await expect(page.locator('.cms-page__body')).toContainText('Deutscher Inhalt');
    if (IS_THEME_MODE) {
      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    }
  });

  test('a German page shows German UI strings (theme mode)', async ({ page, context }) => {
    test.skip(!IS_THEME_MODE, THEME_ONLY_REASON);
    await page.goto(`/${germanSlug}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await context.addCookies([{ name: 'vbwd_lang', value: 'de', url: BASE_URL }]);

    await page.goto('/login');

    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.locator('[data-testid="login-button"]')).toHaveText(GERMAN_LOGIN_BUTTON);
  });

  test('the vbwd_lang cookie sets the language of a language-neutral page', async ({ page, context }) => {
    test.skip(!IS_THEME_MODE, THEME_ONLY_REASON);
    test.skip(cookieLanguage === undefined, 'the cms enables no language besides the default');
    await context.addCookies([{ name: 'vbwd_lang', value: cookieLanguage as string, url: BASE_URL }]);

    await page.goto('/login');

    await expect(page.locator('html')).toHaveAttribute('lang', cookieLanguage as string);
  });

  test('the switcher moves to the translation and remembers the choice', async ({ page, context }) => {
    test.skip(!IS_THEME_MODE, THEME_ONLY_REASON);
    await page.goto(`/${englishSlug}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.locator('[data-testid="language-switch-de"]').click();

    await page.waitForURL(new RegExp(`/${germanSlug}$`));
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    const languageCookie = (await context.cookies()).find((cookie) => cookie.name === 'vbwd_lang');
    expect(languageCookie?.value).toBe('de');
  });
});
