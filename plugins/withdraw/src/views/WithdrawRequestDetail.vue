<template>
  <div class="withdraw-detail">
    <router-link
      to="/dashboard/withdraw"
      class="withdraw-detail__back"
      data-testid="withdraw-detail-back"
    >
      ← {{ t('withdraw.back') }}
    </router-link>
    <h2 class="withdraw-detail__heading">
      {{ t('withdraw.requestDetail') }}
    </h2>

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

<style scoped>
/* Vendor/admin card language — matches the withdraw list + marketplace pages. */
.withdraw-detail {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
}
.withdraw-detail__back {
  display: inline-block;
  margin-bottom: 15px;
  color: #3498db;
  text-decoration: none;
  font-size: 0.9rem;
}
.withdraw-detail__back:hover {
  text-decoration: underline;
}
.withdraw-detail__heading {
  margin: 0 0 20px;
  color: #2c3e50;
}

/* Definition list rendered as a two-column detail table */
.withdraw-detail__fields {
  margin: 0;
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
}
.withdraw-detail__fields dt {
  padding: 12px 15px;
  background: #f8f9fa;
  color: #666;
  font-size: 0.85rem;
  font-weight: 600;
  border-bottom: 1px solid #eee;
}
.withdraw-detail__fields dd {
  margin: 0;
  padding: 12px 15px;
  color: #2c3e50;
  border-bottom: 1px solid #eee;
  word-break: break-word;
}
/* Two columns on wider screens: label | value */
@media (min-width: 640px) {
  .withdraw-detail__fields {
    display: grid;
    grid-template-columns: 220px 1fr;
  }
  .withdraw-detail__fields dt {
    border-right: 1px solid #eee;
  }
}
.withdraw-detail__fields dt:last-of-type,
.withdraw-detail__fields dd:last-of-type {
  border-bottom: none;
}

.withdraw-detail__destination-field {
  display: block;
}
.withdraw-detail__error {
  color: #dc2626;
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
