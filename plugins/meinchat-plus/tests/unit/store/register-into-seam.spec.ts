import { describe, it, expect, vi, afterEach } from 'vitest';
import { registerCryptoProvider } from '../../../index';
import {
  getMessageCrypto,
  unregisterMessageCrypto,
} from '../../../../meinchat/src/crypto/messageCryptoRegistry';

describe('registerCryptoProvider wires into the meinchat store seam', () => {
  afterEach(() => unregisterMessageCrypto());

  it('registers a working provider the meinchat store can resolve', () => {
    expect(getMessageCrypto()).toBeNull();

    const unregister = registerCryptoProvider(
      { deviceId: 'd1', userId: 'u1' },
      { listUserDevices: vi.fn(), sendEnvelope: vi.fn() },
      { get: () => undefined, ensureOutbound: vi.fn() },
    );

    const provider = getMessageCrypto();
    expect(provider).not.toBeNull();
    expect(typeof provider!.sendEncryptedText).toBe('function');
    expect(typeof provider!.decryptRow).toBe('function');

    unregister();
    expect(getMessageCrypto()).toBeNull();
  });
});
