// S28.3b §3.2 — (de)serialize ratchet session state for at-rest persistence.
// Uint8Arrays become base64 strings so the whole record is JSON-safe; it is
// then sealed under the Argon2id KEK before it touches IndexedDB.

import { fromBase64, toBase64 } from '../base64';
import type { RatchetState } from './ratchet';

interface SerKeyPair {
  priv: string;
  pub: string;
}

export interface SerRatchet {
  rootKey: string;
  dhSelf: SerKeyPair;
  dhRemote: string | null;
  sendChainKey: string | null;
  recvChainKey: string | null;
  sendN: number;
  recvN: number;
  prevSendN: number;
  skipped: Record<string, string>; // "b64(dh):n" → base64 skipped message key
}

const b64OrNull = (b: Uint8Array | null): string | null => (b ? toBase64(b) : null);
const fromB64OrNull = (s: string | null): Uint8Array | null =>
  s == null ? null : fromBase64(s);

export function serializeRatchet(s: RatchetState): SerRatchet {
  const skipped: Record<string, string> = {};
  for (const [k, v] of s.skipped) skipped[k] = toBase64(v);
  return {
    rootKey: toBase64(s.rootKey),
    dhSelf: { priv: toBase64(s.dhSelf.priv), pub: toBase64(s.dhSelf.pub) },
    dhRemote: b64OrNull(s.dhRemote),
    sendChainKey: b64OrNull(s.sendChainKey),
    recvChainKey: b64OrNull(s.recvChainKey),
    sendN: s.sendN,
    recvN: s.recvN,
    prevSendN: s.prevSendN,
    skipped,
  };
}

export function deserializeRatchet(o: SerRatchet): RatchetState {
  const skipped = new Map<string, Uint8Array>();
  for (const [k, v] of Object.entries(o.skipped ?? {})) skipped.set(k, fromBase64(v));
  return {
    rootKey: fromBase64(o.rootKey),
    dhSelf: { priv: fromBase64(o.dhSelf.priv), pub: fromBase64(o.dhSelf.pub) },
    dhRemote: fromB64OrNull(o.dhRemote),
    sendChainKey: fromB64OrNull(o.sendChainKey),
    recvChainKey: fromB64OrNull(o.recvChainKey),
    sendN: o.sendN,
    recvN: o.recvN,
    prevSendN: o.prevSendN,
    skipped,
  };
}

export type SessionsRecord = Record<string, SerRatchet>;
