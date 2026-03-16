# Plugin: paypal-payment (fe-user)

## Purpose

PayPal payment processing UI. Provides three views for the PayPal checkout flow: payment initiation (redirects to PayPal), success landing page, and cancellation landing page. Requires the backend `paypal` plugin.

## Installation

The plugin self-registers in `plugins/plugins.json`. Loaded by `vue/src/main.ts` via `pluginLoader`.

Requires the backend `paypal` plugin to be enabled.

## Routes Added

| Path | Component | Auth required |
|------|-----------|---------------|
| `/pay/paypal` | `PayPalPaymentView.vue` | Yes |
| `/pay/paypal/success` | `PayPalSuccessView.vue` | Yes |
| `/pay/paypal/cancel` | `PayPalCancelView.vue` | Yes |

## Stores

No Pinia store.

## i18n Keys

Translations live in `plugins/paypal-payment/locales/`.
Available locales: `en`, `de`, `es`, `fr`, `ja`, `ru`, `th`, `zh`

## Config

`plugins/paypal-payment/config.json` — user-facing enabled/disabled flag.

## Architecture

```
plugins/paypal-payment/
├── index.ts
├── PayPalPaymentView.vue   # Creates session + redirects to PayPal
├── PayPalSuccessView.vue   # Polls session status, activates subscription
├── PayPalCancelView.vue    # Handles user cancellation
└── locales/                # 8 locale files
```

## Extending

The payment flow follows: `checkout → /pay/paypal → PayPal → /pay/paypal/success|cancel`. The success view polls `GET /api/v1/plugins/paypal/session-status/<order_id>` to confirm capture before showing confirmation.
