// S28.4 §3 — attachment transport: tie the hybrid crypto to the upload/download
// routes. Send = encrypt once + per-recipient key-wrap → POST the opaque blob +
// envelope_header. Receive = GET the opaque blob → unwrap this device's key →
// decrypt. The server never sees plaintext or keys.

import { toBase64 } from './base64';
import {
  decryptAttachment,
  encryptAttachment,
  type AttachmentEnvelopeHeader,
  type AttachmentRecipient,
} from './crypto/attachment';
import type { RatchetState } from './crypto/ratchet';

export interface AttachmentApi {
  uploadAttachment(input: {
    messageId: string;
    kind: 'fullres' | 'thumb';
    ciphertextB64: string;
    envelopeHeader: unknown;
    mime: string;
  }): Promise<{ id: string }>;
  downloadAttachment(attachmentId: string): Promise<Uint8Array>;
}

/** Encrypt `payload` for the addressed devices and upload it to `messageId`. */
export async function encryptAndUploadAttachment(
  api: AttachmentApi,
  args: {
    messageId: string;
    payload: Uint8Array;
    mime: string;
    kind: 'fullres' | 'thumb';
    recipients: AttachmentRecipient[];
    ad?: Uint8Array;
  },
): Promise<{ id: string }> {
  const { ciphertext, envelopeHeader } = encryptAttachment(
    args.payload,
    args.recipients,
    args.ad ?? new Uint8Array(0),
  );
  return api.uploadAttachment({
    messageId: args.messageId,
    kind: args.kind,
    ciphertextB64: toBase64(ciphertext),
    envelopeHeader,
    mime: args.mime,
  });
}

/** Download the blob and decrypt it with this device's wrapped key. */
export async function downloadAndDecryptAttachment(
  api: AttachmentApi,
  args: {
    attachmentId: string;
    envelopeHeader: AttachmentEnvelopeHeader;
    ownDeviceId: Uint8Array;
    state: RatchetState;
    ad?: Uint8Array;
  },
): Promise<Uint8Array> {
  const ciphertext = await api.downloadAttachment(args.attachmentId);
  return decryptAttachment(
    ciphertext,
    args.envelopeHeader,
    args.ownDeviceId,
    args.state,
    args.ad ?? new Uint8Array(0),
  );
}
