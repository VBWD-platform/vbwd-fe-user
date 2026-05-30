import { describe, it, expect } from 'vitest';
import { assertE2e, ProtocolDowngradeError } from '../../../src/downgrade';

describe('downgrade fail-closed (S28.3b §3.6)', () => {
  it('accepts an e2e_v1 conversation', () => {
    expect(() => assertE2e({ protocol: 'e2e_v1' })).not.toThrow();
  });

  it('refuses a plain conversation when e2e was demanded', () => {
    expect(() => assertE2e({ protocol: 'plain' })).toThrow(ProtocolDowngradeError);
  });

  it('refuses a missing/unknown protocol', () => {
    expect(() => assertE2e({})).toThrow(ProtocolDowngradeError);
    expect(() => assertE2e({ protocol: null })).toThrow(ProtocolDowngradeError);
  });
});
