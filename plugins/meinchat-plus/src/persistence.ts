// S28.3b §3.2 — at-rest persistence for ratchet sessions (and device material).
//
// Sessions are serialized to JSON, **sealed under the Argon2id KEK** (AEAD), and
// written to a key-value store (IndexedDB in the browser; in-memory for tests).
// Nothing readable touches disk: the KEK is derived from the user passphrase.

import { unwrapSecret, wrapSecret } from './crypto/kek';
import type { SessionsRecord } from './crypto/serialize';

export interface KeyValueStore {
  get(key: string): Promise<Uint8Array | null>;
  set(key: string, value: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
}

const SESSIONS_KEY = 'meinchat-plus:sessions';
const enc = new TextEncoder();
const dec = new TextDecoder();

/** Seal + persist a sessions snapshot under the KEK. */
export async function saveSessions(
  kv: KeyValueStore,
  kek: Uint8Array,
  record: SessionsRecord,
): Promise<void> {
  const sealed = wrapSecret(kek, enc.encode(JSON.stringify(record)));
  await kv.set(SESSIONS_KEY, sealed);
}

/** Load + unseal a sessions snapshot; `{}` when absent, throws on a wrong KEK. */
export async function loadSessions(
  kv: KeyValueStore,
  kek: Uint8Array,
): Promise<SessionsRecord> {
  const sealed = await kv.get(SESSIONS_KEY);
  if (!sealed) return {};
  return JSON.parse(dec.decode(unwrapSecret(kek, sealed))) as SessionsRecord;
}

/** In-memory KV — tests + SSR. */
export class InMemoryKeyValueStore implements KeyValueStore {
  private readonly map = new Map<string, Uint8Array>();
  async get(key: string): Promise<Uint8Array | null> {
    return this.map.get(key) ?? null;
  }
  async set(key: string, value: Uint8Array): Promise<void> {
    this.map.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

/** IndexedDB-backed KV (browser). Lazily imports `idb` so SSR/tests that use the
 *  in-memory store never pull it in. One object store of `Uint8Array` blobs. */
export async function createIdbKeyValueStore(
  dbName = 'meinchat-plus',
  storeName = 'kv',
): Promise<KeyValueStore> {
  const { openDB } = await import('idb');
  const db = await openDB(dbName, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName);
      }
    },
  });
  return {
    async get(key) {
      return (await db.get(storeName, key)) ?? null;
    },
    async set(key, value) {
      await db.put(storeName, value, key);
    },
    async delete(key) {
      await db.delete(storeName, key);
    },
  };
}
