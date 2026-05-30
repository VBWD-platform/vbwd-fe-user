import { describe, it, expect } from 'vitest';
import {
  generateIdentity,
  generateSignedPrekey,
  generateX25519,
  verifySignedPrekey,
} from '../../../src/crypto/keys';
import { deriveInitiatorSecret, deriveResponderSecret } from '../../../src/crypto/x3dh';
import {
  initAlice,
  initBob,
  ratchetDecrypt,
  ratchetEncrypt,
} from '../../../src/crypto/ratchet';

const enc = new TextEncoder();
const dec = new TextDecoder();

function pair() {
  // Alice (initiator) + Bob (responder) with a full prekey bundle, run X3DH,
  // then hand off to the Double Ratchet. Returns both ratchet states.
  const alice = generateIdentity();
  const bob = generateIdentity();
  const bobSpk = generateSignedPrekey(bob);
  const bobOpk = generateX25519();
  const aliceEph = generateX25519();

  const a = deriveInitiatorSecret(alice.x25519, aliceEph, {
    identityX25519: bob.x25519.pub,
    signedPrekey: bobSpk.keyPair.pub,
    oneTimePrekey: bobOpk.pub,
  });
  const b = deriveResponderSecret(
    bob.x25519,
    bobSpk.keyPair,
    bobOpk,
    alice.x25519.pub,
    aliceEph.pub,
  );
  expect(b.sharedSecret).toEqual(a.sharedSecret); // X3DH agreement

  return {
    aliceState: initAlice(a.sharedSecret, bobSpk.keyPair.pub),
    bobState: initBob(b.sharedSecret, bobSpk.keyPair),
  };
}

describe('signed prekey signature', () => {
  it('verifies a valid signed prekey and rejects a tampered one', () => {
    const id = generateIdentity();
    const spk = generateSignedPrekey(id);
    expect(verifySignedPrekey(spk.keyPair.pub, spk.signature, id.ed25519.pub)).toBe(true);
    const bad = spk.signature.slice();
    bad[0] ^= 0xff;
    expect(verifySignedPrekey(spk.keyPair.pub, bad, id.ed25519.pub)).toBe(false);
  });
});

describe('Double Ratchet round-trip', () => {
  it('Bob decrypts Alice’s first message', () => {
    const { aliceState, bobState } = pair();
    const m = ratchetEncrypt(aliceState, enc.encode('hello bob'));
    expect(dec.decode(ratchetDecrypt(bobState, m.header, m.ciphertext))).toBe('hello bob');
  });

  it('supports a full back-and-forth conversation', () => {
    const { aliceState, bobState } = pair();
    const m1 = ratchetEncrypt(aliceState, enc.encode('hi'));
    expect(dec.decode(ratchetDecrypt(bobState, m1.header, m1.ciphertext))).toBe('hi');
    const r1 = ratchetEncrypt(bobState, enc.encode('hey'));
    expect(dec.decode(ratchetDecrypt(aliceState, r1.header, r1.ciphertext))).toBe('hey');
    const m2 = ratchetEncrypt(aliceState, enc.encode('how are you'));
    expect(dec.decode(ratchetDecrypt(bobState, m2.header, m2.ciphertext))).toBe('how are you');
  });

  it('forward secrecy: each message uses a distinct key (ciphertexts differ)', () => {
    const { aliceState } = pair();
    const a = ratchetEncrypt(aliceState, enc.encode('same'));
    const b = ratchetEncrypt(aliceState, enc.encode('same'));
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });

  it('tampered ciphertext fails authentication', () => {
    const { aliceState, bobState } = pair();
    const m = ratchetEncrypt(aliceState, enc.encode('secret'));
    m.ciphertext[m.ciphertext.length - 1] ^= 0xff;
    expect(() => ratchetDecrypt(bobState, m.header, m.ciphertext)).toThrow();
  });

  it('tampered header fails authentication (bound into AEAD AD)', () => {
    const { aliceState, bobState } = pair();
    const m = ratchetEncrypt(aliceState, enc.encode('secret'));
    m.header[m.header.length - 1] ^= 0xff;
    expect(() => ratchetDecrypt(bobState, m.header, m.ciphertext)).toThrow();
  });

  it('a wrong-key receiver cannot decrypt', () => {
    const { aliceState } = pair();
    const { bobState: strangerBob } = pair(); // unrelated session
    const m = ratchetEncrypt(aliceState, enc.encode('private'));
    expect(() => ratchetDecrypt(strangerBob, m.header, m.ciphertext)).toThrow();
  });
});
