import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/pairing', async () => {
  const actual = await vi.importActual<any>('../../../src/pairing');
  return {
    ...actual,
    isPaired: vi.fn(),
    pairNewDevice: vi.fn(),
    unlockDevice: vi.fn(),
  };
});

import { isPaired, pairNewDevice, unlockDevice, WrongPassphraseError } from '../../../src/pairing';
import { InMemoryKeyValueStore } from '../../../src/persistence';
import { usePairing } from '../../../src/composables/usePairing';

function make() {
  return usePairing({
    userId: 'u1',
    providerApi: { listUserDevices: vi.fn(), sendEnvelope: vi.fn() },
    bundleApi: { getPrekeyBundle: vi.fn() },
    kv: async () => new InMemoryKeyValueStore(),
  });
}

const fakeSession = () => ({ deviceId: 'd1', sessions: {}, saveSessions: vi.fn(), lock: vi.fn() });

describe('usePairing state machine (S28.3b §3.3)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('refresh → unpaired when no device is stored', async () => {
    (isPaired as any).mockResolvedValue(false);
    const p = make();
    await p.refresh();
    expect(p.status.value).toBe('unpaired');
  });

  it('refresh → locked when a device exists', async () => {
    (isPaired as any).mockResolvedValue(true);
    const p = make();
    await p.refresh();
    expect(p.status.value).toBe('locked');
  });

  it('pair → ready', async () => {
    (pairNewDevice as any).mockResolvedValue(fakeSession());
    const p = make();
    await p.pair('pw');
    expect(pairNewDevice).toHaveBeenCalledOnce();
    expect(p.status.value).toBe('ready');
    expect(p.busy.value).toBe(false);
  });

  it('unlock → ready', async () => {
    (unlockDevice as any).mockResolvedValue(fakeSession());
    const p = make();
    await p.unlock('pw');
    expect(p.status.value).toBe('ready');
  });

  it('unlock with a wrong passphrase surfaces an error (no throw)', async () => {
    (unlockDevice as any).mockRejectedValue(new WrongPassphraseError());
    const p = make();
    await p.unlock('bad');
    expect(p.status.value).not.toBe('ready');
    expect(p.error.value).toMatch(/wrong passphrase/i);
  });

  it('lock → locked + saveSessions delegates to the session', async () => {
    const session = fakeSession();
    (pairNewDevice as any).mockResolvedValue(session);
    const p = make();
    await p.pair('pw');
    await p.saveSessions();
    expect(session.saveSessions).toHaveBeenCalledOnce();
    p.lock();
    expect(session.lock).toHaveBeenCalledOnce();
    expect(p.status.value).toBe('locked');
  });
});
