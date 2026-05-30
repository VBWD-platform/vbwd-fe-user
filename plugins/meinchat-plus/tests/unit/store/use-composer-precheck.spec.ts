import { describe, it, expect, vi } from 'vitest';
import { useComposerPrecheck } from '../../../src/composables/useComposerPrecheck';

describe('useComposerPrecheck (S28.3b §3.7)', () => {
  it('enables Send when the peer has a device', async () => {
    const list = vi.fn(async () => ({ items: [{ id: 'd1' }] }));
    const pc = useComposerPrecheck('u-bob', 'bob', list);
    await pc.check();
    expect(pc.canSend.value).toBe(true);
    expect(pc.hint.value).toBe('');
    expect(pc.checking.value).toBe(false);
  });

  it('blocks Send + sets a hint when the peer has no device', async () => {
    const list = vi.fn(async () => ({ items: [] }));
    const pc = useComposerPrecheck('u-bob', 'bob', list);
    await pc.check();
    expect(pc.canSend.value).toBe(false);
    expect(pc.hint.value).toContain('@bob');
  });
});
