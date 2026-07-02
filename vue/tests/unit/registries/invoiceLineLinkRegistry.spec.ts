import { describe, it, expect, beforeEach } from 'vitest';
import {
  invoiceLineLinkRegistry,
  type InvoiceLineItemLike,
} from '@/registries/invoiceLineLinkRegistry';

beforeEach(() => invoiceLineLinkRegistry.clear());

describe('invoiceLineLinkRegistry', () => {
  it('returns null when nothing is registered', () => {
    expect(invoiceLineLinkRegistry.resolve({ type: 'CUSTOM' })).toBeNull();
  });

  it('returns a registered resolver result for a matching line', () => {
    invoiceLineLinkRegistry.register((item: InvoiceLineItemLike) =>
      item.type === 'DATASET' ? '/dashboard/datasets/air-quality' : null,
    );
    expect(
      invoiceLineLinkRegistry.resolve({ type: 'DATASET' }),
    ).toBe('/dashboard/datasets/air-quality');
  });

  it('returns null when no registered resolver matches', () => {
    invoiceLineLinkRegistry.register((item) =>
      item.type === 'DATASET' ? '/dashboard/datasets/x' : null,
    );
    expect(invoiceLineLinkRegistry.resolve({ type: 'SUBSCRIPTION' })).toBeNull();
  });

  it('returns the FIRST non-null result when several resolvers are registered', () => {
    invoiceLineLinkRegistry.register(() => null);
    invoiceLineLinkRegistry.register(() => '/first-match');
    invoiceLineLinkRegistry.register(() => '/second-match');
    expect(invoiceLineLinkRegistry.resolve({ type: 'CUSTOM' })).toBe('/first-match');
  });

  it('clear() wipes all registered resolvers (test isolation)', () => {
    invoiceLineLinkRegistry.register(() => '/x');
    expect(invoiceLineLinkRegistry.resolve({ type: 'CUSTOM' })).toBe('/x');
    invoiceLineLinkRegistry.clear();
    expect(invoiceLineLinkRegistry.resolve({ type: 'CUSTOM' })).toBeNull();
  });
});
