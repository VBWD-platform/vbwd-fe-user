// S28.3b §3.3 — reactive pairing state machine for the Vue UI.
//
// Wraps `pairNewDevice` / `unlockDevice` so a component can render a passphrase
// prompt and reflect status. `refresh()` resolves the initial state from
// storage (paired-but-locked vs never paired). On `pair`/`unlock` the crypto
// provider is registered into the meinchat store seam, so secure send/read
// start working immediately.

import { ref, type Ref } from 'vue';
import {
  isPaired,
  pairNewDevice,
  unlockDevice,
  WrongPassphraseError,
  type PairedSession,
} from '../pairing';
import type { KeyValueStore } from '../persistence';
import type { ProviderApi } from '../provider';
import type { BundleApi } from '../session';

export type PairingStatus = 'unknown' | 'unpaired' | 'locked' | 'ready';

export interface UsePairingOptions {
  userId: string;
  providerApi: ProviderApi;
  bundleApi: BundleApi;
  /** Resolve the KV store (IndexedDB in the app; in-memory in tests). */
  kv: () => Promise<KeyValueStore>;
}

export interface UsePairing {
  status: Ref<PairingStatus>;
  error: Ref<string>;
  busy: Ref<boolean>;
  refresh(): Promise<void>;
  pair(passphrase: string): Promise<void>;
  unlock(passphrase: string): Promise<void>;
  lock(): void;
  saveSessions(): Promise<void>;
}

export function usePairing(opts: UsePairingOptions): UsePairing {
  const status = ref<PairingStatus>('unknown');
  const error = ref('');
  const busy = ref(false);
  let session: PairedSession | null = null;
  let store: KeyValueStore | null = null;

  async function kv(): Promise<KeyValueStore> {
    if (!store) store = await opts.kv();
    return store;
  }

  async function refresh(): Promise<void> {
    status.value = (await isPaired(await kv())) ? 'locked' : 'unpaired';
  }

  async function run(
    build: (store: KeyValueStore) => Promise<PairedSession>,
  ): Promise<void> {
    busy.value = true;
    error.value = '';
    try {
      session = await build(await kv());
      status.value = 'ready';
    } finally {
      busy.value = false;
    }
  }

  async function pair(passphrase: string): Promise<void> {
    await run((store) =>
      pairNewDevice({
        kv: store,
        passphrase,
        userId: opts.userId,
        providerApi: opts.providerApi,
        bundleApi: opts.bundleApi,
      }),
    );
  }

  async function unlock(passphrase: string): Promise<void> {
    try {
      await run((store) =>
        unlockDevice({
          kv: store,
          passphrase,
          userId: opts.userId,
          providerApi: opts.providerApi,
          bundleApi: opts.bundleApi,
        }),
      );
    } catch (e) {
      if (e instanceof WrongPassphraseError) {
        error.value = 'Wrong passphrase — try again.';
        return;
      }
      throw e;
    }
  }

  function lock(): void {
    session?.lock();
    session = null;
    status.value = 'locked';
  }

  async function saveSessions(): Promise<void> {
    await session?.saveSessions();
  }

  return { status, error, busy, refresh, pair, unlock, lock, saveSessions };
}
