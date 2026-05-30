// vbwd-fe-user-plugin-meinchat-plus — E2E (Signal-ratchet) overlay for the
// meinchat web client. The CRYPTO is the substance of this plugin and is
// fully implemented + unit-tested under `src/crypto/` (X3DH + Double Ratchet
// via audited @noble primitives — NOT `@signalapp/libsignal-client`, which is
// Node-native and unusable in a browser).
//
// Send/read are wired through the meinchat store's crypto-provider seam
// (`registerMessageCrypto`). `registerCryptoProvider()` is the single hook the
// app's pairing flow calls once the device identity + session store are ready;
// until then secure SEND fails closed in the store.

import type { IPlugin, IPlatformSDK } from 'vbwd-view-component';
import {
  registerMessageCrypto,
  unregisterMessageCrypto,
} from '../meinchat/src/crypto/messageCryptoRegistry';
import {
  registerComposerPrecheck,
  registerConversationOverlay,
  resetConversationExtensions,
} from '../meinchat/src/ui/conversationExtensions';
import {
  MeinchatPlusProvider,
  type ProviderApi,
  type SelfDevice,
  type SessionStore,
} from './src/provider';
import SecureChatGate from './src/components/SecureChatGate.vue';
import { precheckPeerSecureChat } from './src/composer-precheck';
import * as plusApi from './src/api';
import en from './locales/en.json';

// Public surface — consumed by the meinchat store seam + tests.
export * as crypto from './src/crypto/messaging';
export * as attachment from './src/crypto/attachment';
export * as keys from './src/crypto/keys';
export * as kek from './src/crypto/kek';
export * as ratchet from './src/crypto/ratchet';
export * as x3dh from './src/crypto/x3dh';
export * as api from './src/api';
export { registerThisDevice, refillOneTimePrekeys } from './src/registration';
export { assertE2e, ProtocolDowngradeError } from './src/downgrade';
export { precheckPeerSecureChat } from './src/composer-precheck';
export type { PrecheckResult } from './src/composer-precheck';

// Vue glue — components + composables the conversation/profile views wire up.
export { default as PairingSheet } from './src/components/PairingSheet.vue';
export { usePairing } from './src/composables/usePairing';
export type { PairingStatus, UsePairing, UsePairingOptions } from './src/composables/usePairing';
export { useComposerPrecheck } from './src/composables/useComposerPrecheck';
export {
  encryptAndUploadAttachment,
  downloadAndDecryptAttachment,
} from './src/attachment-transport';
export type { AttachmentApi } from './src/attachment-transport';
export { MeinchatPlusProvider } from './src/provider';
export type { ProviderApi, SelfDevice, SessionStore } from './src/provider';
export { SessionManager } from './src/session';
export type { OwnDeviceMaterial, BundleApi, PrekeyBundle } from './src/session';
export {
  InMemoryKeyValueStore,
  createIdbKeyValueStore,
  loadSessions,
  saveSessions,
} from './src/persistence';
export type { KeyValueStore } from './src/persistence';

// Pairing — the high-level entry points the app calls: first-pair (set a
// passphrase) and unlock (returning user). Both register the crypto provider
// into the meinchat store seam, so secure send/read "just work" afterwards.
export {
  pairNewDevice,
  unlockDevice,
  isPaired,
  NotPairedError,
  WrongPassphraseError,
} from './src/pairing';
export type { PairedSession, PairDeps, UnlockDeps } from './src/pairing';

/** Build the e2e provider and register it into the meinchat store seam. Call
 *  once the device is paired (identity loaded + session store ready). Returns
 *  the unregister fn. */
export function registerCryptoProvider(
  self: SelfDevice,
  providerApi: ProviderApi,
  sessions: SessionStore,
): () => void {
  registerMessageCrypto(new MeinchatPlusProvider(self, providerApi, sessions));
  return unregisterMessageCrypto;
}

export const meinchatPlusPlugin: IPlugin = {
  name: 'meinchat-plus',
  version: '1.0.0',
  description:
    'End-to-end encrypted chat (Signal-style ratchet) on top of meinchat. ' +
    'Clients encrypt; the server stores opaque envelopes only.',
  _active: false,

  install(sdk: IPlatformSDK) {
    sdk.addTranslations('en', en);
  },

  activate() {
    this._active = true;
    // Fill meinchat's conversation UI seams: the secure-chat pairing gate +
    // the composer precheck. The crypto PROVIDER itself is registered by the
    // gate's pairing flow once the device is unlocked (it has no keys yet).
    registerConversationOverlay(SecureChatGate);
    registerComposerPrecheck(async (conv) => {
      if (conv.protocol !== 'e2e_v1') return { canSend: true };
      const result = await precheckPeerSecureChat(
        conv.peer_user_id,
        conv.peer_nickname,
        plusApi.listUserDevices,
      );
      return { canSend: result.canSendSecurely, hint: result.hint };
    });
  },

  deactivate() {
    this._active = false;
    unregisterMessageCrypto();
    resetConversationExtensions();
  },
};
