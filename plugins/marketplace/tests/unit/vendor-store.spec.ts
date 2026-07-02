import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '@/api';
import { useVendorStore } from '../../marketplace/stores/vendor';

describe('useVendorStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('checkVendorStatus marks the user a vendor when earnings load', async () => {
    vi.mocked(api.get).mockResolvedValue({
      earnings: [],
      withdrawable_balance: 42.5,
      currency: 'EUR',
      vendor: { id: 'v1', status: 'active' },
    });

    const store = useVendorStore();
    await store.checkVendorStatus();

    expect(store.isVendor).toBe(true);
    expect(store.withdrawableBalance).toBe(42.5);
    expect(store.vendorStatus).toBe('active');
  });

  it('checkVendorStatus treats 403 as "not a vendor"', async () => {
    vi.mocked(api.get).mockRejectedValue({ status: 403 });

    const store = useVendorStore();
    await store.checkVendorStatus();

    expect(store.isVendor).toBe(false);
    expect(store.error).toBeNull();
  });

  it('becomeVendor posts the display name and flips isVendor', async () => {
    vi.mocked(api.post).mockResolvedValue({
      vendor: { id: 'v2', status: 'pending' },
    });
    vi.mocked(api.get).mockResolvedValue({
      earnings: [],
      withdrawable_balance: 0,
      currency: 'EUR',
    });

    const store = useVendorStore();
    const ok = await store.becomeVendor('My Shop');

    expect(ok).toBe(true);
    expect(api.post).toHaveBeenCalledWith('/marketplace/become-vendor', {
      display_name: 'My Shop',
    });
    expect(store.isVendor).toBe(true);
  });

  it('createProduct returns the created entity', async () => {
    vi.mocked(api.post).mockResolvedValue({
      product: { id: 'p1', slug: 'gadget' },
    });

    const store = useVendorStore();
    const created = await store.createProduct({ name: 'Gadget', price: 9.99 });

    expect(api.post).toHaveBeenCalledWith('/shop/vendor/products', {
      name: 'Gadget',
      price: 9.99,
    });
    expect(created).toEqual({ id: 'p1', slug: 'gadget' });
  });

  it('loadListings aggregates + normalises across verticals and skips disabled ones', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/shop/vendor/products') {
        return Promise.resolve({
          products: [
            {
              id: 'p1',
              name: 'Gadget',
              price: '42.00',
              is_active: true,
              categories: [{ id: 'c1', name: 'Widgets' }],
            },
          ],
        });
      }
      if (url === '/subscription/vendor/plans') {
        return Promise.resolve({
          plans: [{ id: 'pl1', name: 'Pro', price: 19, is_active: false }],
        });
      }
      // ghrm + booking vendor-mode off → 403, must be skipped silently
      return Promise.reject({ status: 403 });
    });

    const store = useVendorStore();
    await store.loadListings();

    expect(store.error).toBeNull();
    expect(store.listings).toHaveLength(2);
    const product = store.listings.find(l => l.type === 'product');
    expect(product?.name).toBe('Gadget');
    expect(product?.price).toBe(42);
    expect(product?.category_name).toBe('Widgets');
    const plan = store.listings.find(l => l.type === 'plan');
    expect(plan?.is_active).toBe(false);
  });

  it('deleteListing removes the row from state on success', async () => {
    vi.mocked(api.delete).mockResolvedValue({ success: true });

    const store = useVendorStore();
    store.listings = [
      { type: 'product', id: 'p1', name: 'A', price: 1, is_active: true, raw: {} },
      { type: 'plan', id: 'pl1', name: 'B', price: 2, is_active: true, raw: {} },
    ];

    const ok = await store.deleteListing('product', 'p1');

    expect(ok).toBe(true);
    expect(api.delete).toHaveBeenCalledWith('/shop/vendor/products/p1');
    expect(store.listings).toHaveLength(1);
    expect(store.listings[0].id).toBe('pl1');
  });

  it('loadCategories populates the categories table', async () => {
    vi.mocked(api.get).mockResolvedValue({
      categories: [{ id: 'c1', name: 'Widgets', slug: 'widgets' }],
    });

    const store = useVendorStore();
    await store.loadCategories();

    expect(api.get).toHaveBeenCalledWith('/shop/vendor/categories');
    expect(store.categories).toHaveLength(1);
    expect(store.categories[0].name).toBe('Widgets');
  });

  it('loadSales populates the sales table', async () => {
    vi.mocked(api.get).mockResolvedValue({
      sales: [
        { invoice_id: 'inv1', gross_total: 100, net_credit_total: 80, lines: [] },
      ],
      total: 1,
      page: 1,
      per_page: 20,
    });

    const store = useVendorStore();
    await store.loadSales();

    expect(store.sales).toHaveLength(1);
    expect(store.sales[0].invoice_id).toBe('inv1');
    expect(store.salesTotal).toBe(1);
  });
});
