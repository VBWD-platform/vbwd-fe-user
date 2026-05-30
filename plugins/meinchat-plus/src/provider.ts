// S28.3b §3.4/§3.5 + S28.4 §3 — the MessageCryptoProvider meinchat-plus
// registers into the meinchat store seam. Text: per-device fan-out → CBOR
// envelope → POST; read = own-slot decrypt (cold-starting a responder session
// from a prekey-message header). Images: client-resize + hybrid-encrypt + upload
// the fullres blob; on read, `hydrateRow` decrypts the text envelope THEN each
// attachment IN ORDER (so the in-order ratchet stays in sync).

import type { MessageAttachment, MessageRow } from '../../meinchat/src/api';
import { fromBase64, toBase64 } from './base64';
import {
  decryptAttachment,
  encryptAttachment,
} from './crypto/attachment';
import {
  decryptOwnSlot,
  encryptEnvelope,
  readOwnSlot,
  type OwnSlot,
} from './crypto/messaging';
import type { RatchetState, X3dhInit } from './crypto/ratchet';
import { processImage as defaultProcessImage, type ProcessImage } from './image';
import { uuidToBytes } from './uuid';

const ad = (conversationId: string): Uint8Array =>
  new TextEncoder().encode(conversationId);

export interface DeviceDto {
  id: string;
  public_key?: string; // base64 Ed25519 identity pub (used to resolve a sender)
}

export interface ProviderApi {
  listUserDevices(userId: string): Promise<{ items: DeviceDto[] }>;
  sendEnvelope(conversationId: string, envelopeB64: string): Promise<{ id: string }>;
}

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

export interface SessionStore {
  get(deviceId: string): RatchetState | undefined;
  ensureOutbound(deviceId: string): Promise<RatchetState>;
  takePendingX3dh?(deviceId: string): X3dhInit | null;
  establishInbound?(senderDeviceId: string, x3dh: X3dhInit): RatchetState;
}

export interface SelfDevice {
  deviceId: string;
  userId: string;
}

export interface ProviderDeps {
  attachmentApi?: AttachmentApi;
  processImage?: ProcessImage;
}

// The read path consumes only the routing ids + opaque envelope and, per
// attachment, the id/kind/protocol/mime + wrapped-key header. Declared as
// exactly that subset (ISP, derived from MessageRow for DRY) so the store can
// pass a full MessageRow and the unit tests a minimal row — both satisfy it.
type InboundAttachment = Pick<
  MessageAttachment,
  'id' | 'kind' | 'protocol' | 'mime'
> & { envelope_header?: Record<string, unknown> };

type InboundRow = Partial<Omit<MessageRow, 'attachments'>> &
  Pick<MessageRow, 'conversation_id' | 'sender_id'> & {
    attachments?: InboundAttachment[];
  };

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function objectUrl(bytes: Uint8Array, mime: string): string | null {
  if (typeof URL === 'undefined' || !URL.createObjectURL) return null;
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
}

export class MeinchatPlusProvider {
  constructor(
    private readonly self: SelfDevice,
    private readonly api: ProviderApi,
    private readonly sessions: SessionStore,
    private readonly deps: ProviderDeps = {},
  ) {}

  private get processImage(): ProcessImage {
    return this.deps.processImage ?? defaultProcessImage;
  }

  /** Addressed devices for a send: peer's + sender's own (minus this device),
   *  each with its outbound session and (for the session's first message) the
   *  X3DH prekey material. */
  private async addressedRecipients(
    peerUserId: string,
  ): Promise<{ deviceId: Uint8Array; state: RatchetState; x3dh: X3dhInit | null }[]> {
    const peer = await this.api.listUserDevices(peerUserId);
    const own = await this.api.listUserDevices(this.self.userId);
    const addressed = [...peer.items, ...own.items].filter(
      (d) => d.id !== this.self.deviceId,
    );
    if (!addressed.length) {
      throw new Error('no addressed devices for this conversation');
    }
    return Promise.all(
      addressed.map(async (d) => ({
        deviceId: uuidToBytes(d.id),
        state: await this.sessions.ensureOutbound(d.id),
        x3dh: this.sessions.takePendingX3dh?.(d.id) ?? null,
      })),
    );
  }

  async sendEncryptedText(
    conversationId: string,
    peerUserId: string,
    plaintext: string,
  ): Promise<MessageRow> {
    const recipients = await this.addressedRecipients(peerUserId);
    const envelopeB64 = toBase64(
      encryptEnvelope(plaintext, recipients, ad(conversationId)),
    );
    const { id } = await this.api.sendEnvelope(conversationId, envelopeB64);
    return this.row(id, conversationId, '', envelopeB64);
  }

  async sendEncryptedImage(
    conversationId: string,
    peerUserId: string,
    file: Blob,
    caption: string,
  ): Promise<MessageRow> {
    if (!this.deps.attachmentApi) throw new Error('attachment api not configured');
    const image = await this.processImage(file);

    // 1) The image rides on an e2e text message (the caption). Send it first
    //    (this carries any session-establishing prekey material).
    const textRecipients = await this.addressedRecipients(peerUserId);
    const envelopeB64 = toBase64(
      encryptEnvelope(caption, textRecipients, ad(conversationId)),
    );
    const { id: messageId } = await this.api.sendEnvelope(conversationId, envelopeB64);

    // 2) Encrypt + upload both blobs (fullres + thumb). The skipped-key cache
    //    makes out-of-order / skipped attachment decryption safe, so the dual
    //    blob no longer risks desyncing the ratchet.
    const row = this.row(messageId, conversationId, caption, envelopeB64);
    row.attachments = [];
    row.attachmentUrls = {};
    for (const kind of ['fullres', 'thumb'] as const) {
      const payload = kind === 'fullres' ? image.fullres : image.thumb;
      const recipients = await this.addressedRecipients(peerUserId);
      const { ciphertext, envelopeHeader } = encryptAttachment(
        payload,
        recipients,
        ad(conversationId),
      );
      const { id: attachmentId } = await this.deps.attachmentApi.uploadAttachment({
        messageId,
        kind,
        ciphertextB64: toBase64(ciphertext),
        envelopeHeader,
        mime: image.mime,
      });
      const attachment: MessageAttachment = {
        id: attachmentId, kind, protocol: 'e2e_v1', mime: image.mime,
        storage_url: '', bytes_count: payload.length,
        width_px: kind === 'fullres' ? image.width || null : null,
        height_px: kind === 'fullres' ? image.height || null : null,
        envelope_header: envelopeHeader as unknown as Record<string, unknown>,
      };
      row.attachments.push(attachment);
      // The sender can't decrypt its own ciphertext (no self-slot) → show the
      // local original as the preview.
      const localUrl = objectUrl(payload, image.mime);
      if (localUrl) row.attachmentUrls[attachmentId] = localUrl;
    }
    return row;
  }

  /** Decrypt the text body only (no attachments). */
  async decryptRow(row: InboundRow): Promise<string | null> {
    const resolved = await this.resolveInbound(row);
    if (!resolved) return null;
    try {
      return decryptOwnSlot(resolved.slot, resolved.state, ad(row.conversation_id));
    } catch {
      return null;
    }
  }

  /** Decrypt the whole row IN ORDER — text envelope, then each e2e attachment —
   *  returning the body + attachment-id → blob: URL map. */
  async hydrateRow(
    row: InboundRow,
  ): Promise<{ body: string | null; attachmentUrls: Record<string, string> }> {
    const attachmentUrls: Record<string, string> = {};
    const resolved = await this.resolveInbound(row);
    if (!resolved) return { body: null, attachmentUrls };

    let body: string | null = null;
    try {
      body = decryptOwnSlot(resolved.slot, resolved.state, ad(row.conversation_id));
    } catch {
      return { body: null, attachmentUrls };
    }

    const ownDeviceBytes = uuidToBytes(this.self.deviceId);
    for (const att of row.attachments ?? []) {
      if (att.protocol !== 'e2e_v1' || !att.envelope_header) continue;
      if (!this.deps.attachmentApi) break;
      try {
        const blob = await this.deps.attachmentApi.downloadAttachment(att.id);
        const plain = decryptAttachment(
          blob,
          att.envelope_header as any,
          ownDeviceBytes,
          resolved.state,
          ad(row.conversation_id),
        );
        const url = objectUrl(plain, att.mime);
        if (url) attachmentUrls[att.id] = url;
      } catch {
        // ordering broke / not our slot — stop (don't desync further)
        break;
      }
    }
    return { body, attachmentUrls };
  }

  /** Resolve this device's slot + the sender session (cold-starting if the
   *  header carries prekey material). Returns null if nothing is decryptable. */
  private async resolveInbound(
    row: InboundRow,
  ): Promise<{ state: RatchetState; slot: OwnSlot } | null> {
    if (!row.envelope) return null;
    let slot: OwnSlot | null;
    try {
      slot = readOwnSlot(fromBase64(row.envelope), uuidToBytes(this.self.deviceId));
    } catch {
      return null;
    }
    if (!slot) return null;

    let senders: { items: DeviceDto[] };
    try {
      senders = await this.api.listUserDevices(row.sender_id);
    } catch {
      return null;
    }
    for (const device of senders.items) {
      const state = this.sessions.get(device.id);
      if (state) return { state, slot };
    }
    if (slot.header.x3dh && this.sessions.establishInbound) {
      const sender = this.resolveSenderDevice(senders.items, slot.header.x3dh.ik);
      if (sender) {
        try {
          return { state: this.sessions.establishInbound(sender.id, slot.header.x3dh), slot };
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  private resolveSenderDevice(devices: DeviceDto[], ik: Uint8Array): DeviceDto | null {
    for (const d of devices) {
      if (!d.public_key) continue;
      try {
        if (bytesEqual(fromBase64(d.public_key), ik)) return d;
      } catch {
        /* skip */
      }
    }
    return devices.length === 1 ? devices[0] : null;
  }

  private row(
    id: string,
    conversationId: string,
    body: string,
    envelopeB64: string,
  ): MessageRow {
    return {
      id,
      conversation_id: conversationId,
      sender_id: this.self.userId,
      sender_nickname: '',
      body,
      attachments: [],
      sent_at: new Date().toISOString(),
      read_at: null,
      system_kind: null,
      protocol: 'e2e_v1',
      envelope: envelopeB64,
    };
  }
}
