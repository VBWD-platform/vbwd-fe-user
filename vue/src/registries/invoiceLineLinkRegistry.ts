/**
 * Invoice Line-Item Link Registry
 *
 * Makes the fe-user invoice detail (`vue/src/views/InvoiceDetail.vue`)
 * plugin-agnostic for per-line clickability. Core resolves a small set of
 * built-in line types (SUBSCRIPTION / TOKEN_BUNDLE / ADD_ON / booking) itself;
 * for any OTHER line it falls through to this registry, so a plugin can make its
 * own line (e.g. a purchased dataset CUSTOM line) clickable WITHOUT a core edit.
 *
 * A resolver is a pure function that maps a line item to a route path, or
 * returns `null` to decline. `resolve()` returns the FIRST non-null result, so
 * resolvers are consulted in registration order. Core never names a plugin
 * domain — it just asks the registry.
 *
 * Usage (from a plugin's install()/activate() hook):
 *   import { invoiceLineLinkRegistry } from '@/registries/invoiceLineLinkRegistry';
 *   invoiceLineLinkRegistry.register(datasetInvoiceLink);
 */

/** The minimal shape of an invoice line a resolver may read. */
export interface InvoiceLineItemLike {
  type?: string;
  item_id?: string;
  catalog_item_id?: string;
  extra_data?: Record<string, unknown>;
}

/** Maps a line item to a route path, or `null` to decline. */
export type InvoiceLineLinkResolver = (item: InvoiceLineItemLike) => string | null;

class InvoiceLineLinkRegistry {
  private resolvers: InvoiceLineLinkResolver[] = [];

  /** Register a resolver. Call from a plugin's install()/activate() hook. */
  register(resolver: InvoiceLineLinkResolver): void {
    this.resolvers.push(resolver);
  }

  /** First non-null resolver result for the given line, or `null`. */
  resolve(item: InvoiceLineItemLike): string | null {
    for (const resolver of this.resolvers) {
      const link = resolver(item);
      if (link) return link;
    }
    return null;
  }

  /** Test helper — wipes all resolvers between specs. */
  clear(): void {
    this.resolvers.length = 0;
  }
}

export const invoiceLineLinkRegistry = new InvoiceLineLinkRegistry();
