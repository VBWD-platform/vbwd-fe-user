import { defineStore } from 'pinia';
import { api } from '@/api';
import type { ProductClass } from '../gates';

/** The active-region compliance facts the storefront renders (no hardcoding). */
export interface PharmaRegion {
  country_code: string;
  name: string;
  locale: string;
  display_currency: string;
  national_code_scheme: string;
  national_register_url: string;
  registered_pharmacy_logo_url: string;
  pharmacovigilance_url: string;
  withdrawal_right_copy: string;
  default_age_restriction_years: number | null;
  default_max_quantity_per_order: number | null;
}

/** The per-product regulated profile (assembled server-side from S77 fields). */
export interface PharmaProfile {
  product_class: ProductClass | string | null;
  active_substances: string[] | null;
  strength: string | null;
  pharmaceutical_form: string | null;
  atc_code: string | null;
  marketing_authorisation_holder: string | null;
  device_marking: string | null;
  leaflet_url: string | null;
  smpc_url: string | null;
  pharmacovigilance_url: string | null;
  storage_conditions: string | null;
  warnings: string | null;
  age_restriction_years: number | null;
  max_quantity_per_order: number | null;
  professional_only: boolean | null;
  withdrawal_right_exempt: boolean | null;
}

export interface CatalogueProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  primary_image_url: string | null;
  pharma_profile: PharmaProfile;
}

export interface CatalogueSegment {
  category_name: string;
  category_slug: string;
  product_class: ProductClass | string;
  products: CatalogueProduct[];
}

interface CatalogueResponse {
  region: PharmaRegion;
  segments: CatalogueSegment[];
}

interface RegionResponse {
  region: PharmaRegion;
}

export const usePharmacyStore = defineStore('pharmacyStorefront', {
  state: () => ({
    region: null as PharmaRegion | null,
    segments: [] as CatalogueSegment[],
    loading: false,
    error: null as string | null,
  }),

  getters: {
    /** Catalogue segments that actually have products (empty classes hidden). */
    populatedSegments(): CatalogueSegment[] {
      return this.segments.filter((segment) => segment.products.length > 0);
    },
  },

  actions: {
    async fetchCatalogue(categorySlug?: string): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const query = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : '';
        const response = await api.get<CatalogueResponse>(`/pharma/catalogue${query}`);
        this.region = response.region;
        this.segments = response.segments;
      } catch (fetchError) {
        this.error = (fetchError as Error).message || 'Failed to load the pharmacy catalogue';
      } finally {
        this.loading = false;
      }
    },

    async fetchRegion(): Promise<void> {
      if (this.region) {
        return;
      }
      try {
        const response = await api.get<RegionResponse>('/pharma/region');
        this.region = response.region;
      } catch {
        // Region is best-effort context; the product page still renders without it.
      }
    },
  },
});
