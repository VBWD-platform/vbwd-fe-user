import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

vi.mock('../../../src/composables/usePairing', () => ({ usePairing: vi.fn() }));
vi.mock('../../../src/persistence', () => ({ createIdbKeyValueStore: vi.fn() }));

import { usePairing } from '../../../src/composables/usePairing';
import SecureChatGate from '../../../src/components/SecureChatGate.vue';

const t = (_k: string, fallback?: string) => fallback ?? _k;

function stubPairing(status: string) {
  const obj = {
    status: ref(status),
    busy: ref(false),
    error: ref(''),
    refresh: vi.fn(),
    pair: vi.fn(),
    unlock: vi.fn(),
    lock: vi.fn(),
    saveSessions: vi.fn(),
  };
  (usePairing as any).mockReturnValue(obj);
  return obj;
}

function mountGate(protocol: string, status = 'locked') {
  stubPairing(status);
  return mount(SecureChatGate, {
    props: { conversation: { protocol } },
    global: { mocks: { $t: t } },
  });
}

describe('SecureChatGate.vue', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows the pairing sheet for an e2e conversation that is not ready', () => {
    const w = mountGate('e2e_v1', 'locked');
    expect(w.find('[data-testid="pairing-sheet"]').exists()).toBe(true);
  });

  it('renders nothing for a plain conversation', () => {
    const w = mountGate('plain', 'locked');
    expect(w.find('[data-testid="pairing-sheet"]').exists()).toBe(false);
  });

  it('renders nothing once secure chat is ready', () => {
    const w = mountGate('e2e_v1', 'ready');
    expect(w.find('[data-testid="pairing-sheet"]').exists()).toBe(false);
  });

  it('pairs on submit when unpaired, unlocks otherwise', async () => {
    const pairing = stubPairing('unpaired');
    const w = mount(SecureChatGate, {
      props: { conversation: { protocol: 'e2e_v1' } },
      global: { mocks: { $t: t } },
    });
    await w.find('[data-testid="passphrase-input"]').setValue('pw');
    await w.find('form').trigger('submit');
    expect(pairing.pair).toHaveBeenCalledWith('pw');
    expect(pairing.unlock).not.toHaveBeenCalled();
  });
});
