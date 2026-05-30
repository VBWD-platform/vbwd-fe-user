import { describe, it, expect, vi } from 'vitest';
import {
  generateIdentity,
  generateSignedPrekey,
  generateX25519,
} from '../../../src/crypto/keys';
import { deriveInitiatorSecret, deriveResponderSecret } from '../../../src/crypto/x3dh';
import { initAlice, initBob, type RatchetState } from '../../../src/crypto/ratchet';
import {
  encryptAndUploadAttachment,
  downloadAndDecryptAttachment,
} from '../../../src/attachment-transport';

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

const BOB_DEV = new Uint8Array(16).fill(2);
const IMAGE = new Uint8Array(2048).map((_, i) => (i * 13) % 256);

describe('attachment transport round-trip (S28.4 §3)', () => {
  it('encrypt+upload → download+decrypt recovers the image', async () => {
    const { alice, bob } = pair();

    let storedCiphertextB64 = '';
    let storedHeader: any = null;
    const api = {
      uploadAttachment: vi.fn(async (input: any) => {
        storedCiphertextB64 = input.ciphertextB64;
        storedHeader = input.envelopeHeader;
        return { id: 'att-1' };
      }),
      downloadAttachment: vi.fn(async () => {
        // The server stores the opaque blob verbatim.
        const bin = atob(storedCiphertextB64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
      }),
    };

    const up = await encryptAndUploadAttachment(api, {
      messageId: 'm1', payload: IMAGE, mime: 'image/webp', kind: 'fullres',
      recipients: [{ deviceId: BOB_DEV, state: alice }],
    });
    expect(up.id).toBe('att-1');
    expect(api.uploadAttachment).toHaveBeenCalledOnce();
    expect(storedHeader.alg).toBe('chacha20poly1305');

    const recovered = await downloadAndDecryptAttachment(api, {
      attachmentId: 'att-1', envelopeHeader: storedHeader, ownDeviceId: BOB_DEV, state: bob,
    });
    expect(recovered).toEqual(IMAGE);
  });
});
