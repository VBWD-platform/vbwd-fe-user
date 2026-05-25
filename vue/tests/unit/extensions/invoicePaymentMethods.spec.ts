import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerInvoicePaymentMethod,
  getInvoicePaymentMethods,
  _resetInvoicePaymentMethods,
} from '@/extensions/invoicePaymentMethods';

beforeEach(() => _resetInvoicePaymentMethods());

describe('invoicePaymentMethods registry (agnostic seam)', () => {
  it('starts empty', () => {
    expect(getInvoicePaymentMethods()).toEqual([]);
  });

  it('returns components in registration order', () => {
    const first = { name: 'First' };
    const second = { name: 'Second' };
    registerInvoicePaymentMethod(first);
    registerInvoicePaymentMethod(second);
    const methods = getInvoicePaymentMethods();
    expect(methods).toHaveLength(2);
    expect(methods[0]).toBe(first);
    expect(methods[1]).toBe(second);
  });
});
