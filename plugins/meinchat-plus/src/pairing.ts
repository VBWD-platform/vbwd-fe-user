// S28.3b §3.3 — pairing: the end-to-end flow that makes E2E work in the app.
//
// FIRST PAIR (set a passphrase): derive the Argon2id KEK, generate + register
// the device keys, persist the device material (sealed) + salt (unsealed),
// build a SessionManager, and register the crypto provider into the meinchat
// store seam. UNLOCK (returning user): re-derive the KEK from the passphrase +
// salt, unseal the device + sessions, register the provider. `lock()` tears it
// down; `saveSessions()` snapshots ratchet state after activity.

import {
  registerMessageCrypto,
  unregisterMessageCrypto,
} from '../../meinchat/src/crypto/messageCryptoRegistry';
import { deriveKek, newSalt, type KekParams } from './crypto/kek';
import {
  isPaired,
  loadDevice,
  loadSalt,
  saveDevice,
  saveSalt,
  type DeviceMaterial,
} from './device-store';
import { loadSessions, saveSessions, type KeyValueStore } from './persistence';
import { MeinchatPlusProvider, type ProviderApi } from './provider';
import { registerThisDevice, type RegisteredDevice } from './registration';
import { BundleApi, SessionManager } from './session';
import { downloadAttachment, uploadAttachment } from './api';

export { isPaired } from './device-store';

export interface PairedSession {
  deviceId: string;
  sessions: SessionManager;
  /** Snapshot live ratchet sessions to storage (call after sends/reads). */
  saveSessions(): Promise<void>;
  /** Unregister the provider + drop the in-memory KEK. */
  lock(): void;
}

export interface PairDeps {
  kv: KeyValueStore;
  passphrase: string;
  userId: string;
  providerApi: ProviderApi;
  bundleApi: BundleApi;
  label?: string;
  /** Override device registration (defaults to the real `registerThisDevice`). */
  register?: (label: string) => Promise<RegisteredDevice>;
  kekParams?: KekParams;
}

export interface UnlockDeps {
  kv: KeyValueStore;
  passphrase: string;
  userId: string;
  providerApi: ProviderApi;
  bundleApi: BundleApi;
  kekParams?: KekParams;
}

function activate(
  device: DeviceMaterial,
  kv: KeyValueStore,
  kek: Uint8Array,
  userId: string,
  providerApi: ProviderApi,
  bundleApi: BundleApi,
): PairedSession {
  const sessions = new SessionManager(
    {
      identity: device.identity,
      signedPrekey: device.signedPrekey,
      oneTimePrekeys: device.oneTimePrekeys,
    },
    bundleApi,
  );
  registerMessageCrypto(
    new MeinchatPlusProvider(
      { deviceId: device.deviceId, userId },
      providerApi,
      sessions,
      { attachmentApi: { uploadAttachment, downloadAttachment } },
    ),
  );
  return {
    deviceId: device.deviceId,
    sessions,
    async saveSessions() {
      await saveSessions(kv, kek, sessions.serializeAll());
    },
    lock() {
      unregisterMessageCrypto();
      kek.fill(0);
    },
  };
}

/** First pairing on this device. Generates + registers keys, persists them
 *  sealed under a passphrase-derived KEK, and activates secure chat. */
export async function pairNewDevice(deps: PairDeps): Promise<PairedSession> {
  const salt = newSalt();
  const kek = await deriveKek(deps.passphrase, salt, deps.kekParams);
  const reg = await (deps.register ?? registerThisDevice)(deps.label ?? 'web');

  const device: DeviceMaterial = {
    deviceId: reg.deviceId,
    userId: deps.userId,
    identity: reg.identity,
    signedPrekey: reg.signedPrekey,
    oneTimePrekeys: reg.oneTimePrekeys,
  };
  await saveSalt(deps.kv, salt);
  await saveDevice(deps.kv, kek, device);

  return activate(device, deps.kv, kek, deps.userId, deps.providerApi, deps.bundleApi);
}

export class NotPairedError extends Error {
  constructor() {
    super('no paired device on this browser');
    this.name = 'NotPairedError';
  }
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('wrong passphrase');
    this.name = 'WrongPassphraseError';
  }
}

/** Unlock an already-paired device with the passphrase, restoring sessions. */
export async function unlockDevice(deps: UnlockDeps): Promise<PairedSession> {
  const salt = await loadSalt(deps.kv);
  if (!salt || !(await isPaired(deps.kv))) throw new NotPairedError();

  const kek = await deriveKek(deps.passphrase, salt, deps.kekParams);
  let device: DeviceMaterial | null;
  try {
    device = await loadDevice(deps.kv, kek);
  } catch {
    throw new WrongPassphraseError(); // AEAD open failed
  }
  if (!device) throw new NotPairedError();

  const session = activate(
    device,
    deps.kv,
    kek,
    deps.userId,
    deps.providerApi,
    deps.bundleApi,
  );
  session.sessions.loadAll(await loadSessions(deps.kv, kek));
  return session;
}
