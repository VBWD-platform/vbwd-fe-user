const API = '/api/v1/ghrm';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function get<T>(url: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const resp = await fetch(url + qs, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`GET ${url} failed: ${resp.status}`);
  return resp.json();
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `POST ${url} failed: ${resp.status}`);
  }
  return resp.json();
}

async function del(url: string): Promise<void> {
  const resp = await fetch(url, { method: 'DELETE', headers: authHeaders() });
  if (!resp.ok) throw new Error(`DELETE ${url} failed: ${resp.status}`);
}

export interface GhrmPackage {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  author_name: string | null;
  icon_url: string | null;
  github_owner: string;
  github_repo: string;
  github_protected_branch: string;
  download_counter: number;
  readme: string | null;
  changelog: string | null;
  docs: string | null;
  screenshots: { url: string; caption: string }[];
  cached_releases: { tag: string; date: string; notes: string; assets: { name: string; url: string }[] }[];
  latest_version: string | null;
  latest_released_at: string | null;
  last_synced_at: string | null;
  related_slugs: string[];
}

export interface GhrmPackageListItem {
  id: string;
  slug: string;
  name: string;
  author_name: string | null;
  icon_url: string | null;
  download_counter: number;
  latest_version: string | null;
}

export interface GhrmPaginated<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface GhrmInstallInstructions {
  package_slug: string;
  deploy_token: string;
  npm: string;
  composer: string;
  pip: string;
  git: string;
}

export interface GhrmAccessStatus {
  connected: boolean;
  github_username?: string;
  access_status?: string;
  grace_expires_at?: string | null;
}

export interface GhrmCategory {
  slug: string;
  label: string;
}

export const ghrmApi = {
  getCategories(): Promise<{ categories: GhrmCategory[] }> {
    return get(`${API}/categories`);
  },
  listPackages(params: Record<string, string> = {}): Promise<GhrmPaginated<GhrmPackageListItem>> {
    return get(`${API}/packages`, params);
  },
  getPackage(slug: string): Promise<GhrmPackage> {
    return get(`${API}/packages/${slug}`);
  },
  getRelated(slug: string): Promise<GhrmPackageListItem[]> {
    return get(`${API}/packages/${slug}/related`);
  },
  getVersions(slug: string): Promise<{ tag: string; date: string; notes: string; assets: { name: string; url: string }[] }[]> {
    return get(`${API}/packages/${slug}/versions`);
  },
  getInstallInstructions(slug: string): Promise<GhrmInstallInstructions> {
    return get(`${API}/packages/${slug}/install`);
  },
  getAccessStatus(): Promise<GhrmAccessStatus> {
    return get(`${API}/access`);
  },
  getOAuthUrl(): Promise<{ url: string }> {
    return get(`${API}/auth/github`);
  },
  handleOAuthCallback(code: string, state: string): Promise<GhrmAccessStatus> {
    return post(`${API}/auth/github/callback`, { code, state });
  },
  disconnect(): Promise<void> {
    return del(`${API}/auth/github`);
  },
};
