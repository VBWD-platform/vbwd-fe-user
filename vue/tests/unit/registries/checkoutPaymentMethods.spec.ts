import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerCheckoutPaymentMethod,
  getCheckoutPaymentMethod,
  _resetCheckoutPaymentMethods,
} from '@/registries/checkoutPaymentMethods';

beforeEach(() => _resetCheckoutPaymentMethods());

describe('checkoutPaymentMethods registry', () => {
  it('returns undefined when code is not registered', () => {
    expect(getCheckoutPaymentMethod('token_balance')).toBeUndefined();
  });

  it('stores detailComponent and instantPay per code', () => {
    const detail = { name: 'TokenCheckoutQuote' };
    const pay = vi.fn(async () => ({ status: 'PAID' }));
    registerCheckoutPaymentMethod('token_balance', { detailComponent: detail, instantPay: pay });

    const entry = getCheckoutPaymentMethod('token_balance');
    expect(entry).toBeDefined();
    expect(entry?.detailComponent).toBe(detail);
    expect(entry?.instantPay).toBe(pay);
  });

  it('keys are independent — other codes are unaffected', () => {
    registerCheckoutPaymentMethod('a', { instantPay: vi.fn() });
    registerCheckoutPaymentMethod('b', { instantPay: vi.fn() });
    expect(getCheckoutPaymentMethod('a')).not.toBe(getCheckoutPaymentMethod('b'));
  });

  it('register merges fields (separate calls can add detail then pay)', () => {
    const detail = { name: 'D' };
    const pay = vi.fn();
    registerCheckoutPaymentMethod('x', { detailComponent: detail });
    registerCheckoutPaymentMethod('x', { instantPay: pay });
    const entry = getCheckoutPaymentMethod('x');
    expect(entry?.detailComponent).toBe(detail);
    expect(entry?.instantPay).toBe(pay);
  });
});
