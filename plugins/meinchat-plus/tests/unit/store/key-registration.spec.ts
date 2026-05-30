import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '../../../src/api';
import { registerThisDevice, refillOneTimePrekeys } from '../../../src/registration';
import { verifySignedPrekey } from '../../../src/crypto/keys';
import { fromBase64 } from '../../../src/base64';

vi.mock('../../../src/api');

describe('device key registration (S28.3b §3.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.registerDevice as any).mockResolvedValue({
      id: 'dev-1', public_key: 'x', algorithm: 'a', label: 'laptop',
    });
    (api.uploadSignedPrekey as any).mockResolvedValue({ id: 'spk-1' });
    (api.uploadOneTimePrekeys as any).mockResolvedValue({ uploaded: 100, lowWater: false });
  });

  it('uploads only public material; signed prekey verifies against the registered key', async () => {
    const reg = await registerThisDevice('laptop', 100);

    // The registered device public_key is the Ed25519 identity pub.
    const regArg = (api.registerDevice as any).mock.calls[0][0];
    expect(fromBase64(regArg.publicKeyB64)).toEqual(reg.identity.ed25519.pub);

    // The uploaded signed-prekey signature verifies against that identity.
    const spkArg = (api.uploadSignedPrekey as any).mock.calls[0][0];
    expect(
      verifySignedPrekey(
        fromBase64(spkArg.signedPrekeyB64),
        fromBase64(spkArg.signatureB64),
        reg.identity.ed25519.pub,
      ),
    ).toBe(true);

    // 100 one-time prekeys uploaded; the secrets are returned to persist.
    const otkArg = (api.uploadOneTimePrekeys as any).mock.calls[0];
    expect(otkArg[1]).toHaveLength(100);
    expect(reg.oneTimePrekeys).toHaveLength(100);
  });

  it('refill uploads a fresh batch of one-time prekeys', async () => {
    const fresh = await refillOneTimePrekeys('dev-1', 50);
    expect(fresh).toHaveLength(50);
    expect((api.uploadOneTimePrekeys as any).mock.calls[0][0]).toBe('dev-1');
    expect((api.uploadOneTimePrekeys as any).mock.calls[0][1]).toHaveLength(50);
  });
});
