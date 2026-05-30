import { describe, it, expect, vi } from 'vitest';
import {
  generateIdentity,
  generateOneTimePrekeys,
  generateSignedPrekey,
  type IdentityKeys,
  type KeyPair,
} from '../../../src/crypto/keys';
import { toBase64 } from '../../../src/base64';
import { SessionManager, type OwnDeviceMaterial } from '../../../src/session';
import { MeinchatPlusProvider } from '../../../src/provider';

const ALICE_USER = 'user-alice';
const BOB_USER = 'user-bob';
const ALICE_DEVICE = '11111111-1111-1111-1111-111111111111';
const BOB_DEVICE = '22222222-2222-2222-2222-222222222222';

interface Peer {
  identity: IdentityKeys;
  signedPrekey: { keyPair: KeyPair; signature: Uint8Array };
  oneTimePrekeys: KeyPair[];
}

function makePeer(): Peer {
  const identity = generateIdentity();
  return {
    identity,
    signedPrekey: generateSignedPrekey(identity),
    oneTimePrekeys: generateOneTimePrekeys(3),
  };
}

function own(p: Peer): OwnDeviceMaterial {
  return {
    identity: p.identity,
    signedPrekey: p.signedPrekey.keyPair,
    oneTimePrekeys: p.oneTimePrekeys,
  };
}

function bundleOf(p: Peer) {
  return {
    identity_key: toBase64(p.identity.ed25519.pub),
    signed_prekey: toBase64(p.signedPrekey.keyPair.pub),
    signed_prekey_signature: toBase64(p.signedPrekey.signature),
    one_time_prekey: toBase64(p.oneTimePrekeys[0].pub),
  };
}

function devicesApi(
  byUser: Record<string, { id: string; public_key: string }[]>,
  capture: { env?: string },
) {
  return {
    listUserDevices: vi.fn(async (userId: string) => ({
      items: byUser[userId] ?? [],
    })),
    sendEnvelope: vi.fn(async (_c: string, b64: string) => {
      capture.env = b64;
      return { id: `srv-${Math.random()}` };
    }),
  };
}

describe('cold-start: full session establishment with no prior sessions', () => {
  it('Alice (initiator) → Bob (responder cold-start), then bidirectional', async () => {
    const alice = makePeer();
    const bob = makePeer();
    const aliceDevices = [
      { id: ALICE_DEVICE, public_key: toBase64(alice.identity.ed25519.pub) },
    ];
    const bobDevices = [
      { id: BOB_DEVICE, public_key: toBase64(bob.identity.ed25519.pub) },
    ];

    // Alice's manager can fetch Bob's bundle; Bob's manager never fetches.
    const aliceMgr = new SessionManager(own(alice), {
      getPrekeyBundle: async (id) => {
        if (id !== BOB_DEVICE) throw new Error('unexpected device');
        return bundleOf(bob);
      },
    });
    const bobMgr = new SessionManager(own(bob), {
      getPrekeyBundle: async () => {
        throw new Error('responder never fetches');
      },
    });

    const aliceCap: { env?: string } = {};
    const bobCap: { env?: string } = {};
    const aliceApi = devicesApi(
      { [BOB_USER]: bobDevices, [ALICE_USER]: aliceDevices },
      aliceCap,
    );
    const bobApi = devicesApi(
      { [ALICE_USER]: aliceDevices, [BOB_USER]: bobDevices },
      bobCap,
    );

    const aliceProvider = new MeinchatPlusProvider(
      { deviceId: ALICE_DEVICE, userId: ALICE_USER },
      aliceApi,
      aliceMgr,
    );
    const bobProvider = new MeinchatPlusProvider(
      { deviceId: BOB_DEVICE, userId: BOB_USER },
      bobApi,
      bobMgr,
    );

    const rowFromAlice = (text: string) =>
      aliceProvider.sendEncryptedText('cv', BOB_USER, text).then(() => ({
        id: 'm', conversation_id: 'cv', sender_id: ALICE_USER, body: '',
        attachments: [], sent_at: 'now', read_at: null, system_kind: null,
        protocol: 'e2e_v1', envelope: aliceCap.env!,
      }));

    // 1) Alice's FIRST message carries the X3DH prekey material; Bob has no
    //    session yet and cold-starts the responder side from the header.
    const first = await rowFromAlice('hello bob');
    expect(bobMgr.get(ALICE_DEVICE)).toBeUndefined(); // no session before read
    expect(await bobProvider.decryptRow(first)).toBe('hello bob');
    expect(bobMgr.get(ALICE_DEVICE)).toBeDefined(); // established on read

    // 2) Alice's SECOND message has no prekey material (session reused).
    const second = await rowFromAlice('still alice');
    expect(await bobProvider.decryptRow(second)).toBe('still alice');

    // 3) Bob replies on the established session; Alice DH-ratchets + decrypts.
    await bobProvider.sendEncryptedText('cv', ALICE_USER, 'hey alice');
    const reply = {
      id: 'r', conversation_id: 'cv', sender_id: BOB_USER, body: '',
      attachments: [], sent_at: 'now', read_at: null, system_kind: null,
      protocol: 'e2e_v1', envelope: bobCap.env!,
    };
    expect(await aliceProvider.decryptRow(reply)).toBe('hey alice');
  });

  it('rejects a bundle whose signed-prekey signature does not verify', async () => {
    const bob = makePeer();
    const tampered = bundleOf(bob);
    tampered.signed_prekey_signature = toBase64(new Uint8Array(64).fill(9));
    const mgr = new SessionManager(own(makePeer()), {
      getPrekeyBundle: async () => tampered,
    });
    await expect(mgr.ensureOutbound(BOB_DEVICE)).rejects.toThrow(/signature/);
  });
});
