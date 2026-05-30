// S28.3b §3.3 — device key registration + one-time prekey refill.
//
// Generates the device identity + signed prekey + N one-time prekeys CLIENT
// SIDE and uploads only the PUBLIC material. The returned secret material is
// what the caller persists (wrapped under the passphrase KEK — see crypto/kek).
// The server never sees a private key.

import * as api from './api';
import { toBase64 } from './base64';
import {
  generateIdentity,
  generateOneTimePrekeys,
  generateSignedPrekey,
  type IdentityKeys,
  type KeyPair,
} from './crypto/keys';

const DEFAULT_ONE_TIME = 100;
const ALGORITHM = 'ed25519+x25519_xchacha20poly1305_v1';

export interface RegisteredDevice {
  deviceId: string;
  identity: IdentityKeys; // SECRET — persist wrapped
  signedPrekey: KeyPair; // SECRET
  oneTimePrekeys: KeyPair[]; // SECRET (server holds only the pubs)
}

export async function registerThisDevice(
  label: string,
  oneTimeCount: number = DEFAULT_ONE_TIME,
): Promise<RegisteredDevice> {
  const identity = generateIdentity();
  const device = await api.registerDevice({
    publicKeyB64: toBase64(identity.ed25519.pub),
    algorithm: ALGORITHM,
    label,
  });

  const spk = generateSignedPrekey(identity);
  await api.uploadSignedPrekey({
    deviceId: device.id,
    signedPrekeyB64: toBase64(spk.keyPair.pub),
    signatureB64: toBase64(spk.signature),
  });

  const oneTimePrekeys = generateOneTimePrekeys(oneTimeCount);
  await api.uploadOneTimePrekeys(
    device.id,
    oneTimePrekeys.map((k) => toBase64(k.pub)),
  );

  return { deviceId: device.id, identity, signedPrekey: spk.keyPair, oneTimePrekeys };
}

/** Top up the device's one-time prekeys when the server signalled low-water. */
export async function refillOneTimePrekeys(
  deviceId: string,
  count: number = DEFAULT_ONE_TIME,
): Promise<KeyPair[]> {
  const fresh = generateOneTimePrekeys(count);
  await api.uploadOneTimePrekeys(
    deviceId,
    fresh.map((k) => toBase64(k.pub)),
  );
  return fresh;
}
