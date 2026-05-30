// S28.4 §3.4 — length-hiding padding.
//
// Plaintext is padded to the next 256-byte multiple BEFORE encryption so the
// ciphertext length does not leak the message length (the critical-review
// fix). A 4-byte big-endian length prefix records the true plaintext length so
// stripping is exact. The smallest block is one full 256-byte block, so even a
// 1-byte message is indistinguishable from a 255-byte one.

const BLOCK = 256;
const PREFIX_BYTES = 4; // uint32 BE original length

/** Pad `plaintext` to the next 256-byte multiple, prefixing its true length. */
export function padTo256(plaintext: Uint8Array): Uint8Array {
  const total = PREFIX_BYTES + plaintext.length;
  const padded = Math.ceil(total / BLOCK) * BLOCK;
  const out = new Uint8Array(padded); // zero-filled padding tail
  // 4-byte big-endian length prefix.
  out[0] = (plaintext.length >>> 24) & 0xff;
  out[1] = (plaintext.length >>> 16) & 0xff;
  out[2] = (plaintext.length >>> 8) & 0xff;
  out[3] = plaintext.length & 0xff;
  out.set(plaintext, PREFIX_BYTES);
  return out;
}

/** Recover the original plaintext from a padded buffer. */
export function stripPadding(padded: Uint8Array): Uint8Array {
  if (padded.length < PREFIX_BYTES || padded.length % BLOCK !== 0) {
    throw new Error('stripPadding: not a valid 256-byte-padded buffer');
  }
  const len =
    (padded[0] << 24) | (padded[1] << 16) | (padded[2] << 8) | padded[3];
  if (len < 0 || PREFIX_BYTES + len > padded.length) {
    throw new Error('stripPadding: declared length out of range');
  }
  return padded.slice(PREFIX_BYTES, PREFIX_BYTES + len);
}
