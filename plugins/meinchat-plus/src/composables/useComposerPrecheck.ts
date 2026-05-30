// S28.3b §3.7 — reactive composer precheck for the Vue UI.
//
// Wraps `precheckPeerSecureChat` so a conversation view can disable Send +
// show a hint when the peer has no secure-chat device. `check()` is called on
// open + when the peer changes.

import { ref, unref, type Ref } from 'vue';
import {
  precheckPeerSecureChat,
  type ListDevices,
} from '../composer-precheck';

export function useComposerPrecheck(
  peerUserId: Ref<string> | string,
  peerNickname: Ref<string | null> | string | null,
  listUserDevices: ListDevices,
) {
  const canSend = ref(true);
  const hint = ref('');
  const checking = ref(false);

  async function check(): Promise<void> {
    checking.value = true;
    try {
      const result = await precheckPeerSecureChat(
        unref(peerUserId),
        unref(peerNickname),
        listUserDevices,
      );
      canSend.value = result.canSendSecurely;
      hint.value = result.hint ?? '';
    } finally {
      checking.value = false;
    }
  }

  return { canSend, hint, checking, check };
}
