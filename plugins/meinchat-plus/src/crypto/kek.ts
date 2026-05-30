// S28.3b §3.2 — at-rest key wrapping under a passphrase-derived KEK.
//
// The device identity private key + Signal session state are stored in
// IndexedDB sealed under a KEK derived from the user's passphrase via
// Argon2id (hash-wasm). Replaces the phase-1 device-bound WebCrypto key
// (meinchat S28.2 `loadKek.ts`) — the swap point the phase-1 work left open.
// OWASP-2026 Argon2id params: 64 MiB memory, 3 iterations, parallelism 1.

import { argon2id } from 'hash-wasm';
import { aeadOpen, aeadSeal, randomBytes } from './keys';

const KEK_BYTES = 32;

export interface KekParams {
  memorySizeKiB?: number;
  iterations?: number;
  parallelism?: number;
}

/** Derive a 32-byte KEK from a passphrase + salt (Argon2id). */
export async function deriveKek(
  passphrase: string,
  salt: Uint8Array,
  params: KekParams = {},
): Promise<Uint8Array> {
  return argon2id({
    password: passphrase,
    salt,
    parallelism: params.parallelism ?? 1,
    iterations: params.iterations ?? 3,
    memorySize: params.memorySizeKiB ?? 64 * 1024,
    hashLength: KEK_BYTES,
    outputType: 'binary',
  });
}

export function newSalt(): Uint8Array {
  return randomBytes(16);
}

/** Seal secret key material under the KEK (AEAD). */
export function wrapSecret(kek: Uint8Array, secret: Uint8Array): Uint8Array {
  return aeadSeal(kek, secret);
}

/** Unseal key material; throws on a wrong KEK (wrong passphrase). */
export function unwrapSecret(kek: Uint8Array, wrapped: Uint8Array): Uint8Array {
  return aeadOpen(kek, wrapped);
}
