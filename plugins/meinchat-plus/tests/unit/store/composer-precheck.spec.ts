import { describe, it, expect, vi } from 'vitest';
import { precheckPeerSecureChat } from '../../../src/composer-precheck';

describe('composer precheck (S28.3b §3.7)', () => {
  it('enables Send when the peer has an active device', async () => {
    const list = vi.fn(async () => ({ items: [{ id: 'd1' }] }));
    const r = await precheckPeerSecureChat('u-bob', 'bob', list);
    expect(r.canSendSecurely).toBe(true);
    expect(r.hint).toBeUndefined();
  });

  it('blocks Send with a hint when the peer has no device', async () => {
    const list = vi.fn(async () => ({ items: [] }));
    const r = await precheckPeerSecureChat('u-bob', 'bob', list);
    expect(r.canSendSecurely).toBe(false);
    expect(r.hint).toContain('@bob');
  });

  it('optimistically enables + flags a transient lookup error', async () => {
    const list = vi.fn(async () => {
      throw new Error('network');
    });
    const r = await precheckPeerSecureChat('u-bob', 'bob', list);
    expect(r.canSendSecurely).toBe(true);
    expect(r.transientError).toBe(true);
    expect(r.hint).toContain('@bob');
  });

  it('falls back to a generic noun when the nickname is unknown', async () => {
    const list = vi.fn(async () => ({ items: [] }));
    const r = await precheckPeerSecureChat('u-bob', null, list);
    expect(r.hint).toContain('this user');
  });
});
