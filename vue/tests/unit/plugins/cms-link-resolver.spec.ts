import { describe, it, expect } from 'vitest';
import type { Router } from 'vue-router';
import { classifyLink } from '../../../../plugins/cms/src/utils/cmsLinkResolver';

// Fake router mimicking fe-user's routes: static app routes + the CMS catch-all.
const router = {
  resolve(to: string) {
    const path = String(to).split('?')[0].split('#')[0];
    if (path === '/') return { name: 'home', params: {} };
    if (path === '/login') return { name: 'login', params: {} };
    if (path === '/dashboard') return { name: 'dashboard', params: {} };
    if (path.startsWith('/')) {
      const slug = path.replace(/^\/+/, '');
      return slug ? { name: 'cms-page', params: { slug } } : { name: 'home', params: {} };
    }
    throw new Error(`cannot resolve ${to}`);
  },
} as unknown as Router;

describe('classifyLink', () => {
  it('classifies a local CMS path as cms with its slug', () => {
    expect(classifyLink('/about', router)).toEqual({ kind: 'cms', path: '/about', slug: 'about' });
  });

  it('keeps nested slugs', () => {
    expect(classifyLink('/category/backend', router)).toMatchObject({ kind: 'cms', slug: 'category/backend' });
  });

  it('classifies app routes as app (never prefetched/intercepted)', () => {
    expect(classifyLink('/login', router).kind).toBe('app');
    expect(classifyLink('/dashboard', router).kind).toBe('app');
    expect(classifyLink('/', router).kind).toBe('app');
  });

  it('classifies cross-origin + non-http schemes as external', () => {
    expect(classifyLink('https://example.com/x', router).kind).toBe('external');
    expect(classifyLink('mailto:a@b.com', router).kind).toBe('external');
    expect(classifyLink('tel:123', router).kind).toBe('external');
    expect(classifyLink('relative/page', router).kind).toBe('external');
  });

  it('classifies same-origin absolute URLs by path', () => {
    expect(classifyLink(`${window.location.origin}/about`, router)).toMatchObject({ kind: 'cms', slug: 'about' });
  });

  it('classifies hash links as hash', () => {
    expect(classifyLink('#section', router).kind).toBe('hash');
  });

  it('classifies empty/garbage as invalid', () => {
    expect(classifyLink('', router).kind).toBe('invalid');
    expect(classifyLink(null, router).kind).toBe('invalid');
    expect(classifyLink('#', router).kind).toBe('invalid');
  });
});
