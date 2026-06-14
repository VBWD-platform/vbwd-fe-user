<template>
  <div class="withdraw-detail">
    <router-link
      to="/withdraw"
      class="withdraw-detail__back"
      data-testid="withdraw-detail-back"
    >
      {{ t('withdraw.back') }}
    </router-link>
    <h1>{{ t('withdraw.requestDetail') }}</h1>

    <p
      v-if="notFound"
      data-testid="withdraw-detail-not-found"
    >
      {{ t('withdraw.notFound') }}
    </p>

    <dl
      v-else-if="request"
      class="withdraw-detail__fields"
    >
      <dt>{{ t('withdraw.detail.id') }}</dt>
      <dd data-testid="withdraw-detail-id">
        {{ request.id }}
      </dd>

      <dt>{{ t('withdraw.detail.status') }}</dt>
      <dd data-testid="withdraw-detail-status">
        <span :class="`withdraw-status withdraw-status--${request.status}`">
          {{ t(`withdraw.status.${request.status}`) }}
        </span>
      </dd>

      <dt>{{ t('withdraw.detail.provider') }}</dt>
      <dd data-testid="withdraw-detail-provider">
        {{ request.provider }}
      </dd>

      <dt>{{ t('withdraw.detail.amount') }}</dt>
      <dd data-testid="withdraw-detail-amount">
        {{ request.amount }}
      </dd>

      <dt>{{ t('withdraw.detail.payout') }}</dt>
      <dd data-testid="withdraw-detail-payout">
        {{ request.payout_amount }} {{ request.currency }}
      </dd>

      <dt>{{ t('withdraw.detail.balanceSource') }}</dt>
      <dd data-testid="withdraw-detail-balance-source">
        {{ request.balance_source }}
      </dd>

      <dt>{{ t('withdraw.detail.destination') }}</dt>
      <dd data-testid="withdraw-detail-destination">
        <span
          v-for="(fieldValue, fieldName) in request.destination"
          :key="fieldName"
          class="withdraw-detail__destination-field"
        >
          {{ fieldName }}: {{ fieldValue }}
        </span>
      </dd>

      <template v-if="request.provider_payout_id">
        <dt>{{ t('withdraw.detail.payoutId') }}</dt>
        <dd data-testid="withdraw-detail-payout-id">
          {{ request.provider_payout_id }}
        </dd>
      </template>

      <template v-if="request.error">
        <dt>{{ t('withdraw.detail.error') }}</dt>
        <dd
          class="withdraw-detail__error"
          data-testid="withdraw-detail-error"
        >
          {{ request.error }}
        </dd>
      </template>

      <dt>{{ t('withdraw.detail.created') }}</dt>
      <dd data-testid="withdraw-detail-created">
        {{ request.created_at }}
      </dd>

      <dt>{{ t('withdraw.detail.updated') }}</dt>
      <dd data-testid="withdraw-detail-updated">
        {{ request.updated_at }}
      </dd>
    </dl>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { getRequest } from '../api';
import type { WithdrawRequestRow } from '../api';

const props = defineProps<{ id: string }>();

const { t } = useI18n();
const request = ref<WithdrawRequestRow | null>(null);
const notFound = ref(false);

onMounted(async () => {
  try {
    request.value = await getRequest(props.id);
  } catch {
    // Owner-only endpoint: any failure (404/403) renders as not found.
    notFound.value = true;
  }
});
</script>
