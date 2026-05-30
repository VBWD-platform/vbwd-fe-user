import { describe, it, expect } from 'vitest';
import { padTo256, stripPadding } from '../../../src/crypto/padding';

const enc = new TextEncoder();

describe('256-byte padding (S28.4 §3.4)', () => {
  it('round-trips arbitrary plaintext', () => {
    for (const s of ['', 'hi', 'a'.repeat(300), '🔐 unicode ✓']) {
      const pt = enc.encode(s);
      expect(stripPadding(padTo256(pt))).toEqual(pt);
    }
  });

  it('always produces a 256-byte multiple', () => {
    for (const n of [0, 1, 251, 252, 253, 256, 257, 1000]) {
      expect(padTo256(new Uint8Array(n)).length % 256).toBe(0);
    }
  });

  it('hides length: a 1-byte and a 200-byte message share a block size', () => {
    expect(padTo256(new Uint8Array(1)).length).toBe(
      padTo256(new Uint8Array(200)).length,
    );
  });

  it('rejects a buffer that is not a 256 multiple', () => {
    expect(() => stripPadding(new Uint8Array(100))).toThrow();
  });

  it('rejects a declared length longer than the buffer', () => {
    const bad = new Uint8Array(256);
    bad[3] = 255; // claims 255 bytes but block can hold 252 after the prefix
    bad[2] = 0xff; // inflate well past the block
    expect(() => stripPadding(bad)).toThrow();
  });
});
