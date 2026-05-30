import { describe, it, expect, vi } from 'vitest';
import {
  generateIdentity,
  generateSignedPrekey,
  generateX25519,
} from '../../../src/crypto/keys';
import { deriveInitiatorSecret, deriveResponderSecret } from '../../../src/crypto/x3dh';
import { initAlice, initBob, type RatchetState } from '../../../src/crypto/ratchet';
import { MeinchatPlusProvider, type SessionStore } from '../../../src/provider';

const ALICE = 'u-alice';
const BOB = 'u-bob';
const ALICE_DEV = '11111111-1111-1111-1111-111111111111';
const BOB_DEV = '22222222-2222-2222-2222-222222222222';
const IMAGE = new Uint8Array(3000).map((_, i) => (i * 11) % 256);

function pair(): { alice: RatchetState; bob: RatchetState } {
  const a = generateIdentity();
  const b = generateIdentity();
  const spk = generateSignedPrekey(b);
  const opk = generateX25519();
  const eph = generateX25519();
  const ai = deriveInitiatorSecret(a.x25519, eph, {
    identityX25519: b.x25519.pub,
    signedPrekey: spk.keyPair.pub,
    oneTimePrekey: opk.pub,
  });
  const bi = deriveResponderSecret(b.x25519, spk.keyPair, opk, a.x25519.pub, eph.pub);
  return {
    alice: initAlice(ai.sharedSecret, spk.keyPair.pub),
    bob: initBob(bi.sharedSecret, spk.keyPair),
  };
}

function store(map: Record<string, RatchetState>): SessionStore {
  return {
    get: (id) => map[id],
    ensureOutbound: async (id) => map[id],
    takePendingX3dh: () => null,
  };
}

describe('e2e image: provider sendEncryptedImage + hydrateRow (S28.4)', () => {
  it('sends an encrypted image; the recipient hydrates caption + image', async () => {
    const { alice: aliceState, bob: bobState } = pair();

    let textEnvelope = '';
    const stored: Record<
      string,
      { ciphertextB64: string; header: Record<string, unknown> }
    > = {};

    const aliceApi = {
      listUserDevices: vi.fn(async (u: string) =>
        u === BOB ? { items: [{ id: BOB_DEV }] } : { items: [{ id: ALICE_DEV }] },
      ),
      sendEnvelope: vi.fn(async (_c: string, b: string) => {
        textEnvelope = b;
        return { id: 'msg-1' };
      }),
    };
    const aliceAttachmentApi = {
      uploadAttachment: vi.fn(async (input: any) => {
        stored[input.kind] = { ciphertextB64: input.ciphertextB64, header: input.envelopeHeader };
        return { id: `att-${input.kind}` };
      }),
      downloadAttachment: vi.fn(),
    };
    const aliceProvider = new MeinchatPlusProvider(
      { deviceId: ALICE_DEV, userId: ALICE },
      aliceApi,
      store({ [BOB_DEV]: aliceState }),
      {
        attachmentApi: aliceAttachmentApi,
        processImage: async () => ({
          fullres: IMAGE, thumb: IMAGE, width: 100, height: 80, mime: 'image/webp',
        }),
      },
    );

    const row = await aliceProvider.sendEncryptedImage('cv', BOB, new Blob([]), 'my caption');
    expect(aliceApi.sendEnvelope).toHaveBeenCalledOnce(); // the caption message
    expect(aliceAttachmentApi.uploadAttachment).toHaveBeenCalledTimes(2); // fullres + thumb
    expect(row.attachments?.map((a) => a.kind)).toEqual(['fullres', 'thumb']);

    // Recipient hydrates the row IN ORDER (text envelope, then the attachments).
    const b64ToBytes = (b64: string) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    };
    const bobApi = {
      listUserDevices: vi.fn(async () => ({ items: [{ id: ALICE_DEV }] })),
      sendEnvelope: vi.fn(),
    };
    const bobAttachmentApi = {
      uploadAttachment: vi.fn(),
      downloadAttachment: vi.fn(async (id: string) =>
        b64ToBytes(stored[id === 'att-fullres' ? 'fullres' : 'thumb'].ciphertextB64),
      ),
    };
    const bobProvider = new MeinchatPlusProvider(
      { deviceId: BOB_DEV, userId: BOB },
      bobApi,
      store({ [ALICE_DEV]: bobState }),
      { attachmentApi: bobAttachmentApi },
    );

    const hydrated = await bobProvider.hydrateRow({
      id: 'msg-1', conversation_id: 'cv', sender_id: ALICE, body: '', sent_at: 'now',
      read_at: null, system_kind: null, protocol: 'e2e_v1', envelope: textEnvelope,
      attachments: [
        {
          id: 'att-fullres', kind: 'fullres', protocol: 'e2e_v1', mime: 'image/webp',
          envelope_header: stored.fullres.header,
        },
        {
          id: 'att-thumb', kind: 'thumb', protocol: 'e2e_v1', mime: 'image/webp',
          envelope_header: stored.thumb.header,
        },
      ],
    });
    expect(hydrated.body).toBe('my caption');
    // Both blobs decrypt (skipped-key cache keeps the ratchet in sync).
    expect(hydrated.attachmentUrls['att-fullres']).toMatch(/^blob:/);
    expect(hydrated.attachmentUrls['att-thumb']).toMatch(/^blob:/);
  });

  it('hydrateRow without attachments behaves like a text decrypt', async () => {
    const { alice: aliceState, bob: bobState } = pair();
    let env = '';
    const aliceApi = {
      listUserDevices: vi.fn(async (u: string) =>
        u === BOB ? { items: [{ id: BOB_DEV }] } : { items: [{ id: ALICE_DEV }] },
      ),
      sendEnvelope: vi.fn(async (_c: string, b: string) => {
        env = b;
        return { id: 'm' };
      }),
    };
    const aliceProvider = new MeinchatPlusProvider(
      { deviceId: ALICE_DEV, userId: ALICE }, aliceApi, store({ [BOB_DEV]: aliceState }),
    );
    await aliceProvider.sendEncryptedText('cv', BOB, 'just text');

    const bobProvider = new MeinchatPlusProvider(
      { deviceId: BOB_DEV, userId: BOB },
      { listUserDevices: vi.fn(async () => ({ items: [{ id: ALICE_DEV }] })), sendEnvelope: vi.fn() },
      store({ [ALICE_DEV]: bobState }),
    );
    const hydrated = await bobProvider.hydrateRow({
      id: 'm', conversation_id: 'cv', sender_id: ALICE, body: '', sent_at: 'now',
      read_at: null, system_kind: null, protocol: 'e2e_v1', envelope: env,
    });
    expect(hydrated.body).toBe('just text');
    expect(hydrated.attachmentUrls).toEqual({});
  });
});
