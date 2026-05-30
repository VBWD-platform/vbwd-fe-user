// S28.3b §3 — Double Ratchet (Signal spec, in-order variant).
//
// Per-message forward secrecy: a symmetric KDF chain advances on every
// message (old message keys are discarded), and a DH ratchet step re-keys the
// root whenever a new ratchet public key arrives. Header is sent in the clear
// in the envelope slot's `header` field (this is the basic DR, not the
// header-encrypted variant) and is bound into the AEAD associated data, so
// tampering with it fails decryption.
//
// Out-of-order / skipped delivery is tolerated via the Signal MKSKIPPED cache
// (`state.skipped`, bounded by MAX_SKIP): keys for messages the chain advances
// past are stored single-use, and a header that would skip more than MAX_SKIP
// is rejected. See `docs/crypto-audit.md` for the threat model.

import { hkdf } from '@noble/hashes/hkdf';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { Encoder } from 'cbor-x';
import { toBase64 } from '../base64';
import { aeadOpen, aeadSeal, dh, generateX25519, type KeyPair } from './keys';

const RK_INFO = new TextEncoder().encode('MeinChatPlus_RK_v1');
const headerCodec = new Encoder({ useRecords: false, tagUint8Array: false });

// X3DH establishment material carried in the FIRST message of a session (a
// "prekey message"), so a responder with no session can cold-start. All
// public material; it is sent in the clear in the header and bound into the
// AEAD AD (tampering fails decryption).
export interface X3dhInit {
  ik: Uint8Array; // sender (initiator) Ed25519 identity pub
  ek: Uint8Array; // sender ephemeral X25519 pub
  spk: Uint8Array; // responder signed-prekey pub that was used
  otk?: Uint8Array | null; // responder one-time-prekey pub that was consumed
}

export interface RatchetHeader {
  dh: Uint8Array; // sender's current ratchet public key
  pn: number; // # messages in the previous sending chain
  n: number; // message number in the current sending chain
  x3dh?: X3dhInit | null; // present only on a session's first (prekey) message
}

export interface RatchetState {
  rootKey: Uint8Array;
  dhSelf: KeyPair;
  dhRemote: Uint8Array | null;
  sendChainKey: Uint8Array | null;
  recvChainKey: Uint8Array | null;
  sendN: number;
  recvN: number;
  prevSendN: number;
  // Skipped message keys, keyed by `base64(ratchet pub):n`, so out-of-order /
  // skipped messages still decrypt (Signal MKSKIPPED). Bounded by MAX_SKIP.
  skipped: Map<string, Uint8Array>;
}

// Cap stored skipped keys to bound memory + reject a malicious huge-`n` header.
const MAX_SKIP = 1000;

function kdfRoot(rk: Uint8Array, dhOut: Uint8Array): [Uint8Array, Uint8Array] {
  const out = hkdf(sha256, dhOut, rk, RK_INFO, 64);
  return [out.slice(0, 32), out.slice(32, 64)];
}

function kdfChain(ck: Uint8Array): [Uint8Array, Uint8Array] {
  const messageKey = hmac(sha256, ck, Uint8Array.of(0x01));
  const nextChainKey = hmac(sha256, ck, Uint8Array.of(0x02));
  return [nextChainKey, messageKey];
}

function skippedKey(dhRemote: Uint8Array, n: number): string {
  return `${toBase64(dhRemote)}:${n}`;
}

export function encodeHeader(h: RatchetHeader): Uint8Array {
  const map: Record<string, unknown> = { dh: h.dh, pn: h.pn, n: h.n };
  if (h.x3dh) {
    map.x3dh = {
      ik: h.x3dh.ik,
      ek: h.x3dh.ek,
      spk: h.x3dh.spk,
      otk: h.x3dh.otk ?? null,
    };
  }
  return new Uint8Array(headerCodec.encode(map));
}

export function decodeHeader(bytes: Uint8Array): RatchetHeader {
  const o = headerCodec.decode(bytes) as {
    dh: Uint8Array;
    pn: number;
    n: number;
    x3dh?: { ik: Uint8Array; ek: Uint8Array; spk: Uint8Array; otk?: Uint8Array | null };
  };
  const header: RatchetHeader = { dh: new Uint8Array(o.dh), pn: o.pn, n: o.n };
  if (o.x3dh) {
    header.x3dh = {
      ik: new Uint8Array(o.x3dh.ik),
      ek: new Uint8Array(o.x3dh.ek),
      spk: new Uint8Array(o.x3dh.spk),
      otk: o.x3dh.otk ? new Uint8Array(o.x3dh.otk) : null,
    };
  }
  return header;
}

/** Initiator (Alice): seeds the sending chain from SK + the peer's signed prekey. */
export function initAlice(
  sharedSecret: Uint8Array,
  peerSignedPrekeyPub: Uint8Array,
): RatchetState {
  const dhSelf = generateX25519();
  const [rootKey, sendChainKey] = kdfRoot(
    sharedSecret,
    dh(dhSelf.priv, peerSignedPrekeyPub),
  );
  return {
    rootKey,
    dhSelf,
    dhRemote: peerSignedPrekeyPub,
    sendChainKey,
    recvChainKey: null,
    sendN: 0,
    recvN: 0,
    prevSendN: 0,
    skipped: new Map(),
  };
}

/** Responder (Bob): holds SK + its signed-prekey keypair; chains derive on the
 *  first received message via the DH ratchet. */
export function initBob(
  sharedSecret: Uint8Array,
  signedPrekey: KeyPair,
): RatchetState {
  return {
    rootKey: sharedSecret,
    dhSelf: signedPrekey,
    dhRemote: null,
    sendChainKey: null,
    recvChainKey: null,
    sendN: 0,
    recvN: 0,
    prevSendN: 0,
    skipped: new Map(),
  };
}

function dhRatchet(state: RatchetState, header: RatchetHeader): void {
  state.prevSendN = state.sendN;
  state.sendN = 0;
  state.recvN = 0;
  state.dhRemote = header.dh;
  [state.rootKey, state.recvChainKey] = kdfRoot(
    state.rootKey,
    dh(state.dhSelf.priv, state.dhRemote),
  );
  state.dhSelf = generateX25519();
  [state.rootKey, state.sendChainKey] = kdfRoot(
    state.rootKey,
    dh(state.dhSelf.priv, state.dhRemote),
  );
}

export interface RatchetMessage {
  header: Uint8Array; // encoded RatchetHeader (goes in the envelope slot `header`)
  ciphertext: Uint8Array; // AEAD output (goes in the slot `ciphertext`)
}

/** Encrypt one message, advancing the sending chain. `ad` binds extra context
 *  (e.g. conversation id) into the AEAD. */
export function ratchetEncrypt(
  state: RatchetState,
  plaintext: Uint8Array,
  ad: Uint8Array = new Uint8Array(0),
  x3dh?: X3dhInit | null,
): RatchetMessage {
  if (!state.sendChainKey) throw new Error('ratchetEncrypt: no sending chain');
  const [nextCk, mk] = kdfChain(state.sendChainKey);
  state.sendChainKey = nextCk;
  const header: RatchetHeader = {
    dh: state.dhSelf.pub,
    pn: state.prevSendN,
    n: state.sendN,
    x3dh: x3dh ?? null,
  };
  state.sendN += 1;
  const headerBytes = encodeHeader(header);
  const aad = concatBytes(ad, headerBytes);
  return { header: headerBytes, ciphertext: aeadSeal(mk, plaintext, aad) };
}

/** Pop a cached skipped message key for `(dh, n)`, if present. */
function trySkippedMessageKey(
  state: RatchetState,
  header: RatchetHeader,
): Uint8Array | null {
  const key = skippedKey(header.dh, header.n);
  const mk = state.skipped.get(key);
  if (!mk) return null;
  state.skipped.delete(key);
  return mk;
}

/** Advance the receiving chain to `until`, caching the skipped message keys. */
function skipMessageKeys(state: RatchetState, until: number): void {
  if (state.recvChainKey === null) return;
  if (state.recvN + MAX_SKIP < until) {
    throw new Error('ratchetDecrypt: too many skipped messages');
  }
  while (state.recvN < until) {
    const [nextCk, mk] = kdfChain(state.recvChainKey);
    state.recvChainKey = nextCk;
    state.skipped.set(skippedKey(state.dhRemote!, state.recvN), mk);
    state.recvN += 1;
  }
}

/** Decrypt a message, tolerating out-of-order + skipped delivery (Signal DR):
 *  cached skipped keys are tried first, then the chain is advanced (caching any
 *  newly-skipped keys), DH-ratcheting when the header carries a new key. */
export function ratchetDecrypt(
  state: RatchetState,
  headerBytes: Uint8Array,
  ciphertext: Uint8Array,
  ad: Uint8Array = new Uint8Array(0),
): Uint8Array {
  const header = decodeHeader(headerBytes);
  const aad = concatBytes(ad, headerBytes);

  // 1) A previously-skipped key for this exact (dh, n)?
  const skippedMk = trySkippedMessageKey(state, header);
  if (skippedMk) return aeadOpen(skippedMk, ciphertext, aad);

  // 2) New ratchet key → skip the rest of the current chain, then DH-ratchet.
  if (!state.dhRemote || !bytesEqual(header.dh, state.dhRemote)) {
    skipMessageKeys(state, header.pn);
    dhRatchet(state, header);
  }

  // 3) Skip ahead within the current chain to this message's index.
  skipMessageKeys(state, header.n);

  if (!state.recvChainKey) throw new Error('ratchetDecrypt: no receiving chain');
  const [nextCk, mk] = kdfChain(state.recvChainKey);
  state.recvChainKey = nextCk;
  state.recvN += 1;
  return aeadOpen(mk, ciphertext, aad);
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
