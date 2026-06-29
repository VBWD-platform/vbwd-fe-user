// vbwd-fe-user-plugin-cms-youtube — the worked extension example for S47.3.
//
// Proves media-extensibility (master D10): a NEW media kind is added purely by
// registering a renderer on the cms content-type registry — zero cms change.
// On install it registers `youtube` at placement `top`, so any post with a
// `youtube` block shows the embed as the topmost element. Named-export plugin.
import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';
import {
  registerPostContentType,
  unregisterPostContentType,
} from '../cms/src/registry/contentTypeRegistry';
import YouTubeEmbed from './src/components/YouTubeEmbed.vue';
import en from './locales/en.json';

export const cmsYoutubePlugin: IPlugin = {
  name: 'cms-youtube',
  version: '26.6.1',
  description: 'YouTube content-block renderer for the cms unified post body',
  dependencies: ['cms'],
  _active: false,

  install(sdk: IPlatformSDK) {
    registerPostContentType('youtube', YouTubeEmbed, { placement: 'top' });
    sdk.addTranslations('en', en);
  },

  activate() {
    this._active = true;
  },

  deactivate() {
    // Narrow teardown — removes only the `youtube` renderer. cms's built-in
    // `richtext` (and every other plugin's registration) is untouched: proving
    // the seam needs no cms change to add or remove a media kind.
    this._active = false;
    unregisterPostContentType('youtube');
  },
};
