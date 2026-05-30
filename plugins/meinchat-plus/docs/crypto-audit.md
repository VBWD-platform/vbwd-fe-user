# meinchat-plus — Crypto Audit (self-review)

**Status:** internal self-review, last updated 2026-05-30.
**Purpose:** the gate that must be cleared (ideally by an independent reviewer)
**before this repo is flipped public**. It states exactly what is implemented,
the security properties claimed, the threat model, and the known limitations —
so a reader can judge the construction without reverse-engineering the source.

> This is a self-review by the implementer, **not** an independent third-party
> audit. The primitives are from audited libraries; the *composition* here has
> not been externally reviewed. Treat "E2E-encrypted" as a strong engineering
> claim, not a certified one, until that review happens.

---

## 1. Primitives (all browser-safe, pure-JS / wasm — no Node-native addons)

| Purpose | Primitive | Library |
|---|---|---|
| ECDH key agreement | X25519 | `@noble/curves/ed25519` |
| Identity signatures | Ed25519 | `@noble/curves/ed25519` |
| AEAD (messages, key wraps, attachments, at-rest) | ChaCha20-Poly1305 | `@noble/ciphers/chacha` |
| Key derivation (X3DH, root/chain) | HKDF-SHA256 / HMAC-SHA256 | `@noble/hashes` |
| Passphrase KEK | Argon2id | `hash-wasm` |
| Wire envelope | CBOR (canonical maps) | `cbor-x` |
| CSPRNG | `randomBytes` | `@noble/hashes/utils` (WebCrypto-backed) |

**Why not `@signalapp/libsignal-client`:** it is a Node-native addon and does
not run in a browser. The construction below re-implements the X3DH + Double
Ratchet *protocol* on top of the audited `@noble` primitives.

**Identity = one Ed25519 key, two uses** (`keys.ts`): the device's Ed25519
public key is what the server stores and what verifies signed-prekey signatures;
its Montgomery (X25519) projection (`edwardsToMontgomery{Pub,Priv}`) is used for
all ECDH. This is the standard Signal arrangement. Private keys never leave the
client; the server stores only public key material.

---

## 2. Construction

### 2.1 X3DH key agreement (`x3dh.ts`)
- Initiator computes `DH1 = DH(IK_A, SPK_B)`, `DH2 = DH(EK_A, IK_B)`,
  `DH3 = DH(EK_A, SPK_B)`, and `DH4 = DH(EK_A, OPK_B)` when a one-time prekey is
  present. Responder mirrors the same four terms.
- `SK = HKDF-SHA256(ikm = DH1‖DH2‖DH3[‖DH4], salt = 0x00×32, info =
  "MeinChatPlus_X3DH_v1", L = 32)`. Fixed concatenation order ⇒ both sides
  derive the same SK.
- The signed prekey is **Ed25519-signed by the identity and verified before
  use** (`verifySignedPrekey`, enforced in `session.ensureOutbound`). A bundle
  with a bad signature is rejected — this is the MITM defence on the prekey
  server.

### 2.2 Double Ratchet (`ratchet.ts`)
- Root KDF: `HKDF-SHA256(ikm = DH_out, salt = root, info = "MeinChatPlus_RK_v1",
  64) → (root', chainKey)`.
- Chain KDF: `mk = HMAC(ck, 0x01)`, `ck' = HMAC(ck, 0x02)` — message keys are
  derived then the chain advances; old chain keys are discarded ⇒ **forward
  secrecy**. A new ratchet public key in a header triggers a DH-ratchet step ⇒
  **post-compromise / future secrecy**.
- The header (`dh`, `pn`, `n`, optional `x3dh` prekey material) is sent in the
  clear in the envelope slot but **bound into the AEAD associated data** (AD =
  `conversationId ‖ headerBytes`), so tampering with it fails decryption. This
  is the *basic* DR, not the header-encrypted variant.
- **Skipped-message-key cache (MKSKIPPED):** out-of-order and skipped messages
  are tolerated. Keys the receive chain advances past are stored single-use in
  `state.skipped` (keyed `base64(ratchetPub):n`), tried first on the next
  decrypt, and deleted on use (so a replay of an already-consumed message
  fails). Bounded by `MAX_SKIP = 1000`: a header that would skip more than that
  is rejected, capping memory and the work a malicious header can force.

### 2.3 Envelope + fan-out (`messaging.ts`, `envelope.ts`)
- A message is padded to a 256-byte multiple (`padding.ts`, see §2.5),
  ratchet-encrypted **once per recipient device** (sender's other devices
  included for multi-device), and packed into a canonical CBOR envelope
  `{ v:1, per_recipient:[{device_id,ciphertext,header}], pad }` whose total
  length is also a 256-byte multiple. The server's `SignalEnvelopeValidator`
  parses only the CBOR *structure* — never the ciphertext.
- Read = find this device's slot by `device_id`, ratchet-decrypt. A first
  message carries `x3dh` material so a responder with no session cold-starts
  (`establishInbound`).

### 2.4 Attachments (`attachment.ts`) — hybrid
- The payload (image, possibly MBs) is encrypted **once** under a fresh 256-bit
  `K_att` (ChaCha20-Poly1305). Only `K_att` is ratchet-wrapped per recipient
  device. Cost is linear in device count, constant in payload size.
- The opaque blob goes to `IFileStorage` (stored as-is); the per-recipient
  wrapped keys ride on the `meinchat_attachment` row. The server holds no keys.
- Because the key wrap is itself a ratchet message, attachment keys must be
  consumed consistently with the message ratchet — the §2.2 skipped-key cache is
  what makes fullres + thumbnail (two wraps) and out-of-order delivery safe.

### 2.5 Length-hiding padding (`padding.ts`)
- Plaintext → `uint32-BE length prefix ‖ plaintext ‖ zero pad` rounded up to the
  next 256-byte block, **before** encryption. A 1-byte and a 255-byte message
  produce identical ciphertext lengths.

### 2.6 At-rest key storage (`kek.ts`, `persistence.ts`, `device-store.ts`)
- The device identity private key and the serialized ratchet sessions are sealed
  under a KEK = `Argon2id(passphrase, salt)` with OWASP-2026 params (64 MiB, 3
  iterations, parallelism 1, 32-byte output) and stored in IndexedDB. A wrong
  passphrase ⇒ AEAD open throws ⇒ the device stays locked. The salt is stored
  alongside; the passphrase is never stored.

---

## 3. Security properties claimed

- **Confidentiality / integrity in transit & at rest on the server** — the
  server stores only opaque AEAD ciphertext + public keys; it cannot read
  message bodies or attachments.
- **End-to-end** — encryption/decryption happen only on paired client devices.
- **Forward secrecy** — per-message chain ratchet discards used message + chain
  keys.
- **Post-compromise secrecy** — DH-ratchet steps re-key the root on each new
  ratchet public key.
- **Authentication / MITM resistance at the prekey server** — signed prekeys are
  Ed25519-verified against the identity before a session is established.
- **Replay resistance** — message keys (live and skipped) are single-use.
- **Header integrity** — headers are bound into AEAD AD.
- **Length hiding** — 256-byte padding at message and envelope level.
- **Downgrade resistance** — `downgrade.ts` is fail-closed: the client refuses to
  send/read in a conversation the server did not pin to `e2e_v1`.

---

## 4. Threat model

**In scope (defended):**
- A passive or active network attacker between client and server (TLS + E2E).
- An honest-but-curious or fully compromised **server** that wants to read
  content: it sees only opaque ciphertext, public keys, routing metadata, and
  message *count/timing*.
- A prekey-server MITM swapping a signed prekey (defeated by signature check).
- Replay of captured envelopes (single-use keys).
- Theft of the at-rest IndexedDB blobs without the passphrase (Argon2id KEK).

**Out of scope (NOT defended — documented limitations):**
- **No identity-key verification UX** (no safety numbers / QR fingerprint
  comparison). A malicious server can present a *wrong identity key* for a peer
  on first contact (TOFU is not even enforced yet). **This is the most important
  gap to close before public release.** See §5.
- **Metadata** — the server learns who talks to whom, when, how often, and
  message/attachment sizes bucketed to 256 bytes. Not hidden.
- **Endpoint compromise** — malware on an unlocked device, or a malicious
  frontend served by a compromised web origin, defeats E2E entirely (inherent to
  web-delivered E2E; a hostile server can ship hostile JS).
- **Traffic analysis / timing.**
- **Denial of service** by the server (it can drop/withhold envelopes).

---

## 5. Known limitations / open items before flipping public

1. **Identity verification (safety numbers).** No UX for users to compare
   identity-key fingerprints, and no TOFU pinning of a peer's identity key.
   Without this, the "MITM resistance" property holds only against a *prekey*
   swap, not against a server that lies about the *identity key* itself. **Must
   ship at least TOFU pinning + a manual fingerprint-compare screen.**
2. **Independent review.** §1 primitives are audited; this *composition* is not.
   Get an external cryptographer to review §2 before the public flip.
3. **Signed-prekey rotation is supported but not yet scheduled.** The client can
   accept a peer's rotated prekey (`establishInbound` matches current *or*
   `previousSignedPrekeys`), but there is no periodic local rotation job. Add a
   rotation cadence + prune of old private prekeys.
4. **Multi-device is fan-out only.** Each device has an independent identity;
   there is no cross-device session sync / sender-key group ratchet and no
   "verify your other device" flow. New devices can't read history sent before
   they paired. Acceptable for v1; document it in user-facing copy.
5. **No per-message authenticated sender binding beyond the session.** A
   recipient trusts that a slot came from the session peer; combined with (1),
   strengthen with identity-key pinning.
6. **AEAD nonce strategy is random-96-bit per seal.** Safe at expected message
   volumes; if any key were ever reused across an extreme number of messages,
   revisit (the ratchet makes per-message key reuse a non-issue in practice).
7. **`hash-wasm` Argon2id runs on the main thread.** Consider a worker so the
   unlock UI doesn't jank; not a security issue.

---

## 6. Test coverage backing these claims

Unit (`tests/unit/crypto/`, `tests/unit/store/`): X3DH agreement (initiator ==
responder SK), ratchet round-trip + forward secrecy + tamper detection +
wrong-key rejection, **out-of-order + cross-ratchet skipped keys + single-use
replay + MAX_SKIP guard**, **signed-prekey rotation** (peer used a rotated
prekey), two-device fan-out + own-device decrypt, KEK wrap/unwrap (wrong
passphrase throws), padding length-hiding, downgrade fail-closed, hybrid
attachment encrypt/decrypt + fullres+thumb hydration.

Server contract: the backend `meinchat_plus` suite proves the JS CBOR envelope
validates against the Python `SignalEnvelopeValidator` and that the
device/prekey/bundle endpoints enforce signature verification.

Live smoke: `tests/e2e/prod-e2e.spec.ts` (env-gated) drives the real
key-distribution surface end-to-end on a target host, including verifying a
fetched signed prekey's signature against the published identity key.
