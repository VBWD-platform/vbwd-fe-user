import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import type { IPlatformSDK } from 'vbwd-view-component';
import { cmsYoutubePlugin } from '../../index';
import YouTubeEmbed from '../../src/components/YouTubeEmbed.vue';
import {
  registerPostContentType,
  resolvePostContentType,
  resetPostContentTypes,
} from '../../../cms/src/registry/contentTypeRegistry';

function fakeSdk(): IPlatformSDK {
  return {
    addRoute: () => undefined,
    addTranslations: () => undefined,
    addRouterGuard: () => undefined,
    createStore: () => undefined,
  } as unknown as IPlatformSDK;
}

describe('cms-youtube plugin', () => {
  beforeEach(() => {
    resetPostContentTypes();
  });

  it('registers the "youtube" content type with placement "top" on install', () => {
    cmsYoutubePlugin.install?.(fakeSdk());
    const entry = resolvePostContentType('youtube');
    expect(entry).toBeDefined();
    expect(entry?.component).toBe(YouTubeEmbed);
    expect(entry?.placement).toBe('top');
  });

  it('uses a named export (no default-export reliance)', () => {
    expect(cmsYoutubePlugin.name).toBe('cms-youtube');
    expect(typeof cmsYoutubePlugin.install).toBe('function');
  });

  it('deactivate removes only the youtube type — cms built-ins untouched (no cms change)', () => {
    const richtext = { name: 'rt' } as unknown as typeof YouTubeEmbed;
    registerPostContentType('richtext', richtext, { placement: 'inline' });
    cmsYoutubePlugin.install?.(fakeSdk());
    expect(resolvePostContentType('youtube')).toBeDefined();

    cmsYoutubePlugin.deactivate?.();

    expect(resolvePostContentType('youtube')).toBeUndefined();
    // cms's richtext registration survives the youtube teardown.
    expect(resolvePostContentType('richtext')).toBeDefined();
  });
});

describe('YouTubeEmbed', () => {
  function mountEmbed(data: Record<string, unknown>) {
    return mount(YouTubeEmbed, { props: { data } });
  }

  it('builds a privacy-friendly nocookie src from a bare video_id', () => {
    const wrapper = mountEmbed({ video_id: 'dQw4w9WgXcQ', title: 'Demo' });
    const iframe = wrapper.find('iframe');
    expect(iframe.attributes('src')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
  });

  it('extracts the video id from a full watch URL', () => {
    const wrapper = mountEmbed({ url: 'https://www.youtube.com/watch?v=abc123XYZ_-' });
    expect(wrapper.find('iframe').attributes('src')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123XYZ_-',
    );
  });

  it('extracts the video id from a youtu.be short URL', () => {
    const wrapper = mountEmbed({ url: 'https://youtu.be/abc123XYZ_-' });
    expect(wrapper.find('iframe').attributes('src')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123XYZ_-',
    );
  });

  it('lazy-loads the iframe and sets a title for a11y', () => {
    const wrapper = mountEmbed({ video_id: 'dQw4w9WgXcQ', title: 'My Video' });
    const iframe = wrapper.find('iframe');
    expect(iframe.attributes('loading')).toBe('lazy');
    expect(iframe.attributes('title')).toBe('My Video');
  });

  it('wraps the iframe in a 16:9 responsive box', () => {
    const wrapper = mountEmbed({ video_id: 'dQw4w9WgXcQ' });
    expect(wrapper.find('.cms-youtube').exists()).toBe(true);
  });

  it('renders nothing usable (no iframe) when given no id (graceful)', () => {
    const wrapper = mountEmbed({});
    expect(wrapper.find('iframe').exists()).toBe(false);
  });
});
