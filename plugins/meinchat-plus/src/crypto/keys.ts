// S28.3b §3.1 / §3.3 — key material + AEAD primitives (browser-safe, audited).
//
// Uses @noble (pure-JS, browser + node, no native/wasm) instead of
// `@signalapp/libsignal-client`, which is a Node-native addon and does NOT run
// in a browser. Primitives:
//   - X25519  — ECDH key agreement (identity, signed prekey, one-time prekeys)
//   - Ed25519 — signs the signed prekey under the device identity key
//   - ChaCha20-Poly1305 — AEAD for message + key-envelope encryption
//   - HKDF-SHA256 — key derivation
//
// The server stores only PUBLIC keys; private keys never leave the client.

import {
  x25519,
  ed25519,
  edwardsToMontgomeryPub,
  edwardsToMontgomeryPriv,
} from '@noble/curves/ed25519';
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/hashes/utils';

const NONCE_BYTES = 12;

export interface KeyPair {
  priv: Uint8Array;
  pub: Uint8Array;
}

// The device identity is a single Ed25519 key: its PUBLIC half is what the
// server stores as the device `public_key` and verifies signed-prekey
// signatures against, and its Montgomery (X25519) projection is used for X3DH
// ECDH — the standard Signal "one identity key, two uses" arrangement.
export interface IdentityKeys {
  ed25519: KeyPair; // registered identity + signing key
  x25519: KeyPair; // Montgomery projection of the identity, for ECDH
}

export function generateX25519(): KeyPair {
  const priv = x25519.utils.randomPrivateKey();
  return { priv, pub: x25519.getPublicKey(priv) };
}

export function generateEd25519(): KeyPair {
  const priv = ed25519.utils.randomPrivateKey();
  return { priv, pub: ed25519.getPublicKey(priv) };
}

/** X25519 agreement public key for a peer's Ed25519 identity (from the bundle). */
export function montgomeryPubFromEd25519(ed25519Pub: Uint8Array): Uint8Array {
  return edwardsToMontgomeryPub(ed25519Pub);
}

export function generateIdentity(): IdentityKeys {
  const ed = generateEd25519();
  const x: KeyPair = {
    priv: edwardsToMontgomeryPriv(ed.priv),
    pub: edwardsToMontgomeryPub(ed.pub),
  };
  return { ed25519: ed, x25519: x };
}

/** A signed prekey: an X25519 prekey signed by the device's Ed25519 identity. */
export function generateSignedPrekey(identity: IdentityKeys): {
  keyPair: KeyPair;
  signature: Uint8Array;
} {
  const keyPair = generateX25519();
  const signature = ed25519.sign(keyPair.pub, identity.ed25519.priv);
  return { keyPair, signature };
}

export function verifySignedPrekey(
  prekeyPub: Uint8Array,
  signature: Uint8Array,
  identityEd25519Pub: Uint8Array,
): boolean {
  try {
    return ed25519.verify(signature, prekeyPub, identityEd25519Pub);
  } catch {
    return false;
  }
}

export function generateOneTimePrekeys(count: number): KeyPair[] {
  return Array.from({ length: count }, () => generateX25519());
}

/** X25519 ECDH shared secret. */
export function dh(priv: Uint8Array, pub: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(priv, pub);
}

/** AEAD seal: returns nonce(12) ‖ ciphertext+tag. */
export function aeadSeal(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad?: Uint8Array,
): Uint8Array {
  const nonce = randomBytes(NONCE_BYTES);
  const ct = chacha20poly1305(key, nonce, aad).encrypt(plaintext);
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce, 0);
  out.set(ct, nonce.length);
  return out;
}

/** AEAD open: input is nonce(12) ‖ ciphertext+tag. Throws on tamper. */
export function aeadOpen(
  key: Uint8Array,
  sealed: Uint8Array,
  aad?: Uint8Array,
): Uint8Array {
  if (sealed.length < NONCE_BYTES + 16) throw new Error('aeadOpen: too short');
  const nonce = sealed.slice(0, NONCE_BYTES);
  const ct = sealed.slice(NONCE_BYTES);
  return chacha20poly1305(key, nonce, aad).decrypt(ct);
}

export { randomBytes };
