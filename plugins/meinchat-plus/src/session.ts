// S28.3b §3 — SessionManager: ratchet-session lifecycle.
//
// - `ensureOutbound(deviceId)` establishes the INITIATOR side from the peer
//   device's prekey bundle (X3DH → initAlice) and records the X3DH init
//   material the first outbound message must carry.
// - `establishInbound(senderDeviceId, x3dh)` cold-starts the RESPONDER side
//   from a received prekey message's header (deriveResponderSecret → initBob),
//   matching our own signed/one-time prekey by the public key the initiator used.
// - `takePendingX3dh(deviceId)` hands the provider the first-message material.
//
// Sessions are held in memory; an injectable `persist` callback lets a caller
// snapshot them (see session-store-idb). Implements the provider's SessionStore.

import { fromBase64 } from './base64';
import {
  generateX25519,
  montgomeryPubFromEd25519,
  verifySignedPrekey,
  type IdentityKeys,
  type KeyPair,
} from './crypto/keys';
import {
  initAlice,
  initBob,
  type RatchetState,
  type X3dhInit,
} from './crypto/ratchet';
import { deriveInitiatorSecret, deriveResponderSecret } from './crypto/x3dh';
import {
  deserializeRatchet,
  serializeRatchet,
  type SessionsRecord,
} from './crypto/serialize';

export interface OwnDeviceMaterial {
  identity: IdentityKeys; // Ed25519 + Montgomery X25519
  signedPrekey: KeyPair; // current active signed prekey
  oneTimePrekeys: KeyPair[]; // unconsumed (matched by pub on inbound)
  // Recently-rotated signed prekeys, kept so a peer who fetched our bundle
  // BEFORE a rotation can still establish (matched by pub on inbound).
  previousSignedPrekeys?: KeyPair[];
}

export interface PrekeyBundle {
  identity_key: string; // base64 Ed25519 identity pub
  signed_prekey: string; // base64
  signed_prekey_signature: string; // base64
  one_time_prekey: string | null; // base64 or null
}

export interface BundleApi {
  getPrekeyBundle(deviceId: string): Promise<PrekeyBundle>;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export class SessionManager {
  private readonly sessions = new Map<string, RatchetState>();
  private readonly pending = new Map<string, X3dhInit>();

  constructor(
    private readonly own: OwnDeviceMaterial,
    private readonly bundles: BundleApi,
  ) {}

  get(deviceId: string): RatchetState | undefined {
    return this.sessions.get(deviceId);
  }

  set(deviceId: string, state: RatchetState): void {
    this.sessions.set(deviceId, state);
  }

  async ensureOutbound(deviceId: string): Promise<RatchetState> {
    const existing = this.sessions.get(deviceId);
    if (existing) return existing;

    const bundle = await this.bundles.getPrekeyBundle(deviceId);
    const peerIdentityEd = fromBase64(bundle.identity_key);
    const spk = fromBase64(bundle.signed_prekey);
    const sig = fromBase64(bundle.signed_prekey_signature);
    if (!verifySignedPrekey(spk, sig, peerIdentityEd)) {
      throw new Error('ensureOutbound: signed-prekey signature does not verify');
    }
    const otk = bundle.one_time_prekey ? fromBase64(bundle.one_time_prekey) : null;

    const ephemeral = generateX25519();
    const { sharedSecret, ephemeralPub } = deriveInitiatorSecret(
      this.own.identity.x25519,
      ephemeral,
      {
        identityX25519: montgomeryPubFromEd25519(peerIdentityEd),
        signedPrekey: spk,
        oneTimePrekey: otk,
      },
    );
    const state = initAlice(sharedSecret, spk);
    this.sessions.set(deviceId, state);
    // First message to this device carries the X3DH init so the peer cold-starts.
    this.pending.set(deviceId, {
      ik: this.own.identity.ed25519.pub,
      ek: ephemeralPub,
      spk,
      otk,
    });
    return state;
  }

  /** Hand the provider the first-message prekey material (one-shot per session). */
  takePendingX3dh(deviceId: string): X3dhInit | null {
    const material = this.pending.get(deviceId) ?? null;
    if (material) this.pending.delete(deviceId);
    return material;
  }

  /** Cold-start the responder session from a received prekey message header. */
  establishInbound(senderDeviceId: string, x3dh: X3dhInit): RatchetState {
    const existing = this.sessions.get(senderDeviceId);
    if (existing) return existing;

    // Match the signed prekey the initiator used — the current one OR a
    // recently-rotated one (the peer may have fetched our bundle pre-rotation).
    const signedPrekey =
      [this.own.signedPrekey, ...(this.own.previousSignedPrekeys ?? [])].find((k) =>
        bytesEqual(k.pub, x3dh.spk),
      ) ?? null;
    if (!signedPrekey) {
      throw new Error('establishInbound: signed prekey mismatch (unknown rotation)');
    }
    let otk: KeyPair | null = null;
    if (x3dh.otk) {
      otk = this.own.oneTimePrekeys.find((k) => bytesEqual(k.pub, x3dh.otk!)) ?? null;
      if (!otk) throw new Error('establishInbound: consumed one-time prekey not found');
    }
    const { sharedSecret } = deriveResponderSecret(
      this.own.identity.x25519,
      signedPrekey,
      otk,
      montgomeryPubFromEd25519(x3dh.ik),
      x3dh.ek,
    );
    const state = initBob(sharedSecret, signedPrekey);
    this.sessions.set(senderDeviceId, state);
    return state;
  }

  /** Snapshot of all live sessions, for persistence. */
  entries(): [string, RatchetState][] {
    return [...this.sessions.entries()];
  }

  /** JSON-safe serialization of every live session (for at-rest storage). */
  serializeAll(): SessionsRecord {
    const out: SessionsRecord = {};
    for (const [deviceId, state] of this.sessions) {
      out[deviceId] = serializeRatchet(state);
    }
    return out;
  }

  /** Restore sessions from a persisted snapshot (merges over existing). */
  loadAll(record: SessionsRecord): void {
    for (const [deviceId, ser] of Object.entries(record)) {
      this.sessions.set(deviceId, deserializeRatchet(ser));
    }
  }
}
