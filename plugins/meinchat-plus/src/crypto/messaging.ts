// S28.3b §3.4 / §3.5 — send (encrypt + fan-out) and read (own-slot decrypt).
//
// One plaintext is padded once (length-hiding), then encrypted independently
// under each addressed device's Double Ratchet session (peer's devices + the
// sender's own, for own-device decrypt). The per-device ciphertexts + headers
// are packed into the CBOR envelope the server validates opaquely. The FIRST
// message to a device may carry X3DH init material (`x3dh`) in its header so a
// responder with no session can cold-start.

import { padTo256, stripPadding } from './padding';
import {
  findOwnSlot,
  packEnvelope,
  unpackEnvelope,
  type RecipientSlot,
} from './envelope';
import {
  decodeHeader,
  ratchetDecrypt,
  ratchetEncrypt,
  type RatchetHeader,
  type RatchetState,
  type X3dhInit,
} from './ratchet';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface RecipientSession {
  deviceId: Uint8Array; // 16-byte device UUID (matches the server's expected set)
  state: RatchetState;
  x3dh?: X3dhInit | null; // first-message prekey material for this device
}

/** Encrypt `plaintext` for every addressed device and pack the envelope.
 *  `ad` (e.g. the conversation id bytes) is bound into each AEAD. */
export function encryptEnvelope(
  plaintext: string,
  recipients: RecipientSession[],
  ad: Uint8Array = new Uint8Array(0),
): Uint8Array {
  if (!recipients.length) throw new Error('encryptEnvelope: no recipients');
  const padded = padTo256(encoder.encode(plaintext));
  const slots: RecipientSlot[] = recipients.map(({ deviceId, state, x3dh }) => {
    const msg = ratchetEncrypt(state, padded, ad, x3dh ?? null);
    return { deviceId, ciphertext: msg.ciphertext, header: msg.header };
  });
  return packEnvelope(slots);
}

export interface OwnSlot {
  headerBytes: Uint8Array; // raw encoded header (AEAD-bound; pass to decrypt)
  header: RatchetHeader; // decoded — read `x3dh` to decide cold-start
  ciphertext: Uint8Array;
}

/** Locate + decode this device's slot WITHOUT decrypting (so the caller can
 *  cold-start a responder session from `header.x3dh` first). */
export function readOwnSlot(
  envelopeBytes: Uint8Array,
  ownDeviceId: Uint8Array,
): OwnSlot | null {
  const env = unpackEnvelope(envelopeBytes);
  const slot = findOwnSlot(env, ownDeviceId);
  if (!slot) return null;
  const headerBytes = new Uint8Array(slot.header);
  return {
    headerBytes,
    header: decodeHeader(headerBytes),
    ciphertext: new Uint8Array(slot.ciphertext),
  };
}

/** Decrypt a previously-read own slot with an (established) session. */
export function decryptOwnSlot(
  slot: OwnSlot,
  state: RatchetState,
  ad: Uint8Array = new Uint8Array(0),
): string {
  const padded = ratchetDecrypt(state, slot.headerBytes, slot.ciphertext, ad);
  return decoder.decode(stripPadding(padded));
}

/** Convenience: read + decrypt the slot addressed to `ownDeviceId`. */
export function decryptEnvelope(
  envelopeBytes: Uint8Array,
  ownDeviceId: Uint8Array,
  state: RatchetState,
  ad: Uint8Array = new Uint8Array(0),
): string {
  const slot = readOwnSlot(envelopeBytes, ownDeviceId);
  if (!slot) throw new Error('decryptEnvelope: no slot addressed to this device');
  return decryptOwnSlot(slot, state, ad);
}
