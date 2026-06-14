<template>
  <span class="price-display">
    <span
      class="price-display__amount"
      data-testid="price-amount"
    >{{ formattedAmount }}</span>
    <span
      v-if="resolved.showNettoTag"
      class="price-display__netto-tag"
      data-testid="price-netto-tag"
    >{{ t('price.nettoTag') }}</span>
  </span>
</template>

<script setup lang="ts">
/**
 * Shared netto/brutto price renderer (S72.4).
 *
 * The single component the entity price surfaces (plan / product / resource
 * cards + detail) reuse, so the net-vs-gross choice and the "netto price" tag
 * live in exactly one place (DRY). All net/gross resolution is delegated to
 * the pure ``resolvePriceDisplay`` util; this component only formats the chosen
 * amount through fe-core ``formatMoney`` and renders the localized tag.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatMoney } from 'vbwd-view-component';
import {
  resolvePriceDisplay,
  type PriceDisplayMode,
  type ViewerAccountType,
} from '@/utils/priceDisplay';

const props = defineProps<{
  /** Effective display mode from the pricing payload (override ?? global). */
  effectiveDisplayMode?: PriceDisplayMode | null;
  /** Global ``prices_display_mode`` core setting. */
  globalMode?: PriceDisplayMode | null;
  /** Net (tax-excluded) amount. */
  netAmount: number | string;
  /** Gross (tax-included) amount. */
  grossAmount: number | string;
  /** ISO-4217 currency code. */
  currency?: string;
  /**
   * Authenticated viewer's ``account_type`` (S74). ``business`` forces the
   * netto side via the D9 overlay; anonymous viewers omit it.
   */
  accountType?: ViewerAccountType | null;
}>();

const { t } = useI18n();

const resolved = computed(() =>
  resolvePriceDisplay({
    effectiveDisplayMode: props.effectiveDisplayMode,
    globalMode: props.globalMode,
    netAmount: Number(props.netAmount),
    grossAmount: Number(props.grossAmount),
    accountType: props.accountType,
  })
);

const formattedAmount = computed(() =>
  formatMoney(resolved.value.amount, { currency: props.currency || 'USD' })
);
</script>

<style scoped>
.price-display {
  display: inline-flex;
  align-items: baseline;
  gap: var(--vbwd-spacing-xs, 0.375rem);
}

.price-display__netto-tag {
  font-size: 0.75em;
  font-weight: 500;
  color: var(--vbwd-text-muted, #6b7280);
  background: var(--vbwd-surface-muted, #f3f4f6);
  padding: 0.1em 0.45em;
  border-radius: var(--vbwd-radius-sm, 0.25rem);
  white-space: nowrap;
}
</style>
