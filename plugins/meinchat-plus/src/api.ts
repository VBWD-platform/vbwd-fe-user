// S28.3b §2.8 — typed client for the meinchat-plus device/prekey endpoints
// plus the e2e message + attachment routes. Mirrors the meinchat plugin's
// fetch + Bearer-from-localStorage convention.

export interface DeviceDto {
  id: string;
  public_key: string; // base64 Ed25519 identity pub
  algorithm: string;
  label: string | null;
}

export interface PrekeyBundleDto {
  device_id: string;
  identity_key: string; // base64 Ed25519 identity pub
  signed_prekey: string; // base64
  signed_prekey_signature: string; // base64
  one_time_prekey: string | null; // base64 or null when the pool is empty
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}`,
    ...extra,
  };
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw body;
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export async function registerDevice(input: {
  publicKeyB64: string;
  algorithm?: string;
  label?: string;
}): Promise<DeviceDto> {
  const res = await fetch('/api/v1/messaging/me/devices', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      public_key: input.publicKeyB64,
      algorithm: input.algorithm,
      label: input.label,
    }),
  });
  return jsonOrThrow<DeviceDto>(res);
}

export async function listUserDevices(userId: string): Promise<{ items: DeviceDto[] }> {
  const res = await fetch(`/api/v1/messaging/users/${userId}/devices`, {
    headers: authHeaders(),
  });
  return jsonOrThrow<{ items: DeviceDto[] }>(res);
}

export async function revokeDevice(deviceId: string): Promise<void> {
  const res = await fetch(`/api/v1/messaging/me/devices/${deviceId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return jsonOrThrow<void>(res);
}

export async function uploadSignedPrekey(input: {
  deviceId: string;
  signedPrekeyB64: string;
  signatureB64: string;
}): Promise<{ id: string }> {
  const res = await fetch('/api/v1/messaging/me/prekeys/signed', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      device_id: input.deviceId,
      signed_prekey: input.signedPrekeyB64,
      signature: input.signatureB64,
    }),
  });
  return jsonOrThrow<{ id: string }>(res);
}

/** Upload one-time prekeys; returns the low-water flag from the response header. */
export async function uploadOneTimePrekeys(
  deviceId: string,
  prekeysB64: string[],
): Promise<{ uploaded: number; lowWater: boolean }> {
  const res = await fetch('/api/v1/messaging/me/prekeys/one-time', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ device_id: deviceId, prekeys: prekeysB64 }),
  });
  const lowWater = res.headers.get('X-Prekey-Low-Water') === 'true';
  const body = await jsonOrThrow<{ uploaded: number }>(res);
  return { uploaded: body.uploaded, lowWater };
}

export async function getPrekeyBundle(deviceId: string): Promise<PrekeyBundleDto> {
  const res = await fetch(`/api/v1/messaging/devices/${deviceId}/prekey-bundle`, {
    headers: authHeaders(),
  });
  return jsonOrThrow<PrekeyBundleDto>(res);
}

/** Start (or fetch) an e2e_v1 conversation, demanding e2e (fail-closed). */
export async function startE2eConversation(
  peerNickname: string,
): Promise<{ id: string; protocol?: string }> {
  const res = await fetch('/api/v1/messaging/conversations', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      peer_nickname: peerNickname,
      accepted_protocols: ['e2e_v1'],
    }),
  });
  return jsonOrThrow<{ id: string; protocol?: string }>(res);
}

export async function sendEnvelope(
  conversationId: string,
  envelopeB64: string,
): Promise<{ id: string }> {
  const res = await fetch(
    `/api/v1/messaging/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ envelope_b64: envelopeB64 }),
    },
  );
  return jsonOrThrow<{ id: string }>(res);
}

/** Upload a client-encrypted attachment blob for an existing e2e message. */
export async function uploadAttachment(input: {
  messageId: string;
  kind: 'fullres' | 'thumb';
  ciphertextB64: string;
  envelopeHeader: unknown;
  mime: string;
}): Promise<{ id: string }> {
  const res = await fetch(
    `/api/v1/messaging/messages/${input.messageId}/attachments`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        kind: input.kind,
        ciphertext_b64: input.ciphertextB64,
        envelope_header: input.envelopeHeader,
        mime: input.mime,
      }),
    },
  );
  return jsonOrThrow<{ id: string }>(res);
}

/** Download the raw (opaque ciphertext) attachment bytes. */
export async function downloadAttachment(attachmentId: string): Promise<Uint8Array> {
  const res = await fetch(`/api/v1/messaging/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw body;
  }
  return new Uint8Array(await res.arrayBuffer());
}
