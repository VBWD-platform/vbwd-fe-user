import { describe, it, expect } from 'vitest';
import {
  deriveKek,
  newSalt,
  unwrapSecret,
  wrapSecret,
} from '../../../src/crypto/kek';

// Small Argon2id params keep the unit test fast; production uses 64 MiB / 3.
const FAST = { memorySizeKiB: 512, iterations: 1, parallelism: 1 };

describe('passphrase KEK wrap/unwrap (S28.3b §3.2)', () => {
  it('round-trips a wrapped secret with the correct passphrase', async () => {
    const salt = newSalt();
    const kek = await deriveKek('correct horse battery', salt, FAST);
    const secret = new Uint8Array(32).fill(7);
    const unwrapped = unwrapSecret(kek, wrapSecret(kek, secret));
    expect(unwrapped).toEqual(secret);
  });

  it('a wrong passphrase cannot unwrap', async () => {
    const salt = newSalt();
    const good = await deriveKek('right', salt, FAST);
    const bad = await deriveKek('wrong', salt, FAST);
    const wrapped = wrapSecret(good, new Uint8Array(32).fill(9));
    expect(() => unwrapSecret(bad, wrapped)).toThrow();
  });

  it('the same passphrase + salt is deterministic', async () => {
    const salt = newSalt();
    const a = await deriveKek('pw', salt, FAST);
    const b = await deriveKek('pw', salt, FAST);
    expect(a).toEqual(b);
  });
});
