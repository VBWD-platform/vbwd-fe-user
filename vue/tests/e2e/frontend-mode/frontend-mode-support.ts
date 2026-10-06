/**
 * S152-11 — Playwright helpers shared by the frontend-mode specs: which renderer
 * served a page, logins, and CMS fixtures seeded through the cms admin API (no
 * raw SQL; every spec removes what it created).
 */
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { readFrontendMode, type FrontendMode } from './frontend-mode-contract';

export const FRONTEND_MODE: FrontendMode = readFrontendMode(process.env.E2E_FRONTEND_MODE);
export const IS_THEME_MODE = FRONTEND_MODE === 'theme';
export const THEME_ONLY_REASON = 'theme-mode only (E2E_FRONTEND_MODE=theme)';

/** The marker every themed document carries (basic `_shared/document.html.j2`). */
export const THEME_META_SELECTOR = 'meta[name="vbwd-frontend"][content="theme"]';
const THEME_META_PATTERN = /<meta\s+name="vbwd-frontend"\s+content="theme"\s*\/?>/;
/** nginx routes only text/html GET/HEAD navigations to the backend first (D5). */
export const HTML_NAVIGATION_HEADERS = { Accept: 'text/html,application/xhtml+xml' };
export const MODE_PROBE_PATH = '/_render/_theme/mode';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'AdminPass123@';
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL ?? 'test@example.com',
  password: process.env.TEST_USER_PASSWORD ?? 'TestPass123@',
};

export function containsThemeMeta(html: string): boolean {
  return THEME_META_PATTERN.test(html);
}

/** Asserts which renderer served the current document. */
export async function expectRenderedBy(page: Page, expectedMode: FrontendMode): Promise<void> {
  await expect(page.locator(THEME_META_SELECTOR)).toHaveCount(expectedMode === 'theme' ? 1 : 0);
}

/** The server's HTML for a navigation to `path`, as nginx answers a browser. */
export async function fetchNavigationHtml(request: APIRequestContext, path: string): Promise<string> {
  const response = await request.get(path, { headers: HTML_NAVIGATION_HEADERS, maxRedirects: 0 });
  return response.text();
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function loginThroughApi(request: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await request.post('/api/v1/auth/login', { data: { email, password } });
  if (!response.ok()) {
    throw new Error(`login failed for ${email}: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  return body.token ?? body.access_token;
}

export function loginAdmin(request: APIRequestContext): Promise<string> {
  return loginThroughApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
}

/** Logs the test user in through the `/login` form (SPA or themed — same testids, D2). */
export async function loginTestUserInBrowser(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', TEST_USER.email);
  await page.fill('[data-testid="password"]', TEST_USER.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

/** The admin plugin detail reports the persisted state as `active` / `inactive`. */
const ADMIN_PLUGIN_ACTIVE_STATUS = 'active';

export async function isBackendPluginEnabled(
  request: APIRequestContext,
  adminToken: string,
  pluginName: string,
): Promise<boolean> {
  const response = await request.get(`/api/v1/admin/plugins/${pluginName}`, {
    headers: authHeaders(adminToken),
  });
  if (!response.ok()) return false;
  return (await response.json()).status === ADMIN_PLUGIN_ACTIVE_STATUS;
}

/** The saved config of a backend plugin (`{}` when nothing is saved). */
export async function backendPluginSavedConfig(
  request: APIRequestContext,
  adminToken: string,
  pluginName: string,
): Promise<Record<string, unknown>> {
  const response = await request.get(`/api/v1/admin/plugins/${pluginName}`, {
    headers: authHeaders(adminToken),
  });
  if (!response.ok()) {
    throw new Error(`plugin ${pluginName} lookup failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()).savedConfig ?? {};
}

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function encodedHtml(html: string): string {
  return Buffer.from(html, 'utf-8').toString('base64');
}

export interface CmsLayoutAssignment {
  widget_id: string;
  area_name: string;
  sort_order: number;
  required_access_level_ids?: string[];
}

/** Creates cms posts/widgets/layouts as the admin and deletes them again on `cleanup()`. */
export class CmsAdminFixtures {
  private readonly createdPostIds: string[] = [];
  private readonly createdLayoutIds: string[] = [];
  private readonly createdWidgetIds: string[] = [];

  constructor(
    private readonly request: APIRequestContext,
    private readonly adminToken: string,
  ) {}

  private async send(method: 'POST' | 'PUT', path: string, data: unknown): Promise<Record<string, any>> {
    const response = await this.request.fetch(`/api/v1/admin/cms${path}`, {
      method,
      data,
      headers: authHeaders(this.adminToken),
    });
    if (!response.ok()) {
      throw new Error(`cms admin ${method} ${path} failed: ${response.status()} ${await response.text()}`);
    }
    return response.json();
  }

  async post(fields: Record<string, unknown>): Promise<Record<string, any>> {
    const post = await this.send('POST', '/posts', {
      type: 'page',
      status: 'published',
      title: uniqueSlug('S152 page'),
      slug: uniqueSlug('s152-page'),
      ...fields,
    });
    this.createdPostIds.push(post.id);
    return post;
  }

  async htmlWidget(html: string): Promise<Record<string, any>> {
    const widget = await this.send('POST', '/widgets', {
      name: uniqueSlug('S152 widget'),
      slug: uniqueSlug('s152-widget'),
      widget_type: 'html',
      content_json: { content: encodedHtml(html) },
    });
    this.createdWidgetIds.push(widget.id);
    return widget;
  }

  async layout(areas: { name: string; type: string }[], assignments: CmsLayoutAssignment[]): Promise<Record<string, any>> {
    const layout = await this.send('POST', '/layouts', {
      name: uniqueSlug('S152 layout'),
      slug: uniqueSlug('s152-layout'),
      areas,
    });
    this.createdLayoutIds.push(layout.id);
    await this.send('PUT', `/layouts/${layout.id}/widgets`, assignments);
    return layout;
  }

  async cleanup(): Promise<void> {
    const headers = authHeaders(this.adminToken);
    for (const postId of this.createdPostIds) {
      await this.request.delete(`/api/v1/admin/cms/posts/${postId}`, { headers });
    }
    for (const layoutId of this.createdLayoutIds) {
      await this.request.delete(`/api/v1/admin/cms/layouts/${layoutId}`, { headers });
    }
    for (const widgetId of this.createdWidgetIds) {
      await this.request.delete(`/api/v1/admin/cms/widgets/${widgetId}`, { headers });
    }
  }
}

/** `{slug: id}` of the core access levels (`new` = anonymous, `logged-in` = default user level). */
export async function accessLevelIdsBySlug(
  request: APIRequestContext,
  adminToken: string,
): Promise<Record<string, string>> {
  const response = await request.get('/api/v1/admin/access/levels', { headers: authHeaders(adminToken) });
  if (!response.ok()) {
    throw new Error(`access levels lookup failed: ${response.status()} ${await response.text()}`);
  }
  const { levels } = (await response.json()) as { levels: { id: string; slug: string }[] };
  return Object.fromEntries(levels.map((level) => [level.slug, level.id]));
}
