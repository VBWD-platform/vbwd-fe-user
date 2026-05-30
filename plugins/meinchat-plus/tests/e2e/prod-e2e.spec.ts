/**
 * Production meinchat-plus smoke — exercises the E2E key-distribution surface
 * on a real target host and asserts the encrypted protocol is wired end-to-end
 * (manifest enabled → device register → signed prekey → one-time prekeys →
 * prekey-bundle fetch → conversation negotiates `e2e_v1`).
 *
 * This is an API-level smoke: it does NOT need a paired browser device (the
 * KEK/passphrase + IndexedDB session store live only client-side and are out of
 * scope for a host smoke). It proves the server half of X3DH works and that the
 * conversation serializer flips to the encrypted protocol once both peers have
 * an active device with a signed prekey.
 *
 * Env (credentials NEVER hardcoded — this spec ships in a public repo):
 *   VBWD_HOST           target host                  default: vbwd.cc
 *   VBWD_ADMIN_EMAIL    user 1 — sender              required
 *   VBWD_ADMIN_PASSWORD                               required
 *   VBWD_ADMIN_NICKNAME meinchat handle for sender   default: chatuser-a
 *   VBWD_PEER_EMAIL     user 2 — receiver            required
 *   VBWD_PEER_PASSWORD                                required
 *   VBWD_PEER_NICKNAME  meinchat handle for receiver default: chatuser-b
 *
 * Run:
 *   VBWD_ADMIN_EMAIL=… VBWD_ADMIN_PASSWORD=… \
 *   VBWD_PEER_EMAIL=…  VBWD_PEER_PASSWORD=…  \
 *   npx playwright test prod-e2e
 *
 * Note: the keys generated here are ed25519/x25519 *test* keys minted in-spec
 * (via @noble/curves) — they register real device rows on the host, so use a
 * disposable test instance, not production user data.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { ed25519, x25519, edwardsToMontgomeryPub } from '@noble/curves/ed25519';

const HOST = process.env.VBWD_HOST || 'vbwd.cc';
const BASE = `https://${HOST}`;
const ADMIN = {
  email: process.env.VBWD_ADMIN_EMAIL ?? '',
  password: process.env.VBWD_ADMIN_PASSWORD ?? '',
  nickname: process.env.VBWD_ADMIN_NICKNAME || 'chatuser-a',
};
const PEER = {
  email: process.env.VBWD_PEER_EMAIL ?? '',
  password: process.env.VBWD_PEER_PASSWORD ?? '',
  nickname: process.env.VBWD_PEER_NICKNAME || 'chatuser-b',
};

const SUFFICIENT = ADMIN.email && ADMIN.password && PEER.email && PEER.password;

const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

async function login(req: APIRequestContext, email: string, password: string): Promise<string> {
  const r = await req.post(`${BASE}/api/v1/auth/login`, { data: { email, password } });
  expect(r.status(), `login ${email}`).toBe(200);
  const body = await r.json();
  expect(body.token).toBeTruthy();
  return body.token;
}

async function ensureNickname(req: APIRequestContext, token: string, nickname: string) {
  const set = await req.put(`${BASE}/api/v1/nickname/me`, {
    headers: { authorization: `Bearer ${token}` },
    data: { nickname },
  });
  if (![200, 409].includes(set.status())) {
    throw new Error(`set nickname ${nickname}: ${set.status()} ${await set.text()}`);
  }
}

/** Mint an identity + signed prekey + one-time prekey and publish them all,
 *  returning the registered device id. Mirrors the fe-user `registration.ts`
 *  flow but with self-contained @noble key material. */
async function provisionDevice(
  req: APIRequestContext,
  token: string,
): Promise<{ deviceId: string; identityPub: Uint8Array }> {
  const h = { authorization: `Bearer ${token}` };

  // Identity = one Ed25519 key (server stores + verifies signed prekeys with it).
  const identityPriv = ed25519.utils.randomPrivateKey();
  const identityPub = ed25519.getPublicKey(identityPriv);

  const reg = await req.post(`${BASE}/api/v1/messaging/me/devices`, {
    headers: h,
    data: { public_key: b64(identityPub), algorithm: 'ed25519', label: 'e2e-smoke' },
  });
  expect([200, 201], `register device: ${await reg.text()}`).toContain(reg.status());
  const deviceId: string = (await reg.json()).id;

  // Signed prekey: an X25519 pub signed by the Ed25519 identity.
  const spkPriv = x25519.utils.randomPrivateKey();
  const spkPub = x25519.getPublicKey(spkPriv);
  const spkSig = ed25519.sign(spkPub, identityPriv);
  const signed = await req.post(`${BASE}/api/v1/messaging/me/prekeys/signed`, {
    headers: h,
    data: { device_id: deviceId, signed_prekey: b64(spkPub), signature: b64(spkSig) },
  });
  expect(signed.status(), `signed prekey: ${await signed.text()}`).toBe(201);

  // A small batch of one-time prekeys.
  const otks = Array.from({ length: 5 }, () => b64(x25519.getPublicKey(x25519.utils.randomPrivateKey())));
  const ot = await req.post(`${BASE}/api/v1/messaging/me/prekeys/one-time`, {
    headers: h,
    data: { device_id: deviceId, prekeys: otks },
  });
  expect(ot.status(), `one-time prekeys: ${await ot.text()}`).toBe(201);

  return { deviceId, identityPub };
}

test.describe(`${HOST} meinchat-plus — E2E key distribution`, () => {
  test.skip(!SUFFICIENT, 'VBWD_ADMIN_* and VBWD_PEER_* env vars must be set');

  test('meinchat_plus is enabled in the runtime manifest', async ({ request }) => {
    const r = await request.get(`${BASE}/plugins.json`);
    expect(r.status()).toBe(200);
    const { plugins } = await r.json();
    expect(plugins['meinchat-plus'] ?? plugins.meinchat_plus, 'meinchat-plus manifest entry').toBeTruthy();
  });

  test('device → signed prekey → one-time prekeys → bundle round-trips', async ({ request }) => {
    const token = await login(request, ADMIN.email, ADMIN.password);
    const { deviceId, identityPub } = await provisionDevice(request, token);

    // Any authenticated user can fetch the published bundle (consumes one OTK).
    const peerToken = await login(request, PEER.email, PEER.password);
    const bundle = await request.get(
      `${BASE}/api/v1/messaging/devices/${deviceId}/prekey-bundle`,
      { headers: { authorization: `Bearer ${peerToken}` } },
    );
    expect(bundle.status(), `bundle: ${await bundle.text()}`).toBe(200);
    const body = await bundle.json();
    expect(body.identity_key).toBe(b64(identityPub));
    expect(body.signed_prekey, 'bundle carries a signed prekey').toBeTruthy();
    expect(body.signed_prekey_signature, 'bundle carries the signature').toBeTruthy();
    // Verify the signature client-side, exactly as the responder does.
    const ok = ed25519.verify(
      Buffer.from(body.signed_prekey_signature, 'base64'),
      Buffer.from(body.signed_prekey, 'base64'),
      Buffer.from(body.identity_key, 'base64'),
    );
    expect(ok, 'signed prekey signature must verify against the identity key').toBe(true);
    // Sanity: the identity Ed25519 key maps to a usable X25519 key (the "one
    // identity, two uses" projection the client relies on for ECDH).
    expect(edwardsToMontgomeryPub(identityPub)).toHaveLength(32);
  });

  test('conversation negotiates the e2e_v1 protocol once both peers have a device', async ({ request }) => {
    const adminToken = await login(request, ADMIN.email, ADMIN.password);
    const peerToken = await login(request, PEER.email, PEER.password);
    await ensureNickname(request, adminToken, ADMIN.nickname);
    await ensureNickname(request, peerToken, PEER.nickname);
    await provisionDevice(request, adminToken);
    await provisionDevice(request, peerToken);

    // The client offers its accepted protocols; the server negotiates e2e_v1
    // iff the peer has an active device key (both provisioned above) — else it
    // falls back to 'plain'.
    const conv = await request.post(`${BASE}/api/v1/messaging/conversations`, {
      headers: { authorization: `Bearer ${adminToken}` },
      data: { peer_nickname: PEER.nickname, accepted_protocols: ['e2e_v1', 'plain'] },
    });
    expect([200, 201]).toContain(conv.status());
    const body = await conv.json();
    expect(body.protocol, `conversation protocol: ${JSON.stringify(body)}`).toBe('e2e_v1');
  });
});
