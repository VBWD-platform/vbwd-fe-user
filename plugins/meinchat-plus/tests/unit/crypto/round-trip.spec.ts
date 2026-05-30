import { describe, it, expect } from 'vitest';
import {
  generateIdentity,
  generateSignedPrekey,
  generateX25519,
} from '../../../src/crypto/keys';
import { deriveInitiatorSecret, deriveResponderSecret } from '../../../src/crypto/x3dh';
import { initAlice, initBob } from '../../../src/crypto/ratchet';
import { encryptEnvelope, decryptEnvelope } from '../../../src/crypto/messaging';
import { unpackEnvelope } from '../../../src/crypto/envelope';

// One Alice↔device session (X3DH → Double Ratchet). `deviceId` is the 16-byte
// UUID the server validates against.
function session(deviceIdByte: number) {
  const alice = generateIdentity();
  const peer = generateIdentity();
  const peerSpk = generateSignedPrekey(peer);
  const opk = generateX25519();
  const eph = generateX25519();
  const a = deriveInitiatorSecret(alice.x25519, eph, {
    identityX25519: peer.x25519.pub,
    signedPrekey: peerSpk.keyPair.pub,
    oneTimePrekey: opk.pub,
  });
  const b = deriveResponderSecret(
    peer.x25519,
    peerSpk.keyPair,
    opk,
    alice.x25519.pub,
    eph.pub,
  );
  return {
    deviceId: new Uint8Array(16).fill(deviceIdByte),
    senderState: initAlice(a.sharedSecret, peerSpk.keyPair.pub),
    recipientState: initBob(b.sharedSecret, peerSpk.keyPair),
  };
}

describe('envelope round-trip + fan-out (S28.3b §3.8)', () => {
  it('two-device fan-out: each addressed device decrypts the same plaintext', () => {
    const bob = session(0x02);
    const ownSecondDevice = session(0x01); // sender's own 2nd device
    const recipients = [
      { deviceId: bob.deviceId, state: bob.senderState },
      { deviceId: ownSecondDevice.deviceId, state: ownSecondDevice.senderState },
    ];
    const envelope = encryptEnvelope('attack at dawn', recipients);

    expect(decryptEnvelope(envelope, bob.deviceId, bob.recipientState)).toBe(
      'attack at dawn',
    );
    // Own-device decrypt (closes critical-review §C7): the sender's other
    // device can read a message it did not author.
    expect(
      decryptEnvelope(envelope, ownSecondDevice.deviceId, ownSecondDevice.recipientState),
    ).toBe('attack at dawn');
  });

  it('envelope is a 256-byte multiple and well-formed', () => {
    const bob = session(0x02);
    const envelope = encryptEnvelope('hi', [
      { deviceId: bob.deviceId, state: bob.senderState },
    ]);
    expect(envelope.length % 256).toBe(0);
    const decoded = unpackEnvelope(envelope);
    expect(decoded.v).toBe(1);
    expect(decoded.per_recipient).toHaveLength(1);
    for (const k of ['device_id', 'ciphertext', 'header'] as const) {
      expect(decoded.per_recipient[0][k]).toBeInstanceOf(Uint8Array);
    }
  });

  it('a device with no slot in the envelope cannot decrypt', () => {
    const bob = session(0x02);
    const envelope = encryptEnvelope('hi', [
      { deviceId: bob.deviceId, state: bob.senderState },
    ]);
    const stranger = new Uint8Array(16).fill(0x09);
    expect(() => decryptEnvelope(envelope, stranger, bob.recipientState)).toThrow(
      /no slot/,
    );
  });

  it('length-hiding: short and long messages yield equal envelope sizes', () => {
    const a = session(0x02);
    const b = session(0x02);
    const short = encryptEnvelope('a', [{ deviceId: a.deviceId, state: a.senderState }]);
    const long = encryptEnvelope(
      'x'.repeat(200),
      [{ deviceId: b.deviceId, state: b.senderState }],
    );
    expect(short.length).toBe(long.length);
  });
});
