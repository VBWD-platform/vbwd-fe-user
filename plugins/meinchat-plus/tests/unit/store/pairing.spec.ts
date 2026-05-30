import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateIdentity,
  generateOneTimePrekeys,
  generateSignedPrekey,
} from '../../../src/crypto/keys';
import { toBase64 } from '../../../src/base64';
import { InMemoryKeyValueStore } from '../../../src/persistence';
import { MeinchatPlusProvider } from '../../../src/provider';
import {
  isPaired,
  pairNewDevice,
  unlockDevice,
  WrongPassphraseError,
} from '../../../src/pairing';
import {
  getMessageCrypto,
  unregisterMessageCrypto,
} from '../../../../meinchat/src/crypto/messageCryptoRegistry';

// Fast Argon2id params so the test isn't slow; pair + unlock MUST match.
const KEK = { memorySizeKiB: 512, iterations: 1, parallelism: 1 };

function makeRegister(deviceId: string) {
  const captured: { identity?: ReturnType<typeof generateIdentity>; spk?: any; otks?: any } = {};
  const register = async () => {
    const identity = generateIdentity();
    const spk = generateSignedPrekey(identity);
    const otks = generateOneTimePrekeys(2);
    Object.assign(captured, { identity, spk, otks });
    return { deviceId, identity, signedPrekey: spk.keyPair, oneTimePrekeys: otks };
  };
  return { register, captured };
}

const noopApis = () => ({
  providerApi: { listUserDevices: vi.fn(), sendEnvelope: vi.fn() },
  bundleApi: { getPrekeyBundle: vi.fn() },
});

afterEach(() => unregisterMessageCrypto());

describe('pairing — pair / persist / unlock', () => {
  it('pairs, persists, registers the provider, and unlocks with the passphrase', async () => {
    const kv = new InMemoryKeyValueStore();
    const { providerApi, bundleApi } = noopApis();
    const { register } = makeRegister('dev-1');

    expect(await isPaired(kv)).toBe(false);
    const paired = await pairNewDevice({
      kv, passphrase: 'correct horse', userId: 'u1',
      providerApi, bundleApi, register, kekParams: KEK,
    });
    expect(paired.deviceId).toBe('dev-1');
    expect(getMessageCrypto()).not.toBeNull(); // provider wired into the seam
    expect(await isPaired(kv)).toBe(true);

    paired.lock();
    expect(getMessageCrypto()).toBeNull();

    const reopened = await unlockDevice({
      kv, passphrase: 'correct horse', userId: 'u1',
      providerApi, bundleApi, kekParams: KEK,
    });
    expect(reopened.deviceId).toBe('dev-1');
    expect(getMessageCrypto()).not.toBeNull();
  });

  it('rejects a wrong passphrase on unlock', async () => {
    const kv = new InMemoryKeyValueStore();
    const { providerApi, bundleApi } = noopApis();
    const { register } = makeRegister('dev-1');
    await pairNewDevice({
      kv, passphrase: 'right', userId: 'u1', providerApi, bundleApi, register, kekParams: KEK,
    });
    unregisterMessageCrypto();
    await expect(
      unlockDevice({ kv, passphrase: 'WRONG', userId: 'u1', providerApi, bundleApi, kekParams: KEK }),
    ).rejects.toBeInstanceOf(WrongPassphraseError);
  });
});

describe('pairing — full pair → send → persist → unlock → receive', () => {
  it('a reloaded device keeps decrypting after unlock', async () => {
    const ALICE = 'u-alice';
    const BOB = 'u-bob';
    const ALICE_DEV = '11111111-1111-1111-1111-111111111111';
    const BOB_DEV = '22222222-2222-2222-2222-222222222222';

    const aliceKv = new InMemoryKeyValueStore();
    const bobKv = new InMemoryKeyValueStore();
    const aliceReg = makeRegister(ALICE_DEV);
    const bobReg = makeRegister(BOB_DEV);

    const bundleOf = (c: typeof bobReg.captured) => ({
      identity_key: toBase64(c.identity!.ed25519.pub),
      signed_prekey: toBase64(c.spk.keyPair.pub),
      signed_prekey_signature: toBase64(c.spk.signature),
      one_time_prekey: toBase64(c.otks[0].pub),
    });

    // Pair Bob first so we can build his bundle for Alice.
    const bobPaired = await pairNewDevice({
      kv: bobKv, passphrase: 'bobpw', userId: BOB,
      providerApi: noopApis().providerApi, bundleApi: { getPrekeyBundle: vi.fn() },
      register: bobReg.register, kekParams: KEK,
    });
    const aliceBundleApi = { getPrekeyBundle: vi.fn(async () => bundleOf(bobReg.captured)) };
    const alicePaired = await pairNewDevice({
      kv: aliceKv, passphrase: 'alicepw', userId: ALICE,
      providerApi: noopApis().providerApi, bundleApi: aliceBundleApi,
      register: aliceReg.register, kekParams: KEK,
    });

    const aliceDevices = [{ id: ALICE_DEV, public_key: toBase64(aliceReg.captured.identity!.ed25519.pub) }];
    const bobDevices = [{ id: BOB_DEV, public_key: toBase64(bobReg.captured.identity!.ed25519.pub) }];
    const cap: { env?: string } = {};
    const aliceProviderApi = {
      listUserDevices: vi.fn(async (u: string) => ({ items: u === BOB ? bobDevices : aliceDevices })),
      sendEnvelope: vi.fn(async (_c: string, b: string) => { cap.env = b; return { id: 's' }; }),
    };
    const bobProviderApi = {
      listUserDevices: vi.fn(async (u: string) => ({ items: u === ALICE ? aliceDevices : bobDevices })),
      sendEnvelope: vi.fn(),
    };

    const mkRow = (env: string) => ({
      id: 'm', conversation_id: 'cv', sender_id: ALICE, body: '', attachments: [],
      sent_at: 'now', read_at: null, system_kind: null, protocol: 'e2e_v1', envelope: env,
    });

    // Alice → Bob (cold-start), using the paired session managers.
    const aliceP = new MeinchatPlusProvider({ deviceId: ALICE_DEV, userId: ALICE }, aliceProviderApi, alicePaired.sessions);
    const bobP = new MeinchatPlusProvider({ deviceId: BOB_DEV, userId: BOB }, bobProviderApi, bobPaired.sessions);
    await aliceP.sendEncryptedText('cv', BOB, 'hello after pairing');
    expect(await bobP.decryptRow(mkRow(cap.env!))).toBe('hello after pairing');

    // Persist + lock both, then unlock and decrypt a follow-up message.
    await alicePaired.saveSessions();
    await bobPaired.saveSessions();
    alicePaired.lock();
    bobPaired.lock();

    const aliceUnlocked = await unlockDevice({
      kv: aliceKv, passphrase: 'alicepw', userId: ALICE,
      providerApi: aliceProviderApi, bundleApi: aliceBundleApi, kekParams: KEK,
    });
    const bobUnlocked = await unlockDevice({
      kv: bobKv, passphrase: 'bobpw', userId: BOB,
      providerApi: bobProviderApi, bundleApi: { getPrekeyBundle: vi.fn() }, kekParams: KEK,
    });
    const aliceP2 = new MeinchatPlusProvider({ deviceId: ALICE_DEV, userId: ALICE }, aliceProviderApi, aliceUnlocked.sessions);
    const bobP2 = new MeinchatPlusProvider({ deviceId: BOB_DEV, userId: BOB }, bobProviderApi, bobUnlocked.sessions);
    await aliceP2.sendEncryptedText('cv', BOB, 'after unlock');
    expect(await bobP2.decryptRow(mkRow(cap.env!))).toBe('after unlock');
  });
});
