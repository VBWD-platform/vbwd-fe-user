import { describe, it, expect, vi } from 'vitest';
import {
  generateIdentity,
  generateSignedPrekey,
  generateX25519,
} from '../../../src/crypto/keys';
import { deriveInitiatorSecret, deriveResponderSecret } from '../../../src/crypto/x3dh';
import { initAlice, initBob, type RatchetState } from '../../../src/crypto/ratchet';
import { MeinchatPlusProvider, type SessionStore } from '../../../src/provider';

const ALICE_USER = 'user-alice';
const BOB_USER = 'user-bob';
const ALICE_DEVICE = '00000000-0000-0000-0000-0000000000bb';
const BOB_DEVICE = '00000000-0000-0000-0000-0000000000aa';

// Establish a mutual Alice↔Bob ratchet pair (X3DH → Double Ratchet).
function sessionPair(): { alice: RatchetState; bob: RatchetState } {
  const alice = generateIdentity();
  const bob = generateIdentity();
  const bobSpk = generateSignedPrekey(bob);
  const opk = generateX25519();
  const eph = generateX25519();
  const a = deriveInitiatorSecret(alice.x25519, eph, {
    identityX25519: bob.x25519.pub,
    signedPrekey: bobSpk.keyPair.pub,
    oneTimePrekey: opk.pub,
  });
  const b = deriveResponderSecret(bob.x25519, bobSpk.keyPair, opk, alice.x25519.pub, eph.pub);
  return {
    alice: initAlice(a.sharedSecret, bobSpk.keyPair.pub),
    bob: initBob(b.sharedSecret, bobSpk.keyPair),
  };
}

function store(map: Record<string, RatchetState>): SessionStore {
  return {
    get: (id) => map[id],
    ensureOutbound: async (id) => {
      if (!map[id]) throw new Error(`no session for ${id}`);
      return map[id];
    },
  };
}

describe('MeinchatPlusProvider end-to-end (real crypto)', () => {
  it('Alice encrypts + posts; Bob decrypts the same plaintext', async () => {
    const { alice, bob } = sessionPair();

    let postedEnvelope = '';
    const aliceApi = {
      listUserDevices: vi.fn(async (userId: string) =>
        userId === BOB_USER
          ? { items: [{ id: BOB_DEVICE }] }
          : { items: [{ id: ALICE_DEVICE }] },
      ),
      sendEnvelope: vi.fn(async (_conv: string, b64: string) => {
        postedEnvelope = b64;
        return { id: 'srv-1' };
      }),
    };
    const aliceProvider = new MeinchatPlusProvider(
      { deviceId: ALICE_DEVICE, userId: ALICE_USER },
      aliceApi,
      store({ [BOB_DEVICE]: alice }),
    );

    const row = await aliceProvider.sendEncryptedText('cv-1', BOB_USER, 'attack at dawn');
    expect(aliceApi.sendEnvelope).toHaveBeenCalledOnce();
    expect(row.protocol).toBe('e2e_v1');
    expect(row.body).toBe('');

    // Bob receives the posted envelope and decrypts his slot.
    const bobApi = {
      listUserDevices: vi.fn(async () => ({ items: [{ id: ALICE_DEVICE }] })),
      sendEnvelope: vi.fn(),
    };
    const bobProvider = new MeinchatPlusProvider(
      { deviceId: BOB_DEVICE, userId: BOB_USER },
      bobApi,
      store({ [ALICE_DEVICE]: bob }),
    );
    const plaintext = await bobProvider.decryptRow({
      id: 'srv-1', conversation_id: 'cv-1', sender_id: ALICE_USER, body: '',
      attachments: [], sent_at: 'now', read_at: null, system_kind: null,
      protocol: 'e2e_v1', envelope: postedEnvelope,
    });
    expect(plaintext).toBe('attack at dawn');
  });

  it('decryptRow returns null when no session / wrong slot (never throws)', async () => {
    const bobApi = {
      listUserDevices: vi.fn(async () => ({ items: [{ id: ALICE_DEVICE }] })),
      sendEnvelope: vi.fn(),
    };
    const provider = new MeinchatPlusProvider(
      { deviceId: BOB_DEVICE, userId: BOB_USER },
      bobApi,
      store({}), // no sessions
    );
    const out = await provider.decryptRow({
      id: 'x', conversation_id: 'cv-1', sender_id: ALICE_USER, body: '',
      attachments: [], sent_at: 'now', read_at: null, system_kind: null,
      protocol: 'e2e_v1', envelope: 'AAAA',
    });
    expect(out).toBeNull();
  });
});
