# vbwd-fe-user-plugin-meinchat-plus

End-to-end-encrypted chat (**Signal-style ratchet**) for the VBWD user web app —
the client half of `meinchat-plus`. The client encrypts before upload and
decrypts on download; the **server stores opaque envelopes only**.

## Crypto (implemented + unit-tested under `src/crypto/`)

> **Library note:** `@signalapp/libsignal-client` is a **Node-native** addon and
> does NOT run in a browser. This plugin uses audited pure-JS primitives:
> [`@noble/curves`](https://github.com/paulmillr/noble-curves) (X25519/Ed25519),
> [`@noble/ciphers`](https://github.com/paulmillr/noble-ciphers) (ChaCha20-Poly1305),
> `@noble/hashes` (HKDF/HMAC-SHA256), `hash-wasm` (Argon2id), `cbor-x`.

- **`keys.ts`** — device identity (single Ed25519 key registered server-side +
  its Montgomery/X25519 projection for ECDH — Signal's "one identity key, two
  uses"), signed prekey (Ed25519-signed), one-time prekeys, AEAD seal/open.
- **`x3dh.ts`** — X3DH key agreement (initiator + responder derive the same SK).
- **`ratchet.ts`** — Double Ratchet (DH + symmetric KDF chains) giving per-message
  forward secrecy; header bound into AEAD AD. Out-of-order / skipped delivery is
  tolerated via the Signal MKSKIPPED skipped-key cache (bounded by `MAX_SKIP`).
- **`messaging.ts`** — send (256-byte-pad → per-device fan-out → CBOR envelope
  matching the server `SignalEnvelopeValidator`) + read (own-slot decrypt).
- **`padding.ts`** — 256-byte length-hiding padding.
- **`kek.ts`** — Argon2id passphrase KEK + AEAD wrap/unwrap for at-rest key
  storage (the swap point meinchat S28.2 `loadKek.ts` left open).
- **`downgrade.ts`** — fail-closed: refuse a conversation the server did not pin
  to `e2e_v1`.
- **`registration.ts`** / **`api.ts`** — generate + upload public key material;
  device/prekey/bundle + e2e message endpoints.

## Tests

```bash
# from the fe-user app root:
npx vitest run plugins/meinchat-plus
```

Unit specs cover: padding, key/identity consistency, X3DH agreement, ratchet
round-trip + forward secrecy + tamper detection + wrong-key rejection +
out-of-order / cross-ratchet skipped keys + signed-prekey rotation, two-device
fan-out + own-device decrypt, KEK wrap/unwrap, downgrade fail-closed, key
registration, pairing flow, attachment transport + image hydration.

An **env-gated production smoke** lives in `tests/e2e/prod-e2e.spec.ts` — it
drives the real key-distribution surface on a target host (device register →
signed prekey → one-time prekeys → bundle fetch + signature verify → conversation
negotiates `e2e_v1`). See the file header for the required `VBWD_*` env vars.

## Wiring (complete)

- `useMeinchatStore` routes send + read through the meinchat `messageCryptoRegistry`
  seam (fail-closed); the meinchat-plus provider fills it.
- `SecureChatGate` + `PairingSheet` (passphrase → Argon2id KEK → IndexedDB
  session/device store) and the composer precheck overlay are registered via the
  meinchat `conversationExtensions` seam.
- Hybrid attachment encryption (one ChaCha20-Poly1305 blob + per-recipient
  ratchet-wrapped key) with fullres + thumbnail upload and in-order hydration.

## Crypto audit

See [`docs/crypto-audit.md`](docs/crypto-audit.md) — primitives, the X3DH +
Double Ratchet construction, security properties, threat model, and the known
limitations to clear **before flipping this repo public**.

Design + decisions: SDK `docs/dev_log/20260528/done/s28-3b-meinchat-plus-signal-ratchet.md` §3.

## License

BSL 1.1 — matches the VBWD SDK.
