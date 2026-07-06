/**
 * Oracle tests for the pharmacy product page (S101.3):
 *  - RX disables purchase ("prescription required")
 *  - OTC renders the region logo + leaflet + withdrawal copy from the fetched
 *    region object (no hardcoded jurisdiction) and caps quantity at the gate
 *  - add-to-cart routes OTC into the shared shop cart store
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { api } from '@/api';
import PharmacyProduct from '../../shop-pharma/views/PharmacyProduct.vue';
import { useCartStore } from '../../../shop/shop/stores/cart';

const storage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
});

vi.mock('@/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { slug: 'sample' } }),
  useRouter: () => ({ push: vi.fn() }),
}));

const region = {
  country_code: 'DE',
  name: 'Germany',
  locale: 'de-DE',
  display_currency: 'EUR',
  national_code_scheme: 'PZN',
  national_register_url: 'https://register.example/de',
  registered_pharmacy_logo_url: 'https://logo.example/eu-common-logo.png',
  pharmacovigilance_url: 'https://pv.example/de',
  withdrawal_right_copy: 'Withdrawal right excluded for sealed medicines once unsealed.',
  default_age_restriction_years: 0,
  default_max_quantity_per_order: 5,
};

function baseProfile(overrides: Record<string, unknown> = {}) {
  return {
    product_class: 'OTC',
    active_substances: ['acetylsalicylic_acid'],
    strength: '100 mg',
    pharmaceutical_form: 'tablet',
    atc_code: null,
    marketing_authorisation_holder: null,
    device_marking: null,
    leaflet_url: 'https://leaflets.example/sample.pdf',
    smpc_url: null,
    pharmacovigilance_url: null,
    storage_conditions: null,
    warnings: 'Read the package leaflet before use.',
    age_restriction_years: null,
    max_quantity_per_order: 3,
    professional_only: false,
    withdrawal_right_exempt: false,
    ...overrides,
  };
}

function makeProduct(overrides: Record<string, unknown> = {}, profileOverrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    name: 'Aspirin 100mg',
    slug: 'sample',
    description: 'A demo OTC medicine.',
    price: 4.99,
    primary_image_url: '/uploads/images/sample.png',
    images: [{ url: '/uploads/images/sample.png', is_primary: true }],
    has_variants: true,
    pharma_profile: baseProfile(profileOverrides),
    variants: [
      { id: 'var-20', name: 'Pack of 20', sku: 'X-20', price: 4.99, price_float: 4.99, attributes: { pack: 'Pack of 20' } },
      { id: 'var-50', name: 'Pack of 50', sku: 'X-50', price: 9.99, price_float: 9.99, attributes: { pack: 'Pack of 50' } },
    ],
    region,
    ...overrides,
  };
}

async function mountProduct(product: Record<string, unknown>) {
  vi.mocked(api.get).mockResolvedValue({ product });
  const wrapper = mount(PharmacyProduct, {
    global: { stubs: { RouterLink: RouterLinkStub } },
  });
  await flushPromises();
  return wrapper;
}

describe('PharmacyProduct page', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('renders the region logo, leaflet and withdrawal copy from the fetched region', async () => {
    const wrapper = await mountProduct(makeProduct());
    const logo = wrapper.find('[data-testid="pharmacy-product-region-logo"]');
    expect(logo.exists()).toBe(true);
    expect(logo.attributes('src')).toBe(region.registered_pharmacy_logo_url);

    const leaflet = wrapper.find('[data-testid="pharmacy-product-leaflet"]');
    expect(leaflet.exists()).toBe(true);
    expect(leaflet.attributes('href')).toBe('https://leaflets.example/sample.pdf');

    expect(wrapper.find('[data-testid="pharmacy-product-register-link"]').attributes('href'))
      .toBe(region.national_register_url);
    expect(wrapper.find('[data-testid="pharmacy-product-pharmacovigilance"]').attributes('href'))
      .toBe(region.pharmacovigilance_url);
    expect(wrapper.find('[data-testid="pharmacy-product-withdrawal"]').exists()).toBe(true);
  });

  it('BLOCKS purchase for an RX product (prescription required)', async () => {
    const wrapper = await mountProduct(
      makeProduct({}, { product_class: 'RX' }),
    );
    expect(wrapper.find('[data-testid="pharmacy-product-rx-block"]').exists()).toBe(true);
    const addButton = wrapper.find('[data-testid="pharmacy-product-add-to-cart"]');
    expect((addButton.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('adds an OTC product to the shared shop cart', async () => {
    const wrapper = await mountProduct(makeProduct());
    const cart = useCartStore();
    expect(cart.itemCount).toBe(0);

    await wrapper.find('[data-testid="pharmacy-product-add-to-cart"]').trigger('click');
    await flushPromises();

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe('prod-1');
    expect(cart.items[0].productName).toContain('Pack of 20');
  });

  it('caps the OTC quantity at the per-order max', async () => {
    const wrapper = await mountProduct(makeProduct());
    const incButton = wrapper.find('[data-testid="pharmacy-product-qty-inc"]');
    // max_quantity_per_order is 3; click far past it
    for (let click = 0; click < 6; click += 1) {
      await incButton.trigger('click');
    }
    expect(wrapper.find('[data-testid="pharmacy-product-qty-value"]').text()).toBe('3');
    expect(wrapper.find('[data-testid="pharmacy-product-qty-note"]').text()).toContain('3');
  });

  it('shows an age gate that blocks add-to-cart until confirmed', async () => {
    const wrapper = await mountProduct(
      makeProduct({}, { age_restriction_years: 18 }),
    );
    expect(wrapper.find('[data-testid="pharmacy-product-age-gate"]').exists()).toBe(true);
    const addButton = wrapper.find('[data-testid="pharmacy-product-add-to-cart"]');
    expect((addButton.element as HTMLButtonElement).disabled).toBe(true);

    await wrapper.find('[data-testid="pharmacy-product-age-confirm"]').trigger('click');
    await flushPromises();
    expect((addButton.element as HTMLButtonElement).disabled).toBe(false);
  });
});
