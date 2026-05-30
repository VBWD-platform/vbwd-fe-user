// S28.3b §2.4 / §3.4 — CBOR envelope packing.
//
// The wire format the server `SignalEnvelopeValidator` validates (it parses
// the CBOR structure but NEVER the ciphertext):
//
//   { v: 1,
//     per_recipient: [ { device_id: bytes, ciphertext: bytes, header: bytes }, … ],
//     pad: bytes }            // padding so the whole blob is a 256-byte multiple
//
// `cbor-x` encodes `Uint8Array` as CBOR byte strings (major type 2), which
// Python `cbor2` on the server decodes as `bytes` — so the two ends interop.

import { Encoder, decode as cborDecode } from 'cbor-x';

// Plain CBOR maps (no cbor-x "records"/struct tags) so the bytes match what
// Python cbor2 expects. `useRecords:false` keeps objects as standard maps.
const encoder = new Encoder({ useRecords: false, tagUint8Array: false });

const BLOCK = 256;

export interface RecipientSlot {
  deviceId: Uint8Array;
  ciphertext: Uint8Array;
  header: Uint8Array;
}

interface WireSlot {
  device_id: Uint8Array;
  ciphertext: Uint8Array;
  header: Uint8Array;
}

function encodeWith(slots: WireSlot[], pad: Uint8Array): Uint8Array {
  return new Uint8Array(
    encoder.encode({ v: 1, per_recipient: slots, pad }),
  );
}

/** Pack per-recipient slots into the server-validated CBOR envelope, padded
 *  so its total length is a 256-byte multiple. Throws on an empty slot list
 *  (the server rejects that too). */
export function packEnvelope(slots: RecipientSlot[]): Uint8Array {
  if (!slots.length) throw new Error('packEnvelope: per_recipient must be non-empty');
  const wire: WireSlot[] = slots.map((s) => ({
    device_id: s.deviceId,
    ciphertext: s.ciphertext,
    header: s.header,
  }));
  let padLen = (BLOCK - (encodeWith(wire, new Uint8Array(0)).length % BLOCK)) % BLOCK;
  for (let i = 0; i < 6; i++) {
    const blob = encodeWith(wire, new Uint8Array(padLen));
    const remainder = blob.length % BLOCK;
    if (remainder === 0) return blob;
    padLen += BLOCK - remainder;
  }
  // Should converge in <=2 iterations; fall back to the last attempt.
  return encodeWith(wire, new Uint8Array(padLen));
}

export interface DecodedEnvelope {
  v: number;
  per_recipient: WireSlot[];
}

export function unpackEnvelope(bytes: Uint8Array): DecodedEnvelope {
  const decoded = cborDecode(bytes) as DecodedEnvelope;
  if (!decoded || decoded.v !== 1 || !Array.isArray(decoded.per_recipient)) {
    throw new Error('unpackEnvelope: malformed envelope');
  }
  return decoded;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Return the slot addressed to `ownDeviceId`, or null if none. */
export function findOwnSlot(
  env: DecodedEnvelope,
  ownDeviceId: Uint8Array,
): WireSlot | null {
  return (
    env.per_recipient.find((s) =>
      bytesEqual(new Uint8Array(s.device_id), ownDeviceId),
    ) ?? null
  );
}
