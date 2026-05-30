import { describe, it, expect } from 'vitest';
import { x25519 } from '@noble/curves/ed25519';
import {
  generateIdentity,
  montgomeryPubFromEd25519,
} from '../../../src/crypto/keys';

describe('device identity (Ed25519 + Montgomery X25519)', () => {
  it('the Montgomery projection is internally consistent', () => {
    const id = generateIdentity();
    // The derived X25519 private really yields the stored X25519 public…
    expect(x25519.getPublicKey(id.x25519.priv)).toEqual(id.x25519.pub);
  });

  it('a peer derives the same X25519 from the registered Ed25519 identity', () => {
    // The bundle exposes only the Ed25519 identity; the peer must recover the
    // exact X25519 the owner uses for X3DH DH terms.
    const id = generateIdentity();
    expect(montgomeryPubFromEd25519(id.ed25519.pub)).toEqual(id.x25519.pub);
  });
});
