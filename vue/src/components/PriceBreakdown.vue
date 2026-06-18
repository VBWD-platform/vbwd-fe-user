<template>
  <div class="price-breakdown">
    <div
      class="price-breakdown__row price-breakdown__row--net"
      data-testid="price-breakdown-net"
    >
      <span class="price-breakdown__label">{{ t('price.net') }}</span>
      <span class="price-breakdown__value">{{ formattedNet }}</span>
    </div>

    <div
      v-for="(tax, index) in price.taxes"
      :key="`${tax.code}-${index}`"
      class="price-breakdown__row price-breakdown__row--tax"
      data-testid="price-breakdown-tax-line"
    >
      <span class="price-breakdown__label">{{ taxLabel(tax) }}</span>
      <span class="price-breakdown__value">{{ formatAmount(tax.amount) }}</span>
    </div>

    <div
      class="price-breakdown__row price-breakdown__row--gross"
      data-testid="price-breakdown-gross"
    >
      <span class="price-breakdown__label">{{ t('price.gross') }}</span>
      <span class="price-breakdown__value">{{ formattedGross }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Shared detailed tax-disclosure renderer (S85.4).
 *
 * The expanded counterpart to the compact ``<PriceDisplay>``: it renders the
 * per-line net, one line per tax rate straight from ``Price.taxes`` (e.g.
 * "VAT Germany 19% — €X"), and the gross total. It consumes the computed
 * Price VO (live checkout/catalog) or a persisted invoice line's tax breakdown
 * via the same prop. It performs NO tax arithmetic and formats every amount
 * through fe-core ``formatMoney`` (the single rounding boundary).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatMoney } from 'vbwd-view-component';
import type { PriceVO, PriceTaxVO } from '@/utils/priceDisplay';
import { useDisplayPrice } from '@/composables/useDisplayPrice';

const props = defineProps<{
  /** The computed Price VO (or a persisted invoice line's breakdown). */
  price: PriceVO;
  /**
   * Opt in to the storefront display-currency switch (S99.4). Off by default so
   * invoice surfaces (a legal document) always render their stored currency
   * (D5); storefront catalog/checkout usages set it true to convert.
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

const formattedNet = computed(() => formatAmount(props.price.netto));
const formattedGross = computed(() => formatAmount(props.price.brutto));

function taxLabel(tax: PriceTaxVO): string {
  return t('price.taxLine', { name: tax.name ?? tax.code, rate: tax.rate });
}
</script>

<style scoped>
.price-breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--vbwd-spacing-xs, 0.375rem);
}

.price-breakdown__row {
  display: flex;
  justify-content: space-between;
  gap: var(--vbwd-spacing-md, 1rem);
}

.price-breakdown__row--tax {
  color: var(--vbwd-text-muted, #6b7280);
  font-size: 0.9em;
}

.price-breakdown__row--gross {
  font-weight: 600;
  border-top: 1px solid var(--vbwd-border, #e5e7eb);
  padding-top: var(--vbwd-spacing-xs, 0.375rem);
}
</style>
