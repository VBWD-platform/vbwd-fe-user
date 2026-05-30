import { describe, it, expect, afterEach } from 'vitest';
import { meinchatPlusPlugin } from '../../../index';
import {
  getComposerPrecheck,
  getConversationOverlay,
  resetConversationExtensions,
} from '../../../../meinchat/src/ui/conversationExtensions';

describe('meinchat-plus activate() wires the meinchat UI seams', () => {
  afterEach(() => {
    meinchatPlusPlugin.deactivate?.();
    resetConversationExtensions();
  });

  it('registers the overlay + composer precheck on activate, clears on deactivate', () => {
    expect(getConversationOverlay()).toBeNull();
    meinchatPlusPlugin.activate?.();
    expect(getConversationOverlay()).not.toBeNull();
    expect(typeof getComposerPrecheck()).toBe('function');

    meinchatPlusPlugin.deactivate?.();
    expect(getConversationOverlay()).toBeNull();
    expect(getComposerPrecheck()).toBeNull();
  });

  it('the precheck lets plain conversations send without a network call', async () => {
    meinchatPlusPlugin.activate?.();
    const result = await getComposerPrecheck()!({ protocol: 'plain' } as any);
    expect(result.canSend).toBe(true);
  });
});
