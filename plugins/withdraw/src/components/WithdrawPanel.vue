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
            :to="`/withdraw/${request.id}`"
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
