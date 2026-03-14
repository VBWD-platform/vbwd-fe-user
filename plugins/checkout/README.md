# checkout (fe-user plugin)

Generic checkout flow rendered at `/checkout`. Payment plugins (stripe, paypal, yookassa) add their own payment views; this plugin provides the shared checkout shell.

## Routes

| Path | Component |
|------|-----------|
| `/checkout` | `PublicCheckoutView.vue` |

## Backend counterpart

`/api/v1/invoices/` (checkout session creation)
