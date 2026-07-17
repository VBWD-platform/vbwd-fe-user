/**
 * CMS maintenance detector.
 *
 * The public fe-user site is driven by the CMS backend. When the backend is
 * license-blocked it answers every CMS API with `HTTP 402 {"error":"License
 * required","feature":"cms"}`. This detector observes every request routed
 * through the shared api client (the single seam every CMS caller already uses
 * — appConfig's `/cms/config`, the cms plugin's `/cms/posts`, `/cms/layouts`,
 * …) and:
 *   - flips the maintenance store ON when a CMS endpoint answers 402;
 *   - clears it again when a CMS endpoint answers successfully (recovery).
 *
 * It keys off "a 402 from a CMS endpoint" (URL under `/cms`), so it needs no
 * access to the response body — which keeps the whole feature inside the
 * host app: the shared api client lives in `vbwd-fe-core` and is left
 * untouched. Non-CMS requests and non-402 errors never touch the state.
 */
import { ApiError } from 'vbwd-view-component';
import type { ApiClient } from 'vbwd-view-component';
import { useMaintenanceStore } from '@/stores/maintenance';

const CMS_ENDPOINT_PREFIX = '/cms';
const LICENSE_REQUIRED_STATUS = 402;

/** The api-client request methods this detector wraps. */
const OBSERVED_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

type RequestFn = (url: string, ...rest: unknown[]) => Promise<unknown>;

function isCmsEndpoint(url: string): boolean {
  return url.startsWith(CMS_ENDPOINT_PREFIX);
}

function isLicenseBlocked(error: unknown): boolean {
  return error instanceof ApiError && error.status === LICENSE_REQUIRED_STATUS;
}

/**
 * Wrap the shared api client's request methods so every CMS response updates
 * the maintenance store. Call once, at api-client construction.
 */
export function installCmsMaintenanceDetector(client: ApiClient): void {
  // The request methods are reassigned to their observed wrappers; index the
  // client structurally to swap them without fighting each method's generics.
  const requestMethods = client as unknown as Record<string, RequestFn>;

  for (const method of OBSERVED_METHODS) {
    // Tolerate a partial client (e.g. a stubbed test double): only wrap the
    // request methods that are actually present.
    if (typeof requestMethods[method] !== 'function') continue;
    const originalRequest = requestMethods[method].bind(client) as RequestFn;

    requestMethods[method] = async (url: string, ...rest: unknown[]): Promise<unknown> => {
      try {
        const result = await originalRequest(url, ...rest);
        if (isCmsEndpoint(url)) {
          useMaintenanceStore().clear();
        }
        return result;
      } catch (error) {
        if (isCmsEndpoint(url) && isLicenseBlocked(error)) {
          useMaintenanceStore().activate();
        }
        throw error;
      }
    };
  }
}
