import { describe, it, expect } from 'vitest';
import {
  generateIdentity,
  generateSignedPrekey,
  generateX25519,
} from '../../../src/crypto/keys';
import { deriveInitiatorSecret, deriveResponderSecret } from '../../../src/crypto/x3dh';
import { initAlice, initBob, type RatchetState } from '../../../src/crypto/ratchet';
import {
  encryptAttachment,
  decryptAttachment,
} from '../../../src/crypto/attachment';

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
const OWN_DEV = new Uint8Array(16).fill(1);
const PAYLOAD = new Uint8Array(4096).map((_, i) => (i * 7) % 256); // "image" bytes

describe('attachment hybrid encryption (S28.4 §3.1)', () => {
  it('two-device fan-out: one blob, per-device key envelopes; each decrypts', () => {
    const bob = pair();
    const own = pair(); // sender's own 2nd device
    const enc = encryptAttachment(PAYLOAD, [
      { deviceId: BOB_DEV, state: bob.alice },
      { deviceId: OWN_DEV, state: own.alice },
    ]);
    // One ciphertext blob; two key envelopes.
    expect(Object.keys(enc.envelopeHeader.per_recipient_key_envelopes)).toHaveLength(2);
    expect(enc.envelopeHeader.alg).toBe('chacha20poly1305');

    expect(decryptAttachment(enc.ciphertext, enc.envelopeHeader, BOB_DEV, bob.bob)).toEqual(PAYLOAD);
    expect(decryptAttachment(enc.ciphertext, enc.envelopeHeader, OWN_DEV, own.bob)).toEqual(PAYLOAD);
  });

  it('a device with no key envelope cannot decrypt', () => {
    const bob = pair();
    const enc = encryptAttachment(PAYLOAD, [{ deviceId: BOB_DEV, state: bob.alice }]);
    const stranger = new Uint8Array(16).fill(9);
    expect(() =>
      decryptAttachment(enc.ciphertext, enc.envelopeHeader, stranger, bob.bob),
    ).toThrow(/no key envelope/);
  });

  it('a tampered blob fails authentication', () => {
    const bob = pair();
    const enc = encryptAttachment(PAYLOAD, [{ deviceId: BOB_DEV, state: bob.alice }]);
    enc.ciphertext[enc.ciphertext.length - 1] ^= 0xff;
    expect(() =>
      decryptAttachment(enc.ciphertext, enc.envelopeHeader, BOB_DEV, bob.bob),
    ).toThrow();
  });

  it('a tampered key envelope fails authentication', () => {
    const bob = pair();
    const enc = encryptAttachment(PAYLOAD, [{ deviceId: BOB_DEV, state: bob.alice }]);
    const key = Object.keys(enc.envelopeHeader.per_recipient_key_envelopes)[0];
    const slot = enc.envelopeHeader.per_recipient_key_envelopes[key];
    slot.ciphertext = slot.ciphertext.slice(0, -2) + 'AA';
    expect(() =>
      decryptAttachment(enc.ciphertext, enc.envelopeHeader, BOB_DEV, bob.bob),
    ).toThrow();
  });
});
