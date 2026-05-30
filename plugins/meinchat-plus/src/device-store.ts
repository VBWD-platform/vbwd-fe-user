// S28.3b §3.2/§3.3 — at-rest persistence of the device's PRIVATE key material.
//
// The identity (Ed25519 + Montgomery X25519), signed prekey, and one-time
// prekeys are serialized to JSON and **sealed under the Argon2id KEK** before
// they touch IndexedDB. The KEK salt is stored UNSEALED (it's needed to derive
// the KEK from the passphrase on unlock; a salt is not secret).

import { fromBase64, toBase64 } from './base64';
import { unwrapSecret, wrapSecret } from './crypto/kek';
import type { IdentityKeys, KeyPair } from './crypto/keys';
import type { KeyValueStore } from './persistence';

const DEVICE_KEY = 'meinchat-plus:device';
const SALT_KEY = 'meinchat-plus:kek-salt';
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface DeviceMaterial {
  deviceId: string;
  userId: string;
  identity: IdentityKeys;
  signedPrekey: KeyPair;
  oneTimePrekeys: KeyPair[];
}

const serKp = (k: KeyPair) => ({ priv: toBase64(k.priv), pub: toBase64(k.pub) });
const deKp = (o: { priv: string; pub: string }): KeyPair => ({
  priv: fromBase64(o.priv),
  pub: fromBase64(o.pub),
});

function serialize(d: DeviceMaterial): string {
  return JSON.stringify({
    deviceId: d.deviceId,
    userId: d.userId,
    identity: { ed25519: serKp(d.identity.ed25519), x25519: serKp(d.identity.x25519) },
    signedPrekey: serKp(d.signedPrekey),
    oneTimePrekeys: d.oneTimePrekeys.map(serKp),
  });
}

function deserialize(json: string): DeviceMaterial {
  const o = JSON.parse(json);
  return {
    deviceId: o.deviceId,
    userId: o.userId,
    identity: { ed25519: deKp(o.identity.ed25519), x25519: deKp(o.identity.x25519) },
    signedPrekey: deKp(o.signedPrekey),
    oneTimePrekeys: (o.oneTimePrekeys as { priv: string; pub: string }[]).map(deKp),
  };
}

export async function saveDevice(
  kv: KeyValueStore,
  kek: Uint8Array,
  device: DeviceMaterial,
): Promise<void> {
  await kv.set(DEVICE_KEY, wrapSecret(kek, enc.encode(serialize(device))));
}

/** Unseal the device material; throws on a wrong KEK (wrong passphrase). */
export async function loadDevice(
  kv: KeyValueStore,
  kek: Uint8Array,
): Promise<DeviceMaterial | null> {
  const sealed = await kv.get(DEVICE_KEY);
  if (!sealed) return null;
  return deserialize(dec.decode(unwrapSecret(kek, sealed)));
}

export async function isPaired(kv: KeyValueStore): Promise<boolean> {
  return (await kv.get(DEVICE_KEY)) !== null;
}

export async function saveSalt(kv: KeyValueStore, salt: Uint8Array): Promise<void> {
  await kv.set(SALT_KEY, salt);
}

export async function loadSalt(kv: KeyValueStore): Promise<Uint8Array | null> {
  return kv.get(SALT_KEY);
}
