import { describe, it, expect } from 'vitest';
import type { Router } from 'vue-router';
import {
  isPlainLeftClick,
  resolveAnchorNavigation,
} from '../../../../plugins/cms/src/composables/useCmsSpaLinks';

const router = {
  resolve(to: string) {
    const path = String(to).split('?')[0].split('#')[0];
    if (path === '/login') return { name: 'login', params: {} };
    if (path.startsWith('/')) return { name: 'cms-page', params: { slug: path.replace(/^\/+/, '') } };
    throw new Error('unresolved');
  },
} as unknown as Router;

function anchor(attrs: Record<string, string>): HTMLAnchorElement {
  const element = document.createElement('a');
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element as HTMLAnchorElement;
}

describe('isPlainLeftClick', () => {
  it('true only for an unmodified left click', () => {
    expect(isPlainLeftClick({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false } as MouseEvent)).toBe(true);
    expect(isPlainLeftClick({ button: 1, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false } as MouseEvent)).toBe(false);
    expect(isPlainLeftClick({ button: 0, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false } as MouseEvent)).toBe(false);
    expect(isPlainLeftClick({ button: 0, metaKey: false, ctrlKey: true, shiftKey: false, altKey: false } as MouseEvent)).toBe(false);
  });
});

describe('resolveAnchorNavigation', () => {
  it('returns the path for a local CMS anchor', () => {
    expect(resolveAnchorNavigation(anchor({ href: '/about' }), router)).toBe('/about');
  });

  it('returns null for target=_blank, download, external, app route, hash', () => {
    expect(resolveAnchorNavigation(anchor({ href: '/about', target: '_blank' }), router)).toBeNull();
    expect(resolveAnchorNavigation(anchor({ href: '/about', download: '' }), router)).toBeNull();
    expect(resolveAnchorNavigation(anchor({ href: 'https://x.com' }), router)).toBeNull();
    expect(resolveAnchorNavigation(anchor({ href: '/login' }), router)).toBeNull();
    expect(resolveAnchorNavigation(anchor({ href: '#x' }), router)).toBeNull();
  });
});
