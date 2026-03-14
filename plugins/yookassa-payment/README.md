# yookassa-payment (fe-user plugin)

YooKassa checkout flow for the user-facing app (Russian payment provider).

## Routes

| Path | Component |
|------|-----------|
| `/payment/yookassa` | `YooKassaPaymentView.vue` |
| `/payment/yookassa/success` | `YooKassaSuccessView.vue` |
| `/payment/yookassa/cancel` | `YooKassaCancelView.vue` |

## Backend counterpart

`vbwd-backend/plugins/yookassa/` — `/api/v1/yookassa/*`
