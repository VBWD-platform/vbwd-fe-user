/**
 * Marketplace vendor API wrappers.
 *
 * Thin typed wrappers over the shared authenticated `api` client
 * (`@/api`). The user JWT (localStorage['auth_token']) auto-attaches.
 * Every call maps 1:1 to the vendor API contract; responses are returned
 * unwrapped (the ApiClient already returns the parsed JSON body).
 */
import { api } from '@/api';

export type BillingPeriod = 'MONTHLY' | 'YEARLY' | 'ONE_TIME';

export interface Vendor {
  id: string;
  status: string;
  display_name?: string;
  [key: string]: unknown;
}

export interface SaleLine {
  [key: string]: unknown;
}

export interface SaleRow {
  invoice_id: string;
  gross_total: number | string;
  net_credit_total: number | string;
  lines: SaleLine[];
}

export interface SalesResponse {
  sales: SaleRow[];
  total: number;
  page: number;
  per_page: number;
}

export interface EarningRow {
  gross: number | string;
  commission: number | string;
  net_credit: number | string;
  status: string;
  [key: string]: unknown;
}

export interface EarningsResponse {
  earnings: EarningRow[];
  withdrawable_balance: number | string;
  currency: string;
  vendor?: Vendor;
}

export interface BecomeVendorPayload {
  display_name: string;
}

export interface ProductPayload {
  name: string;
  slug?: string;
  description?: string;
  price: number;
  is_active?: boolean;
  is_digital?: boolean;
}

export interface CategoryPayload {
  name: string;
  slug?: string;
}

export interface PlanPayload {
  name: string;
  slug?: string;
  description?: string;
  price: number;
  billing_period: BillingPeriod;
  features?: Record<string, unknown>;
  trial_days?: number;
}

export interface SoftwarePayload {
  name: string;
  slug?: string;
  description?: string;
  github_owner: string;
  github_repo: string;
  price: number;
  billing_period?: BillingPeriod;
}

export interface BookingResourcePayload {
  name: string;
  slug?: string;
  description?: string;
  price: number;
  capacity?: number;
  price_unit?: string;
}

/** Generic created-entity shape — every vertical returns `{ <key>: {...} }`. */
export interface CreatedEntity {
  id?: string;
  slug?: string;
  [key: string]: unknown;
}

/** The four sellable verticals a vendor can list in. */
export type ListingType = 'product' | 'plan' | 'software' | 'booking';

/**
 * A vertical-agnostic listing row for the "My listings" table. Each vertical's
 * raw payload is normalised into this common shape; `raw` keeps the original so
 * the edit form can prefill vertical-specific fields.
 */
export interface Listing {
  type: ListingType;
  id: string;
  name: string;
  slug?: string;
  price: number;
  is_active: boolean;
  category_id?: string;
  category_name?: string;
  raw: Record<string, unknown>;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  product_count?: number;
  [key: string]: unknown;
}

export function becomeVendor(
  payload: BecomeVendorPayload,
): Promise<{ vendor: Vendor }> {
  return api.post<{ vendor: Vendor }>('/marketplace/become-vendor', payload);
}

export function getMySales(): Promise<SalesResponse> {
  return api.get<SalesResponse>('/marketplace/my/sales');
}

export function getMyEarnings(): Promise<EarningsResponse> {
  return api.get<EarningsResponse>('/marketplace/my/earnings');
}

export function createProduct(
  payload: ProductPayload,
): Promise<{ product: CreatedEntity }> {
  return api.post<{ product: CreatedEntity }>('/shop/vendor/products', payload);
}

export function createCategory(
  payload: CategoryPayload,
): Promise<{ category: CreatedEntity }> {
  return api.post<{ category: CreatedEntity }>(
    '/shop/vendor/categories',
    payload,
  );
}

export function createPlan(
  payload: PlanPayload,
): Promise<{ plan: CreatedEntity }> {
  return api.post<{ plan: CreatedEntity }>(
    '/subscription/vendor/plans',
    payload,
  );
}

export function createSoftware(
  payload: SoftwarePayload,
): Promise<{ package: CreatedEntity }> {
  return api.post<{ package: CreatedEntity }>('/ghrm/vendor/packages', payload);
}

export function createBookingResource(
  payload: BookingResourcePayload,
): Promise<{ resource: CreatedEntity }> {
  return api.post<{ resource: CreatedEntity }>(
    '/booking/vendor/resources',
    payload,
  );
}

// ── Listing READ / UPDATE / DELETE (per vertical) ──────────────────────
//
// Each vertical exposes its own vendor collection; the store aggregates the
// four into a single Listing[] for the "My listings" table. A vertical whose
// vendor-mode is off (403) or plugin is absent (404) is simply skipped by the
// caller, so a partial marketplace still works.

type RawEntity = Record<string, unknown>;

export function listProducts(): Promise<{ products: RawEntity[] }> {
  return api.get<{ products: RawEntity[] }>('/shop/vendor/products');
}
export function getProduct(id: string): Promise<{ product: RawEntity }> {
  return api.get<{ product: RawEntity }>(`/shop/vendor/products/${id}`);
}
export function updateProduct(
  id: string,
  payload: Partial<ProductPayload>,
): Promise<{ product: RawEntity }> {
  return api.put<{ product: RawEntity }>(`/shop/vendor/products/${id}`, payload);
}
export function deleteProduct(id: string): Promise<unknown> {
  return api.delete(`/shop/vendor/products/${id}`);
}

export function listPlans(): Promise<{ plans: RawEntity[] }> {
  return api.get<{ plans: RawEntity[] }>('/subscription/vendor/plans');
}
export function getPlan(id: string): Promise<{ plan: RawEntity }> {
  return api.get<{ plan: RawEntity }>(`/subscription/vendor/plans/${id}`);
}
export function updatePlan(
  id: string,
  payload: Partial<PlanPayload> & { is_active?: boolean },
): Promise<{ plan: RawEntity }> {
  return api.put<{ plan: RawEntity }>(
    `/subscription/vendor/plans/${id}`,
    payload,
  );
}
export function deletePlan(id: string): Promise<unknown> {
  return api.delete(`/subscription/vendor/plans/${id}`);
}

export function listPackages(): Promise<{ packages: RawEntity[] }> {
  return api.get<{ packages: RawEntity[] }>('/ghrm/vendor/packages');
}
export function getPackage(id: string): Promise<{ package: RawEntity }> {
  return api.get<{ package: RawEntity }>(`/ghrm/vendor/packages/${id}`);
}
export function updatePackage(
  id: string,
  payload: Partial<SoftwarePayload> & { is_active?: boolean },
): Promise<{ package: RawEntity }> {
  return api.put<{ package: RawEntity }>(`/ghrm/vendor/packages/${id}`, payload);
}
export function deletePackage(id: string): Promise<unknown> {
  return api.delete(`/ghrm/vendor/packages/${id}`);
}

export function listResources(): Promise<{ resources: RawEntity[] }> {
  return api.get<{ resources: RawEntity[] }>('/booking/vendor/resources');
}
export function getResource(id: string): Promise<{ resource: RawEntity }> {
  return api.get<{ resource: RawEntity }>(`/booking/vendor/resources/${id}`);
}
export function updateResource(
  id: string,
  payload: Partial<BookingResourcePayload> & { is_active?: boolean },
): Promise<{ resource: RawEntity }> {
  return api.put<{ resource: RawEntity }>(
    `/booking/vendor/resources/${id}`,
    payload,
  );
}
export function deleteResource(id: string): Promise<unknown> {
  return api.delete(`/booking/vendor/resources/${id}`);
}

// ── Category READ / UPDATE / DELETE (shop) ─────────────────────────────

export function listCategories(): Promise<{ categories: CategoryRow[] }> {
  return api.get<{ categories: CategoryRow[] }>('/shop/vendor/categories');
}
export function getCategoryById(id: string): Promise<{ category: CategoryRow }> {
  return api.get<{ category: CategoryRow }>(`/shop/vendor/categories/${id}`);
}
export function updateCategory(
  id: string,
  payload: Partial<CategoryPayload> & { description?: string },
): Promise<{ category: CategoryRow }> {
  return api.put<{ category: CategoryRow }>(
    `/shop/vendor/categories/${id}`,
    payload,
  );
}
export function deleteCategory(id: string): Promise<unknown> {
  return api.delete(`/shop/vendor/categories/${id}`);
}

// ── Normalisation ──────────────────────────────────────────────────────

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function str(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

/**
 * Extract a display category from a raw entity. Shop products carry a
 * many-to-many `categories: [{id, name, slug}]` array (no scalar field); other
 * verticals may carry a scalar `category_id`/`category_name`. We surface the
 * first category so the "My listings" table can filter/group by it.
 */
function extractCategory(raw: RawEntity): {
  id?: string;
  name?: string;
} {
  const categories = raw.categories;
  if (Array.isArray(categories) && categories.length > 0) {
    const first = categories[0] as RawEntity;
    return { id: str(first.id), name: str(first.name) };
  }
  return { id: str(raw.category_id), name: str(raw.category_name) };
}

/** Map one raw vertical entity into the common Listing shape. */
export function normaliseListing(type: ListingType, raw: RawEntity): Listing {
  const category = extractCategory(raw);
  return {
    type,
    id: String(raw.id ?? ''),
    name: String(raw.name ?? raw.title ?? ''),
    slug: str(raw.slug),
    price: num(raw.price),
    // Most verticals default to active; treat a missing flag as active.
    is_active: raw.is_active !== false,
    category_id: category.id,
    category_name: category.name,
    raw,
  };
}
