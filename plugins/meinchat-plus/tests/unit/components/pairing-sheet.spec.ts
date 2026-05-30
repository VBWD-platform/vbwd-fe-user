import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PairingSheet from '../../../src/components/PairingSheet.vue';

const t = (_key: string, fallback?: string) => fallback ?? _key;

function mountSheet(props: { status: string; busy?: boolean; error?: string }) {
  return mount(PairingSheet, {
    props: { busy: false, error: '', ...props } as any,
    global: { mocks: { $t: t } },
  });
}

describe('PairingSheet.vue', () => {
  it('shows the SET-passphrase title when unpaired', () => {
    const w = mountSheet({ status: 'unpaired' });
    expect(w.text()).toContain('Set a passphrase');
    expect(w.find('[data-testid="pairing-submit"]').text()).toContain('Enable secure chat');
  });

  it('shows the UNLOCK title when locked', () => {
    const w = mountSheet({ status: 'locked' });
    expect(w.text()).toContain('Unlock secure chat');
  });

  it('emits submit with the typed passphrase', async () => {
    const w = mountSheet({ status: 'unpaired' });
    await w.find('[data-testid="passphrase-input"]').setValue('hunter2');
    await w.find('form').trigger('submit');
    expect(w.emitted('submit')?.[0]).toEqual(['hunter2']);
  });

  it('disables the button while busy and shows errors', async () => {
    const busy = mountSheet({ status: 'locked', busy: true });
    expect(busy.find('[data-testid="pairing-submit"]').attributes('disabled')).toBeDefined();

    const errored = mountSheet({ status: 'locked', error: 'Wrong passphrase — try again.' });
    expect(errored.find('[data-testid="pairing-error"]').text()).toContain('Wrong passphrase');
  });

  it('does not emit submit with an empty passphrase', async () => {
    const w = mountSheet({ status: 'unpaired' });
    await w.find('form').trigger('submit');
    expect(w.emitted('submit')).toBeUndefined();
  });
});
