import { describe, it, expect, vi } from 'vitest';
import {
  generateIdentity,
  generateOneTimePrekeys,
  generateSignedPrekey,
} from '../../../src/crypto/keys';
import { toBase64 } from '../../../src/base64';
import { SessionManager, type OwnDeviceMaterial } from '../../../src/session';
import { MeinchatPlusProvider } from '../../../src/provider';

const ALICE = 'u-alice';
const BOB = 'u-bob';
const ALICE_DEV = '11111111-1111-1111-1111-111111111111';
const BOB_DEV = '22222222-2222-2222-2222-222222222222';

describe('signed-prekey rotation', () => {
  it('establishInbound still works when the peer used a rotated signed prekey', async () => {
    const alice = generateIdentity();
    const bob = generateIdentity();
    const oldSpk = generateSignedPrekey(bob); // the one Alice's stale bundle has
    const newSpk = generateSignedPrekey(bob); // Bob's current active prekey
    const otks = generateOneTimePrekeys(2);

    // Bob's manager: current = newSpk, but keeps oldSpk in the rotation history.
    const bobOwn: OwnDeviceMaterial = {
      identity: bob,
      signedPrekey: newSpk.keyPair,
      oneTimePrekeys: otks,
      previousSignedPrekeys: [oldSpk.keyPair],
    };
    const bobMgr = new SessionManager(bobOwn, {
      getPrekeyBundle: async () => { throw new Error('n/a'); },
    });

    // Alice fetched Bob's bundle BEFORE the rotation → it carries oldSpk.
    const aliceMgr = new SessionManager(
      { identity: alice, signedPrekey: generateSignedPrekey(alice).keyPair, oneTimePrekeys: [] },
      {
        getPrekeyBundle: async () => ({
          identity_key: toBase64(bob.ed25519.pub),
          signed_prekey: toBase64(oldSpk.keyPair.pub),
          signed_prekey_signature: toBase64(oldSpk.signature),
          one_time_prekey: toBase64(otks[0].pub),
        }),
      },
    );

    const aliceDevices = [{ id: ALICE_DEV, public_key: toBase64(alice.ed25519.pub) }];
    const bobDevices = [{ id: BOB_DEV, public_key: toBase64(bob.ed25519.pub) }];
    let env = '';
    const aliceApi = {
      listUserDevices: vi.fn(async (u: string) => ({ items: u === BOB ? bobDevices : aliceDevices })),
      sendEnvelope: vi.fn(async (_c: string, b: string) => { env = b; return { id: 'm' }; }),
    };
    const bobApi = {
      listUserDevices: vi.fn(async () => ({ items: aliceDevices })),
      sendEnvelope: vi.fn(),
    };

    const aliceProvider = new MeinchatPlusProvider({ deviceId: ALICE_DEV, userId: ALICE }, aliceApi, aliceMgr);
    const bobProvider = new MeinchatPlusProvider({ deviceId: BOB_DEV, userId: BOB }, bobApi, bobMgr);

    await aliceProvider.sendEncryptedText('cv', BOB, 'hi via old prekey');
    const decrypted = await bobProvider.decryptRow({
      id: 'm', conversation_id: 'cv', sender_id: ALICE, body: '', attachments: [],
      sent_at: 'now', read_at: null, system_kind: null, protocol: 'e2e_v1', envelope: env,
    });
    expect(decrypted).toBe('hi via old prekey');
  });
});
