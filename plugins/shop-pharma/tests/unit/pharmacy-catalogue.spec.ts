/**
 * Oracle tests for the pharmacy catalogue (S101.3): the storefront segments the
 * S101.1 catalogue by product_class, hides empty segments, and surfaces the
 * active-region logo — all from the fetched objects (no hardcoded jurisdiction).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { api } from '@/api';
import { usePharmacyStore } from '../../shop-pharma/stores/pharmacy';
import PharmacyCatalogue from '../../shop-pharma/views/PharmacyCatalogue.vue';

vi.mock('@/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {} }),
  useRouter: () => ({ push: vi.fn() }),
}));

const catalogueResponse = {
  region: {
    country_code: 'DE',
    name: 'Germany',
    registered_pharmacy_logo_url: 'https://logo.example/eu.png',
    default_age_restriction_years: 0,
    default_max_quantity_per_order: 5,
  },
  segments: [
    {
      category_name: 'Prescription medicines',
      category_slug: 'prescription-medicines',
      product_class: 'RX',
      products: [
        { id: 'rx-1', name: 'Amoxicillin', slug: 'amoxicillin', price: 5, primary_image_url: null, pharma_profile: { product_class: 'RX' } },
      ],
    },
    {
      category_name: 'Over-the-counter medicines',
      category_slug: 'otc-medicines',
      product_class: 'OTC',
      products: [
        { id: 'otc-1', name: 'Aspirin', slug: 'aspirin', price: 4.99, primary_image_url: '/uploads/images/aspirin.png', pharma_profile: { product_class: 'OTC', strength: '100 mg' } },
      ],
    },
    {
      category_name: 'Empty class',
      category_slug: 'empty-class',
      product_class: 'FMCG_HOSPITAL',
      products: [],
    },
  ],
};

describe('pharmacy catalogue store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loads region + segments and hides empty segments', async () => {
    vi.mocked(api.get).mockResolvedValue(catalogueResponse);
    const store = usePharmacyStore();
    await store.fetchCatalogue();

    expect(store.region?.country_code).toBe('DE');
    expect(store.segments).toHaveLength(3);
    expect(store.populatedSegments.map((segment) => segment.product_class)).toEqual(['RX', 'OTC']);
  });

  it('passes a category filter into the request', async () => {
    vi.mocked(api.get).mockResolvedValue(catalogueResponse);
    const store = usePharmacyStore();
    await store.fetchCatalogue('otc-medicines');
    expect(vi.mocked(api.get)).toHaveBeenCalledWith('/pharma/catalogue?category=otc-medicines');
  });
});

describe('PharmacyCatalogue view', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('renders one section per populated class with the region logo', async () => {
    vi.mocked(api.get).mockResolvedValue(catalogueResponse);
    const wrapper = mount(PharmacyCatalogue, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="pharmacy-region-logo"]').attributes('src'))
      .toBe('https://logo.example/eu.png');
    expect(wrapper.find('[data-testid="pharmacy-segment-RX"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pharmacy-segment-OTC"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pharmacy-segment-FMCG_HOSPITAL"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="pharmacy-card-aspirin"]').exists()).toBe(true);
  });
});
