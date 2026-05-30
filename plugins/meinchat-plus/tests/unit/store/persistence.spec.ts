import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  generateIdentity,
  generateOneTimePrekeys,
  generateSignedPrekey,
} from '../../../src/crypto/keys';
import { toBase64 } from '../../../src/base64';
import {
  serializeRatchet,
  deserializeRatchet,
} from '../../../src/crypto/serialize';
import { SessionManager, type OwnDeviceMaterial } from '../../../src/session';
import { MeinchatPlusProvider } from '../../../src/provider';
import {
  InMemoryKeyValueStore,
  createIdbKeyValueStore,
  loadSessions,
  saveSessions,
} from '../../../src/persistence';

const ALICE = 'user-alice';
const BOB = 'user-bob';
const ALICE_DEV = '11111111-1111-1111-1111-111111111111';
const BOB_DEV = '22222222-2222-2222-2222-222222222222';

function peer() {
  const identity = generateIdentity();
  return { identity, spk: generateSignedPrekey(identity), otks: generateOneTimePrekeys(2) };
}
function own(p: ReturnType<typeof peer>): OwnDeviceMaterial {
  return { identity: p.identity, signedPrekey: p.spk.keyPair, oneTimePrekeys: p.otks };
}
function bundle(p: ReturnType<typeof peer>) {
  return {
    identity_key: toBase64(p.identity.ed25519.pub),
    signed_prekey: toBase64(p.spk.keyPair.pub),
    signed_prekey_signature: toBase64(p.spk.signature),
    one_time_prekey: toBase64(p.otks[0].pub),
  };
}

/** Drive one Alice→Bob first message so both managers hold a live session. */
async function establish() {
  const alice = peer();
  const bob = peer();
  const aliceDevices = [{ id: ALICE_DEV, public_key: toBase64(alice.identity.ed25519.pub) }];
  const bobDevices = [{ id: BOB_DEV, public_key: toBase64(bob.identity.ed25519.pub) }];
  const aliceMgr = new SessionManager(own(alice), {
    getPrekeyBundle: async () => bundle(bob),
  });
  const bobMgr = new SessionManager(own(bob), {
    getPrekeyBundle: async () => { throw new Error('n/a'); },
  });
  const cap: { env?: string } = {};
  const aliceApi = {
    listUserDevices: vi.fn(async (u: string) => ({ items: u === BOB ? bobDevices : aliceDevices })),
    sendEnvelope: vi.fn(async (_c: string, b: string) => { cap.env = b; return { id: 's' }; }),
  };
  const bobApi = {
    listUserDevices: vi.fn(async (u: string) => ({ items: u === ALICE ? aliceDevices : bobDevices })),
    sendEnvelope: vi.fn(),
  };
  const aliceProvider = new MeinchatPlusProvider({ deviceId: ALICE_DEV, userId: ALICE }, aliceApi, aliceMgr);
  const bobProvider = new MeinchatPlusProvider({ deviceId: BOB_DEV, userId: BOB }, bobApi, bobMgr);

  await aliceProvider.sendEncryptedText('cv', BOB, 'first');
  const row1 = mkRow(ALICE, cap.env!);
  expect(await bobProvider.decryptRow(row1)).toBe('first');

  return { aliceProvider, aliceMgr, bobMgr, bobApi, cap, aliceCap: cap };
}

function mkRow(sender: string, env: string) {
  return {
    id: 'm', conversation_id: 'cv', sender_id: sender, body: '', attachments: [],
    sent_at: 'now', read_at: null, system_kind: null, protocol: 'e2e_v1', envelope: env,
  };
}

describe('serialize round-trip', () => {
  it('a deserialized ratchet state keeps decrypting', async () => {
    const { aliceProvider, bobMgr, aliceCap } = await establish();
    // Bob's session is keyed by the PEER device (Alice's). Snapshot + rebuild.
    const ser = serializeRatchet(bobMgr.get(ALICE_DEV)!);
    const restored = deserializeRatchet(JSON.parse(JSON.stringify(ser)));

    // A fresh Bob manager holding ONLY the restored state decrypts msg #2.
    const bob2 = new SessionManager(
      // own material is irrelevant once a session exists; reuse a stub
      { identity: generateIdentity(), signedPrekey: generateSignedPrekey(generateIdentity()).keyPair, oneTimePrekeys: [] } as OwnDeviceMaterial,
      { getPrekeyBundle: async () => { throw new Error('n/a'); } },
    );
    bob2.set(ALICE_DEV, restored);
    const bobProvider2 = new MeinchatPlusProvider(
      { deviceId: BOB_DEV, userId: BOB },
      { listUserDevices: vi.fn(async () => ({ items: [{ id: ALICE_DEV }] })), sendEnvelope: vi.fn() },
      bob2,
    );
    await aliceProvider.sendEncryptedText('cv', BOB, 'second');
    expect(await bobProvider2.decryptRow(mkRow(ALICE, aliceCap.env!))).toBe('second');
  });
});

describe('sealed KV persistence', () => {
  const KEK = new Uint8Array(32).fill(7);

  it('save → reload sessions decrypts the next message', async () => {
    const { aliceProvider, bobMgr, aliceCap } = await establish();
    const kv = new InMemoryKeyValueStore();
    await saveSessions(kv, KEK, bobMgr.serializeAll());

    const reloaded = new SessionManager(
      { identity: generateIdentity(), signedPrekey: generateSignedPrekey(generateIdentity()).keyPair, oneTimePrekeys: [] } as OwnDeviceMaterial,
      { getPrekeyBundle: async () => { throw new Error('n/a'); } },
    );
    reloaded.loadAll(await loadSessions(kv, KEK));
    const provider = new MeinchatPlusProvider(
      { deviceId: BOB_DEV, userId: BOB },
      { listUserDevices: vi.fn(async () => ({ items: [{ id: ALICE_DEV }] })), sendEnvelope: vi.fn() },
      reloaded,
    );
    await aliceProvider.sendEncryptedText('cv', BOB, 'after reload');
    expect(await provider.decryptRow(mkRow(ALICE, aliceCap.env!))).toBe('after reload');
  });

  it('a wrong KEK cannot unseal the snapshot', async () => {
    const kv = new InMemoryKeyValueStore();
    await saveSessions(kv, KEK, { [ALICE_DEV]: serializeRatchet((await establish()).bobMgr.get(ALICE_DEV)!) });
    await expect(loadSessions(kv, new Uint8Array(32).fill(9))).rejects.toThrow();
  });
});

describe('IndexedDB key-value store', () => {
  beforeEach(() => {
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  it('round-trips a blob through idb', async () => {
    const kv = await createIdbKeyValueStore('mcp-test', 'kv');
    await kv.set('k', new Uint8Array([1, 2, 3]));
    expect(await kv.get('k')).toEqual(new Uint8Array([1, 2, 3]));
    await kv.delete('k');
    expect(await kv.get('k')).toBeNull();
  });
});
