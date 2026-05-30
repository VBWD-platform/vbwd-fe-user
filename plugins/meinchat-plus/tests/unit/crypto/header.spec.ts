import { describe, it, expect } from 'vitest';
import { encodeHeader, decodeHeader } from '../../../src/crypto/ratchet';

describe('ratchet header encoding (prekey-message x3dh extension)', () => {
  it('round-trips a plain header (no x3dh)', () => {
    const h = { dh: new Uint8Array(32).fill(1), pn: 2, n: 5 };
    const back = decodeHeader(encodeHeader(h));
    expect(back.dh).toEqual(h.dh);
    expect([back.pn, back.n]).toEqual([2, 5]);
    expect(back.x3dh).toBeUndefined();
  });

  it('round-trips a header carrying X3DH init material', () => {
    const h = {
      dh: new Uint8Array(32).fill(1),
      pn: 0,
      n: 0,
      x3dh: {
        ik: new Uint8Array(32).fill(2),
        ek: new Uint8Array(32).fill(3),
        spk: new Uint8Array(32).fill(4),
        otk: new Uint8Array(32).fill(5),
      },
    };
    const back = decodeHeader(encodeHeader(h));
    expect(back.x3dh?.ik).toEqual(h.x3dh.ik);
    expect(back.x3dh?.ek).toEqual(h.x3dh.ek);
    expect(back.x3dh?.spk).toEqual(h.x3dh.spk);
    expect(back.x3dh?.otk).toEqual(h.x3dh.otk);
  });

  it('supports a prekey-message without a one-time prekey (otk null)', () => {
    const h = {
      dh: new Uint8Array(32).fill(1),
      pn: 0,
      n: 0,
      x3dh: {
        ik: new Uint8Array(32).fill(2),
        ek: new Uint8Array(32).fill(3),
        spk: new Uint8Array(32).fill(4),
        otk: null,
      },
    };
    const back = decodeHeader(encodeHeader(h));
    expect(back.x3dh?.otk).toBeNull();
  });
});
