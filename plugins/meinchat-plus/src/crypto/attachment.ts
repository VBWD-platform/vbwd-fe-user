// S28.4 §3.1 — attachment encryption (hybrid: symmetric stream + per-recipient
// key envelope). An image can be MBs, so the payload is encrypted ONCE under a
// fresh 256-bit key `K_att` (ChaCha20-Poly1305 via `aeadSeal`); only that small
// key is wrapped per recipient device under its Double Ratchet session. Linear
// in device count, constant in payload size.
//
// The opaque ciphertext blob goes to `IFileStorage` (server stores it as-is);
// the `envelope_header` (per-recipient wrapped keys) rides on the
// `meinchat_attachment` row. The server holds no keys and never decrypts.

import { fromBase64, toBase64 } from '../base64';
import { aeadOpen, aeadSeal, randomBytes } from './keys';
import {
  ratchetDecrypt,
  ratchetEncrypt,
  type RatchetState,
  type X3dhInit,
} from './ratchet';

export interface AttachmentRecipient {
  deviceId: Uint8Array; // 16-byte device UUID
  state: RatchetState;
  x3dh?: X3dhInit | null; // first-message prekey material (if establishing)
}

export interface KeyEnvelope {
  ciphertext: string; // base64 — ratchet-wrapped K_att
  header: string; // base64 — ratchet header for the wrap
}

export interface AttachmentEnvelopeHeader {
  alg: 'chacha20poly1305';
  per_recipient_key_envelopes: Record<string, KeyEnvelope>; // base64(deviceId) → wrap
}

export interface EncryptedAttachment {
  ciphertext: Uint8Array; // the blob (upload to storage)
  envelopeHeader: AttachmentEnvelopeHeader; // store on the attachment row
}

/** Encrypt `payload` once + wrap its key for every addressed device. `ad` binds
 *  context (e.g. the conversation id) into each key-wrap. */
export function encryptAttachment(
  payload: Uint8Array,
  recipients: AttachmentRecipient[],
  ad: Uint8Array = new Uint8Array(0),
): EncryptedAttachment {
  if (!recipients.length) throw new Error('encryptAttachment: no recipients');
  const kAtt = randomBytes(32);
  const ciphertext = aeadSeal(kAtt, payload);
  const per: Record<string, KeyEnvelope> = {};
  for (const r of recipients) {
    const wrapped = ratchetEncrypt(r.state, kAtt, ad, r.x3dh ?? null);
    per[toBase64(r.deviceId)] = {
      ciphertext: toBase64(wrapped.ciphertext),
      header: toBase64(wrapped.header),
    };
  }
  return {
    ciphertext,
    envelopeHeader: { alg: 'chacha20poly1305', per_recipient_key_envelopes: per },
  };
}

/** Unwrap this device's `K_att` and decrypt the blob. */
export function decryptAttachment(
  ciphertext: Uint8Array,
  envelopeHeader: AttachmentEnvelopeHeader,
  ownDeviceId: Uint8Array,
  state: RatchetState,
  ad: Uint8Array = new Uint8Array(0),
): Uint8Array {
  const slot = envelopeHeader.per_recipient_key_envelopes[toBase64(ownDeviceId)];
  if (!slot) throw new Error('decryptAttachment: no key envelope for this device');
  const kAtt = ratchetDecrypt(
    state,
    fromBase64(slot.header),
    fromBase64(slot.ciphertext),
    ad,
  );
  return aeadOpen(kAtt, ciphertext);
}
