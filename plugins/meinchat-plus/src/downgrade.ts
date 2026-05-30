// S28.3b §3.6 — downgrade fail-closed.
//
// When the client demanded e2e (`accepted_protocols: ["e2e_v1"]`) it MUST
// refuse to use a conversation the server pinned to anything else. Never
// silently fall back to plaintext (critical-review §C14).

export class ProtocolDowngradeError extends Error {
  constructor(public readonly got: string) {
    super(
      `secure chat unavailable — server negotiated "${got}" but e2e_v1 was required`,
    );
    this.name = 'ProtocolDowngradeError';
  }
}

/** Throw unless the conversation was pinned to `e2e_v1`. */
export function assertE2e(conversation: { protocol?: string | null }): void {
  if (conversation.protocol !== 'e2e_v1') {
    throw new ProtocolDowngradeError(conversation.protocol ?? 'unknown');
  }
}
