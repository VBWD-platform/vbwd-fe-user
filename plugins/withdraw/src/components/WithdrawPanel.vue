<template>
  <div class="withdraw-panel">
    <p
      v-if="loadError"
      class="withdraw-panel__error"
      data-testid="withdraw-load-error"
    >
      {{ loadError }}
    </p>
    <section class="withdraw-panel__balance">
      <h3>{{ t('withdraw.balance') }}</h3>
      <p
        class="withdraw-panel__balance-value"
        data-testid="withdraw-balance"
      >
        {{ store.balance ?? '—' }}
      </p>
      <p
        v-if="moneyPreview !== null"
        class="withdraw-panel__money-preview"
        data-testid="withdraw-money-preview"
      >
        {{ t('withdraw.moneyPreview', { amount: moneyPreview }) }}
      </p>
    </section>

    <p
      v-if="store.config && store.providers.length === 0"
      data-testid="withdraw-no-providers"
    >
      {{ t('withdraw.noProviders') }}
    </p>

    <form
      v-else-if="store.config"
      class="withdraw-panel__form"
      @submit.prevent="onSubmit"
    >
      <fieldset class="withdraw-panel__providers">
        <legend>{{ t('withdraw.provider') }}</legend>
        <label
          v-for="provider in store.providers"
          :key="provider.name"
          class="withdraw-panel__provider-option"
        >
          <input
            v-model="selectedProviderName"
            type="radio"
            :value="provider.name"
            :data-testid="`withdraw-provider-${provider.name}`"
          >
          {{ provider.name }}
        </label>
      </fieldset>

      <fieldset
        v-if="selectedProvider"
        class="withdraw-panel__destination"
      >
        <legend>{{ t('withdraw.destination') }}</legend>
        <label
          v-for="field in selectedProvider.destination_schema"
          :key="field.name"
          class="withdraw-panel__destination-field"
        >
          {{ fieldLabel(field) }}
          <input
            v-model="destination[field.name]"
            :type="field.type"
            :data-testid="`withdraw-dest-${field.name}`"
          >
        </label>
      </fieldset>

      <label class="withdraw-panel__amount">
        {{ t('withdraw.amount') }}
        <input
          v-model.number="amount"
          type="number"
          min="0"
          step="1"
          data-testid="withdraw-amount"
        >
      </label>
      <p
        v-if="store.config && store.balance !== null"
        class="withdraw-panel__amount-hint"
      >
        {{ t('withdraw.amountHint', { min: store.config.min_withdraw_tokens, max: store.balance }) }}
      </p>

      <p
        v-if="validationError"
        class="withdraw-panel__error"
        data-testid="withdraw-validation-error"
      >
        {{ validationError }}
      </p>
      <p
        v-if="payoutPreview !== null"
        class="withdraw-panel__payout-preview"
        data-testid="withdraw-payout-preview"
      >
        {{ t('withdraw.payoutPreview', { amount: payoutPreview }) }}
      </p>

      <button
        type="submit"
        :disabled="!canSubmit"
        data-testid="withdraw-submit"
      >
        {{ store.submitting ? t('withdraw.submitting') : t('withdraw.submit') }}
      </button>
      <p
        v-if="store.error"
        class="withdraw-panel__error"
        data-testid="withdraw-submit-error"
      >
        {{ store.error }}
      </p>
      <p
        v-if="submitted"
        class="withdraw-panel__submitted"
        data-testid="withdraw-submitted"
      >
        {{ t('withdraw.submitted') }}
      </p>
    </form>

    <section class="withdraw-panel__history">
      <h3>{{ t('withdraw.history') }}</h3>
      <p
        v-if="store.requests.length === 0"
        data-testid="withdraw-no-requests"
      >
        {{ t('withdraw.noRequests') }}
      </p>
      <ul
        v-else
        class="withdraw-panel__history-list"
        data-testid="withdraw-history"
      >
        <li
          v-for="request in store.requests"
          :key="request.id"
          class="withdraw-panel__history-row"
          data-testid="withdraw-request-row"
        >
          <router-link
            :to="`/dashboard/withdraw/${request.id}`"
            class="withdraw-panel__history-link"
            :data-testid="`withdraw-request-link-${request.id}`"
          >
            <span>
              {{ request.amount }} →
              {{ formatMoney(request.payout_amount, request.currency) }}
            </span>
            <span
              :class="`withdraw-status withdraw-status--${request.status}`"
              :data-testid="`withdraw-status-${request.status}`"
            >
              {{ t(`withdraw.status.${request.status}`) }}
            </span>
          </router-link>
          <p
            v-if="request.error"
            class="withdraw-panel__error"
            data-testid="withdraw-request-error"
          >
            {{ request.error }}
          </p>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWithdrawStore } from '../stores/useWithdrawStore';
import type { DestinationField } from '../api';

const CORE_TOKEN_BALANCE_ENDPOINT = '/api/v1/user/tokens/balance';
const DEFAULT_BALANCE_SOURCE = 'tokens';

const props = withDefaults(
  defineProps<{
    /** Endpoint returning `{balance: number}` — overridable so S80 can plug another source. */
    balanceEndpoint?: string;
    /** Sent as `balance_source` with every withdraw request. */
    balanceSource?: string;
  }>(),
  {
    balanceEndpoint: CORE_TOKEN_BALANCE_ENDPOINT,
    balanceSource: DEFAULT_BALANCE_SOURCE,
  },
);

const { t, te, locale } = useI18n();
const store = useWithdrawStore();

const selectedProviderName = ref<string | null>(null);
const destination = ref<Record<string, string>>({});
const amount = ref<number | ''>('');
const submitted = ref(false);
const loadError = ref<string | null>(null);

const selectedProvider = computed(() =>
  store.providers.find((provider) => provider.name === selectedProviderName.value) ?? null,
);

// Each provider has its own destination shape — start it blank on switch.
watch(selectedProviderName, () => {
  destination.value = {};
});

const amountValue = computed<number | null>(() =>
  typeof amount.value === 'number' && !Number.isNaN(amount.value) ? amount.value : null,
);

const validationError = computed<string | null>(() => {
  if (amountValue.value === null || !store.config) return null;
  if (amountValue.value < store.config.min_withdraw_tokens) {
    return t('withdraw.errors.belowMin', { min: store.config.min_withdraw_tokens });
  }
  if (store.balance !== null && amountValue.value > store.balance) {
    return t('withdraw.errors.aboveBalance');
  }
  return null;
});

const amountIsValid = computed(
  () => amountValue.value !== null && amountValue.value > 0 && validationError.value === null,
);

const destinationIsComplete = computed(() => {
  if (!selectedProvider.value) return false;
  return selectedProvider.value.destination_schema.every(
    (field) => (destination.value[field.name] ?? '').trim() !== '',
  );
});

const canSubmit = computed(
  () => amountIsValid.value && destinationIsComplete.value && !store.submitting,
);

const moneyPreview = computed<string | null>(() => {
  if (store.balance === null || !store.config) return null;
  return formatMoney(store.balance * store.config.token_to_currency_rate);
});

const payoutPreview = computed<string | null>(() => {
  if (!amountIsValid.value || amountValue.value === null || !store.config) return null;
  return formatMoney(amountValue.value * store.config.token_to_currency_rate);
});

function formatMoney(value: number, currency?: string): string {
  const currencyCode = currency ?? store.config?.currency;
  if (!currencyCode) return value.toFixed(2);
  try {
    return new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: currencyCode,
    }).format(value);
  } catch {
    // Unknown currency code — fall back to a plain "1.23 XYZ" rendering.
    return `${value.toFixed(2)} ${currencyCode}`;
  }
}

function fieldLabel(field: DestinationField): string {
  if (field.label_key && te(field.label_key)) return t(field.label_key);
  return field.name;
}

async function onSubmit() {
  if (!canSubmit.value || !selectedProviderName.value || amountValue.value === null) return;
  submitted.value = false;
  const created = await store.submit({
    provider: selectedProviderName.value,
    amount: amountValue.value,
    destination: { ...destination.value },
    balanceSource: props.balanceSource,
  });
  if (created) {
    submitted.value = true;
    amount.value = '';
    destination.value = {};
    // The balance was debited at request time — show the new figure.
    await store.loadBalance(props.balanceEndpoint);
  }
}

onMounted(async () => {
  try {
    await Promise.all([
      store.loadProviders(),
      store.loadBalance(props.balanceEndpoint),
      store.loadRequests(),
    ]);
  } catch (caught) {
    loadError.value = caught instanceof Error ? caught.message : String(caught);
  }
});
</script>

<style scoped>
/*
 * Vendor/admin card language — mirrors the marketplace "My earnings" page
 * (summary tile, settings-style form, status badges) so the withdraw screen
 * feels like the rest of the private area. Self-contained (scoped) so the panel
 * looks consistent wherever it is embedded.
 */
.withdraw-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Balance as a summary tile */
.withdraw-panel__balance {
  background: #f8f9fa;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 16px 20px;
}
.withdraw-panel__balance h3 {
  margin: 0 0 6px;
  font-size: 0.85rem;
  color: #666;
  font-weight: 500;
}
.withdraw-panel__balance-value {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  color: #2c3e50;
}
.withdraw-panel__money-preview {
  margin: 4px 0 0;
  color: #666;
  font-size: 0.9rem;
}

/* Form card */
.withdraw-panel__form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 20px;
}
.withdraw-panel__form fieldset {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px 16px;
  margin: 0;
}
.withdraw-panel__form legend {
  font-size: 0.9rem;
  font-weight: 600;
  color: #2c3e50;
  padding: 0 6px;
}
.withdraw-panel__provider-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 18px;
  cursor: pointer;
}
.withdraw-panel__destination-field {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 0.9rem;
  font-weight: 500;
  color: #666;
}
.withdraw-panel__destination-field:last-child {
  margin-bottom: 0;
}
.withdraw-panel__amount {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  color: #666;
}
.withdraw-panel__form input[type='number'],
.withdraw-panel__form input[type='text'],
.withdraw-panel__form input[type='email'] {
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
  width: 100%;
  max-width: 340px;
  font-family: inherit;
}
.withdraw-panel__form input:focus {
  outline: none;
  border-color: #3498db;
}
.withdraw-panel__amount-hint {
  margin: 0;
  color: #666;
  font-size: 0.85rem;
}
.withdraw-panel__form button[type='submit'] {
  align-self: flex-start;
  padding: 12px 30px;
  background: #28a745;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}
.withdraw-panel__form button[type='submit']:hover:not(:disabled) {
  background: #218838;
}
.withdraw-panel__form button[type='submit']:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* Messages */
.withdraw-panel__error {
  color: #dc2626;
  margin: 0;
}
.withdraw-panel__submitted,
.withdraw-panel__payout-preview {
  color: #16a34a;
  margin: 0;
}

/* History as a bordered list */
.withdraw-panel__history h3 {
  margin: 0 0 12px;
  color: #2c3e50;
  font-size: 1rem;
}
.withdraw-panel__history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
}
.withdraw-panel__history-row {
  border-bottom: 1px solid #eee;
}
.withdraw-panel__history-row:last-child {
  border-bottom: none;
}
.withdraw-panel__history-link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  text-decoration: none;
  color: #2c3e50;
  transition: background-color 0.2s;
}
.withdraw-panel__history-link:hover {
  background: #f8f9fa;
}
.withdraw-status {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  background: #e9ecef;
  color: #495057;
}
.withdraw-status--completed,
.withdraw-status--paid,
.withdraw-status--approved {
  background: #d4edda;
  color: #155724;
}
.withdraw-status--pending,
.withdraw-status--processing {
  background: #fff3cd;
  color: #856404;
}
.withdraw-status--failed,
.withdraw-status--rejected,
.withdraw-status--cancelled {
  background: #f8d7da;
  color: #721c24;
}
</style>
