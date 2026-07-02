/**
 * Vendor dashboard Pinia store.
 *
 * Holds the current user's vendor status, earnings balance, sales and
 * earnings ledgers. All data is fetched via REAL API calls against the
 * live backend (see ../api).
 */
import { defineStore } from 'pinia';
import {
  becomeVendor,
  createBookingResource,
  createCategory,
  createPlan,
  createProduct,
  createSoftware,
  deleteCategory,
  deletePackage,
  deletePlan,
  deleteProduct,
  deleteResource,
  getCategoryById,
  getMyEarnings,
  getMySales,
  getPackage,
  getPlan,
  getProduct,
  getResource,
  listCategories,
  listPackages,
  listPlans,
  listProducts,
  listResources,
  normaliseListing,
  updateCategory,
  updatePackage,
  updatePlan,
  updateProduct,
  updateResource,
  type BookingResourcePayload,
  type CategoryPayload,
  type CategoryRow,
  type CreatedEntity,
  type EarningRow,
  type Listing,
  type ListingType,
  type PlanPayload,
  type ProductPayload,
  type SaleRow,
  type SoftwarePayload,
  type Vendor,
} from '../api';

interface VendorState {
  /** null = unknown (not yet probed), true/false = resolved. */
  isVendor: boolean | null;
  vendor: Vendor | null;
  vendorStatus: string | null;
  withdrawableBalance: number | null;
  currency: string;
  sales: SaleRow[];
  salesTotal: number;
  earnings: EarningRow[];
  listings: Listing[];
  categories: CategoryRow[];
  loading: boolean;
  error: string | null;
}

/** Per-vertical listing loaders keyed by listing type. */
const LISTING_LOADERS: Record<
  ListingType,
  () => Promise<Listing[]>
> = {
  product: () =>
    listProducts().then((response) =>
      (response.products ?? []).map((raw) => normaliseListing('product', raw)),
    ),
  plan: () =>
    listPlans().then((response) =>
      (response.plans ?? []).map((raw) => normaliseListing('plan', raw)),
    ),
  software: () =>
    listPackages().then((response) =>
      (response.packages ?? []).map((raw) => normaliseListing('software', raw)),
    ),
  booking: () =>
    listResources().then((response) =>
      (response.resources ?? []).map((raw) => normaliseListing('booking', raw)),
    ),
};

function toMessage(caught: unknown): string {
  if (caught instanceof Error) return caught.message;
  return String(caught);
}

/** Treat 401/403/404 from the earnings probe as "not a vendor yet". */
function isNotVendorError(caught: unknown): boolean {
  const status = (caught as { status?: number } | null)?.status;
  return status === 401 || status === 403 || status === 404;
}

/**
 * A per-vertical list call that fails with 403 (vendor-mode off) or 404
 * (plugin/route absent) is expected — that vertical simply contributes no
 * listings. Only other failures should surface as an error.
 */
function isSkippableError(caught: unknown): boolean {
  const status = (caught as { status?: number } | null)?.status;
  return status === 403 || status === 404;
}

export const useVendorStore = defineStore('marketplaceVendor', {
  state: (): VendorState => ({
    isVendor: null,
    vendor: null,
    vendorStatus: null,
    withdrawableBalance: null,
    currency: 'EUR',
    sales: [],
    salesTotal: 0,
    earnings: [],
    listings: [],
    categories: [],
    loading: false,
    error: null,
  }),

  actions: {
    /**
     * Probe vendor status by loading the earnings endpoint. Success means
     * the user is an onboarded vendor; a 401/403/404 means they are not yet
     * a vendor and should see the "become a vendor" form.
     */
    async checkVendorStatus(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const data = await getMyEarnings();
        this.isVendor = true;
        this.withdrawableBalance = Number(data.withdrawable_balance) || 0;
        this.currency = data.currency || this.currency;
        this.earnings = data.earnings ?? [];
        if (data.vendor) {
          this.vendor = data.vendor;
          this.vendorStatus = data.vendor.status;
        } else if (!this.vendorStatus) {
          this.vendorStatus = 'active';
        }
      } catch (caught) {
        if (isNotVendorError(caught)) {
          this.isVendor = false;
        } else {
          this.error = toMessage(caught);
        }
      } finally {
        this.loading = false;
      }
    },

    async becomeVendor(displayName: string): Promise<boolean> {
      this.loading = true;
      this.error = null;
      try {
        const data = await becomeVendor({ display_name: displayName });
        this.vendor = data.vendor;
        this.vendorStatus = data.vendor.status;
        this.isVendor = true;
        // A freshly-created vendor has no earnings yet, and while it is still
        // `pending` the self-service earnings endpoint is permission-gated
        // (403) — probing it here would be misread as "not a vendor" and flip
        // the dashboard back to the onboarding form. Seed a zero balance and
        // let the earnings page load real figures once the vendor is approved.
        this.withdrawableBalance = this.withdrawableBalance ?? 0;
        return true;
      } catch (caught) {
        this.error = toMessage(caught);
        return false;
      } finally {
        this.loading = false;
      }
    },

    async loadSales(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const data = await getMySales();
        this.sales = data.sales ?? [];
        this.salesTotal = data.total ?? this.sales.length;
      } catch (caught) {
        this.error = toMessage(caught);
      } finally {
        this.loading = false;
      }
    },

    async loadEarnings(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const data = await getMyEarnings();
        this.earnings = data.earnings ?? [];
        this.withdrawableBalance = Number(data.withdrawable_balance) || 0;
        this.currency = data.currency || this.currency;
        if (data.vendor) {
          this.vendor = data.vendor;
          this.vendorStatus = data.vendor.status;
        }
      } catch (caught) {
        this.error = toMessage(caught);
      } finally {
        this.loading = false;
      }
    },

    async createProduct(payload: ProductPayload): Promise<CreatedEntity | null> {
      return this.runCreate(() =>
        createProduct(payload).then((response) => response.product),
      );
    },

    async createCategory(
      payload: CategoryPayload,
    ): Promise<CreatedEntity | null> {
      return this.runCreate(() =>
        createCategory(payload).then((response) => response.category),
      );
    },

    async createPlan(payload: PlanPayload): Promise<CreatedEntity | null> {
      return this.runCreate(() =>
        createPlan(payload).then((response) => response.plan),
      );
    },

    async createSoftware(
      payload: SoftwarePayload,
    ): Promise<CreatedEntity | null> {
      return this.runCreate(() =>
        createSoftware(payload).then((response) => response.package),
      );
    },

    async createBookingResource(
      payload: BookingResourcePayload,
    ): Promise<CreatedEntity | null> {
      return this.runCreate(() =>
        createBookingResource(payload).then((response) => response.resource),
      );
    },

    /**
     * Load the vendor's listings across all four verticals. A vertical whose
     * vendor-mode is off (403) or whose plugin is absent (404) is skipped, so a
     * partially-enabled marketplace still lists what it can. Only an unexpected
     * failure (e.g. 500) surfaces as an error.
     */
    async loadListings(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const results = await Promise.allSettled(
          (Object.keys(LISTING_LOADERS) as ListingType[]).map((type) =>
            LISTING_LOADERS[type](),
          ),
        );
        const collected: Listing[] = [];
        for (const result of results) {
          if (result.status === 'fulfilled') {
            collected.push(...result.value);
          } else if (!isSkippableError(result.reason)) {
            this.error = toMessage(result.reason);
          }
        }
        this.listings = collected;
      } finally {
        this.loading = false;
      }
    },

    async loadCategories(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const data = await listCategories();
        this.categories = data.categories ?? [];
      } catch (caught) {
        if (!isSkippableError(caught)) {
          this.error = toMessage(caught);
        }
        this.categories = [];
      } finally {
        this.loading = false;
      }
    },

    /** Delete one listing by type; returns true on success. */
    async deleteListing(type: ListingType, id: string): Promise<boolean> {
      const deleters: Record<ListingType, (id: string) => Promise<unknown>> = {
        product: deleteProduct,
        plan: deletePlan,
        software: deletePackage,
        booking: deleteResource,
      };
      try {
        await deleters[type](id);
        this.listings = this.listings.filter(
          (listing) => !(listing.type === type && listing.id === id),
        );
        return true;
      } catch (caught) {
        this.error = toMessage(caught);
        return false;
      }
    },

    /** Toggle a listing's active flag via its vertical's update endpoint. */
    async setListingActive(
      type: ListingType,
      id: string,
      isActive: boolean,
    ): Promise<boolean> {
      const updaters: Record<
        ListingType,
        (id: string, payload: { is_active: boolean }) => Promise<unknown>
      > = {
        product: updateProduct,
        plan: updatePlan,
        software: updatePackage,
        booking: updateResource,
      };
      try {
        await updaters[type](id, { is_active: isActive });
        const target = this.listings.find(
          (listing) => listing.type === type && listing.id === id,
        );
        if (target) target.is_active = isActive;
        return true;
      } catch (caught) {
        this.error = toMessage(caught);
        return false;
      }
    },

    /** Fetch a single listing's raw payload for the edit form. */
    async fetchListing(
      type: ListingType,
      id: string,
    ): Promise<Record<string, unknown> | null> {
      const getters: Record<
        ListingType,
        (id: string) => Promise<Record<string, unknown>>
      > = {
        product: (targetId) => getProduct(targetId).then((r) => r.product),
        plan: (targetId) => getPlan(targetId).then((r) => r.plan),
        software: (targetId) => getPackage(targetId).then((r) => r.package),
        booking: (targetId) => getResource(targetId).then((r) => r.resource),
      };
      this.loading = true;
      this.error = null;
      try {
        return await getters[type](id);
      } catch (caught) {
        this.error = toMessage(caught);
        return null;
      } finally {
        this.loading = false;
      }
    },

    /** Persist an edit to a single listing. Returns true on success. */
    async updateListing(
      type: ListingType,
      id: string,
      payload: Record<string, unknown>,
    ): Promise<boolean> {
      const updaters: Record<
        ListingType,
        (id: string, payload: Record<string, unknown>) => Promise<unknown>
      > = {
        product: (targetId, body) => updateProduct(targetId, body),
        plan: (targetId, body) => updatePlan(targetId, body),
        software: (targetId, body) => updatePackage(targetId, body),
        booking: (targetId, body) => updateResource(targetId, body),
      };
      this.loading = true;
      this.error = null;
      try {
        await updaters[type](id, payload);
        return true;
      } catch (caught) {
        this.error = toMessage(caught);
        return false;
      } finally {
        this.loading = false;
      }
    },

    async fetchCategory(id: string): Promise<CategoryRow | null> {
      this.loading = true;
      this.error = null;
      try {
        return (await getCategoryById(id)).category;
      } catch (caught) {
        this.error = toMessage(caught);
        return null;
      } finally {
        this.loading = false;
      }
    },

    async updateCategory(
      id: string,
      payload: CategoryPayload & { description?: string },
    ): Promise<boolean> {
      this.loading = true;
      this.error = null;
      try {
        await updateCategory(id, payload);
        return true;
      } catch (caught) {
        this.error = toMessage(caught);
        return false;
      } finally {
        this.loading = false;
      }
    },

    async deleteCategory(id: string): Promise<boolean> {
      try {
        await deleteCategory(id);
        this.categories = this.categories.filter(
          (category) => category.id !== id,
        );
        return true;
      } catch (caught) {
        this.error = toMessage(caught);
        return false;
      }
    },

    /** Shared create wrapper — normalises loading/error handling. */
    async runCreate(
      fn: () => Promise<CreatedEntity>,
    ): Promise<CreatedEntity | null> {
      this.loading = true;
      this.error = null;
      try {
        return await fn();
      } catch (caught) {
        this.error = toMessage(caught);
        return null;
      } finally {
        this.loading = false;
      }
    },
  },
});
