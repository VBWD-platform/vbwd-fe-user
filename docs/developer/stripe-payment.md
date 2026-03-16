# Plugin: stripe-payment (fe-user)

## Purpose

Stripe payment processing UI. Provides three views for the Stripe Checkout flow: payment initiation (redirects to Stripe Checkout), success landing page, and cancellation landing page. Requires the backend `stripe` plugin.

## Installation

The plugin self-registers in `plugins/plugins.json`. Loaded by `vue/src/main.ts` via `pluginLoader`.

Requires the backend `stripe` plugin to be enabled.

## Routes Added

| Path | Component | Auth required |
|------|-----------|---------------|
| `/pay/stripe` | `StripePaymentView.vue` | Yes |
| `/pay/stripe/success` | `StripeSuccessView.vue` | Yes |
| `/pay/stripe/cancel` | `StripeCancelView.vue` | Yes |

## Stores

No Pinia store.

## i18n Keys

Translations live in `plugins/stripe-payment/locales/`.
Available locales: `en`, `de`, `es`, `fr`, `ja`, `ru`, `th`, `zh`

## Config

`plugins/stripe-payment/config.json` — user-facing enabled/disabled flag.

## Architecture

```
plugins/stripe-payment/
├── index.ts
├── StripePaymentView.vue   # Creates Stripe session + redirects
├── StripeSuccessView.vue   # Polls session status, confirms activation
├── StripeCancelView.vue    # Handles user cancellation
└── locales/                # 8 locale files
```

## Extending

The payment flow follows: `checkout → /pay/stripe → Stripe Checkout → /pay/stripe/success|cancel`. The success view polls `GET /api/v1/plugins/stripe/session-status/<session_id>` to confirm payment before showing confirmation.
