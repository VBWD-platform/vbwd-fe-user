// UUID string <-> 16-byte representation. The envelope addresses recipients by
// their 16-byte device UUID — the same bytes the server validates against
// (`expected_device_ids` is `uuid.bytes`).

export function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) throw new Error(`uuidToBytes: bad uuid "${uuid}"`);
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToUuid(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new Error('bytesToUuid: need 16 bytes');
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}
