<template>
  <div
    v-if="price.taxes.length > 0"
    class="order-tax-summary"
  >
    <div
      class="order-tax-summary__row order-tax-summary__row--net"
      data-testid="order-tax-net"
    >
      <span class="order-tax-summary__label">{{ t('price.totalNet') }}</span>
      <span class="order-tax-summary__value">{{ formatAmount(price.netto) }}</span>
    </div>

    <div
      class="order-tax-summary__row order-tax-summary__row--tax"
      data-testid="order-tax-total"
    >
      <span class="order-tax-summary__label">{{ totalTaxLabel }}</span>
      <span class="order-tax-summary__value">{{ formatAmount(totalTaxAmount) }}</span>
    </div>

    <div
      class="order-tax-summary__row order-tax-summary__row--gross"
      data-testid="order-tax-gross"
    >
      <span class="order-tax-summary__label">{{ t('price.totalGross') }}</span>
      <span class="order-tax-summary__value">{{ formatAmount(price.brutto) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Order-level tax disclosure shown immediately before the checkout Total.
 *
 * Consumes one already-aggregated order Price VO (see ``aggregatePrice``) and
 * renders: total netto, total taxes, total brutto. The homogeneous case (a
 * single distinct tax group) shows the rate in the tax label; the heterogeneous
 * case shows a generic label and the SUMMED tax. It performs NO tax arithmetic
 * beyond summing the already-computed per-group amounts, and formats every
 * amount through fe-core ``formatMoney`` (the single rounding boundary).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatMoney } from 'vbwd-view-component';
import type { PriceVO } from '@/utils/priceDisplay';
import { useDisplayPrice } from '@/composables/useDisplayPrice';

const props = defineProps<{
  /** The aggregated order Price VO (net + per-group taxes + gross). */
  price: PriceVO;
  /**
   * Opt in to the storefront display-currency switch (S99.4). Each VO component
   * (net, every tax amount, gross) is scaled by the SAME cross-rate and shown
   * in the display currency. Invoice surfaces leave this off (D5).
   */
  convertToDisplay?: boolean;
}>();

const { t } = useI18n();
const displayPrice = useDisplayPrice();

function formatAmount(amount: number): string {
  // Storefront surfaces opt in to the display-currency switch (S99.4); every
  // other usage formats in the VO's own currency (else the operating currency,
  // formatMoney's default) — never a hardcoded literal (S99).
  return props.convertToDisplay
    ? displayPrice.formatInDisplay(amount, props.price.currency)
    : formatMoney(amount, { currency: props.price.currency });
}

// Display sum of the already-computed per-group tax amounts — never recomputed.
const totalTaxAmount = computed(() =>
  props.price.taxes.reduce((sum, tax) => sum + tax.amount, 0),
);

// Homogeneous (one distinct tax group) shows the rate; heterogeneous is generic.
const totalTaxLabel = computed(() =>
  props.price.taxes.length === 1
    ? t('price.totalTaxWithRate', { rate: props.price.taxes[0].rate })
    : t('price.totalTax'),
);
</script>

<style scoped>
.order-tax-summary {
  display: flex;
  flex-direction: column;
  gap: var(--vbwd-spacing-xs, 0.375rem);
}

.order-tax-summary__row {
  display: flex;
  justify-content: space-between;
  gap: var(--vbwd-spacing-md, 1rem);
}

.order-tax-summary__row--tax {
  color: var(--vbwd-text-muted, #6b7280);
  font-size: 0.9em;
}

.order-tax-summary__row--gross {
  font-weight: 600;
  border-top: 1px solid var(--vbwd-border, #e5e7eb);
  padding-top: var(--vbwd-spacing-xs, 0.375rem);
}
</style>
