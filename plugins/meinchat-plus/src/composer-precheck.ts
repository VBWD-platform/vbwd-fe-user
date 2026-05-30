// S28.3b §3.7 — composer precheck.
//
// Before letting the user send into an e2e conversation, check the peer still
// has an active device key. If they revoked their only device, disable Send and
// show a hint ("@peer revoked their secure-chat device …"). A transient lookup
// error is non-fatal: enable optimistically and surface the error (the send
// path itself fails closed if the peer truly has no key).

export interface PrecheckResult {
  /** May the composer send? */
  canSendSecurely: boolean;
  /** UI hint shown when blocked (or on a transient error). */
  hint?: string;
  /** The device lookup failed transiently (optimistic enable). */
  transientError?: boolean;
}

export type ListDevices = (userId: string) => Promise<{ items: { id: string }[] }>;

export async function precheckPeerSecureChat(
  peerUserId: string,
  peerNickname: string | null,
  listUserDevices: ListDevices,
): Promise<PrecheckResult> {
  const who = peerNickname ? `@${peerNickname}` : 'this user';
  try {
    const { items } = await listUserDevices(peerUserId);
    if (!items || items.length === 0) {
      return {
        canSendSecurely: false,
        hint: `${who} has no secure-chat device — wait for them to re-pair.`,
      };
    }
    return { canSendSecurely: true };
  } catch {
    // §3.7 — optimistic enable on a transient error; the send fails closed if
    // the peer really has no device key.
    return {
      canSendSecurely: true,
      transientError: true,
      hint: `Couldn’t verify ${who}’s secure-chat status — sending anyway.`,
    };
  }
}
