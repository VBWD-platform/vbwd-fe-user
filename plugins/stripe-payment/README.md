# stripe-payment (fe-user plugin)

Stripe checkout flow for the user-facing app.

## Routes

| Path | Component |
|------|-----------|
| `/payment/stripe` | `StripePaymentView.vue` |
| `/payment/stripe/success` | `StripeSuccessView.vue` |
| `/payment/stripe/cancel` | `StripeCancelView.vue` |

## Backend counterpart

`vbwd-backend/plugins/stripe/` — `/api/v1/stripe/*`
