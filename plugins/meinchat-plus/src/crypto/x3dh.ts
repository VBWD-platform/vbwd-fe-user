// S28.3b §3 — X3DH key agreement (Signal spec, 1:1).
//
// Establishes the shared secret SK that seeds the Double Ratchet. The
// initiator (A) uses the recipient (B)'s published prekey bundle; the
// responder (B) reconstructs the same SK from A's identity + ephemeral keys.
// DH terms are concatenated in a fixed order so both sides derive the same SK.

import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { dh, type KeyPair } from './keys';

const INFO = new TextEncoder().encode('MeinChatPlus_X3DH_v1');

export interface PeerBundle {
  identityX25519: Uint8Array; // IK_B (agreement pub)
  signedPrekey: Uint8Array; // SPK_B
  oneTimePrekey?: Uint8Array | null; // OPK_B (optional)
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function kdf(ikm: Uint8Array): Uint8Array {
  // 32-byte SK; a 0x00*32 salt is the X3DH convention.
  return hkdf(sha256, ikm, new Uint8Array(32), INFO, 32);
}

/** Initiator side: A → B. Returns SK + the ephemeral pub A must send. */
export function deriveInitiatorSecret(
  identityX25519: KeyPair, // IK_A
  ephemeral: KeyPair, // EK_A (fresh per session)
  peer: PeerBundle,
): { sharedSecret: Uint8Array; ephemeralPub: Uint8Array } {
  const dh1 = dh(identityX25519.priv, peer.signedPrekey);
  const dh2 = dh(ephemeral.priv, peer.identityX25519);
  const dh3 = dh(ephemeral.priv, peer.signedPrekey);
  const terms = [dh1, dh2, dh3];
  if (peer.oneTimePrekey) terms.push(dh(ephemeral.priv, peer.oneTimePrekey));
  return { sharedSecret: kdf(concat(terms)), ephemeralPub: ephemeral.pub };
}

/** Responder side: B receives A's IK_A + EK_A. Mirrors the DH terms. */
export function deriveResponderSecret(
  identityX25519: KeyPair, // IK_B
  signedPrekey: KeyPair, // SPK_B
  oneTimePrekey: KeyPair | null, // OPK_B (the one A consumed)
  initiatorIdentityPub: Uint8Array, // IK_A
  initiatorEphemeralPub: Uint8Array, // EK_A
): { sharedSecret: Uint8Array } {
  const dh1 = dh(signedPrekey.priv, initiatorIdentityPub);
  const dh2 = dh(identityX25519.priv, initiatorEphemeralPub);
  const dh3 = dh(signedPrekey.priv, initiatorEphemeralPub);
  const terms = [dh1, dh2, dh3];
  if (oneTimePrekey) terms.push(dh(oneTimePrekey.priv, initiatorEphemeralPub));
  return { sharedSecret: kdf(concat(terms)) };
}
