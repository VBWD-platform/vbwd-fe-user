# paypal-payment (fe-user plugin)

PayPal checkout flow for the user-facing app.

## Routes

| Path | Component |
|------|-----------|
| `/payment/paypal` | `PayPalPaymentView.vue` |
| `/payment/paypal/success` | `PayPalSuccessView.vue` |
| `/payment/paypal/cancel` | `PayPalCancelView.vue` |

## Backend counterpart

`vbwd-backend/plugins/paypal/` — `/api/v1/paypal/*`
