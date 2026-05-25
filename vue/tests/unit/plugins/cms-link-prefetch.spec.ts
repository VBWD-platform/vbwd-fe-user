import { describe, it, expect } from 'vitest';
import type { Router } from 'vue-router';
import { prefetchSlugFor } from '../../../../plugins/cms/src/composables/useCmsLinkPrefetch';

const router = {
  resolve(to: string) {
    const path = String(to).split('?')[0].split('#')[0];
    if (path === '/login') return { name: 'login', params: {} };
    if (path.startsWith('/')) return { name: 'cms-page', params: { slug: path.replace(/^\/+/, '') } };
    throw new Error('unresolved');
  },
} as unknown as Router;

describe('prefetchSlugFor', () => {
  it('returns the slug for a local CMS link', () => {
    expect(prefetchSlugFor('/about', router)).toBe('about');
    expect(prefetchSlugFor('/category/backend', router)).toBe('category/backend');
  });

  it('returns null for app routes, external links and hashes', () => {
    expect(prefetchSlugFor('/login', router)).toBeNull();
    expect(prefetchSlugFor('https://x.com', router)).toBeNull();
    expect(prefetchSlugFor('#section', router)).toBeNull();
    expect(prefetchSlugFor('', router)).toBeNull();
  });
});
