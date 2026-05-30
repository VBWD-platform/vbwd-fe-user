import { describe, it, expect } from 'vitest';
import {
  generateIdentity,
  generateSignedPrekey,
  generateX25519,
} from '../../../src/crypto/keys';
import { deriveInitiatorSecret, deriveResponderSecret } from '../../../src/crypto/x3dh';
import {
  decodeHeader,
  encodeHeader,
  initAlice,
  initBob,
  ratchetDecrypt,
  ratchetEncrypt,
  type RatchetState,
} from '../../../src/crypto/ratchet';

const enc = new TextEncoder();
const dec = new TextDecoder();

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

const recv = (s: RatchetState, m: { header: Uint8Array; ciphertext: Uint8Array }) =>
  dec.decode(ratchetDecrypt(s, m.header, m.ciphertext));

describe('skipped-message-key cache (Signal DR)', () => {
  it('decrypts out-of-order messages within one chain', () => {
    const { alice, bob } = pair();
    const m1 = ratchetEncrypt(alice, enc.encode('one'));
    const m2 = ratchetEncrypt(alice, enc.encode('two'));
    const m3 = ratchetEncrypt(alice, enc.encode('three'));
    // Arrive 3, 1, 2 — m1/m2 keys are cached when m3 jumps ahead.
    expect(recv(bob, m3)).toBe('three');
    expect(recv(bob, m1)).toBe('one');
    expect(recv(bob, m2)).toBe('two');
  });

  it('decrypts out-of-order across a DH ratchet step', () => {
    const { alice, bob } = pair();
    const a1 = ratchetEncrypt(alice, enc.encode('a1'));
    expect(recv(bob, a1)).toBe('a1');
    const b1 = ratchetEncrypt(bob, enc.encode('b1'));
    expect(recv(alice, b1)).toBe('b1'); // alice DH-ratchets
    const a2 = ratchetEncrypt(alice, enc.encode('a2'));
    const a3 = ratchetEncrypt(alice, enc.encode('a3'));
    // Bob sees a3 (new chain) before a2.
    expect(recv(bob, a3)).toBe('a3');
    expect(recv(bob, a2)).toBe('a2');
  });

  it('a skipped key is single-use (replay yields nothing)', () => {
    const { alice, bob } = pair();
    const m1 = ratchetEncrypt(alice, enc.encode('one'));
    const m2 = ratchetEncrypt(alice, enc.encode('two'));
    expect(recv(bob, m2)).toBe('two'); // caches m1
    expect(recv(bob, m1)).toBe('one'); // consumes the cache
    expect(() => recv(bob, m1)).toThrow(); // replay — key gone
  });

  it('rejects a header that would skip more than MAX_SKIP messages', () => {
    const { alice, bob } = pair();
    const a1 = ratchetEncrypt(alice, enc.encode('a1'));
    const hdr = decodeHeader(a1.header);
    const evil = encodeHeader({ dh: hdr.dh, pn: 0, n: 5000 });
    expect(() => ratchetDecrypt(bob, evil, new Uint8Array(40))).toThrow(/too many skipped/);
  });
});
