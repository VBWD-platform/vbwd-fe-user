# Plugin: yookassa-payment (fe-user)

## Purpose

YooKassa payment processing UI for Russian and CIS markets. Provides three views for the YooKassa checkout flow: payment initiation (redirects to YooKassa), success landing page, and cancellation landing page. Requires the backend `yookassa` plugin.

## Installation

The plugin self-registers in `plugins/plugins.json`. Loaded by `vue/src/main.ts` via `pluginLoader`.

Requires the backend `yookassa` plugin to be enabled.

## Routes Added

| Path | Component | Auth required |
|------|-----------|---------------|
| `/pay/yookassa` | `YooKassaPaymentView.vue` | Yes |
| `/pay/yookassa/success` | `YooKassaSuccessView.vue` | Yes |
| `/pay/yookassa/cancel` | `YooKassaCancelView.vue` | Yes |

## Stores

No Pinia store.

## i18n Keys

Translations live in `plugins/yookassa-payment/locales/`.
Available locales: `en`, `de`, `es`, `fr`, `ja`, `ru`, `th`, `zh`

## Config

`plugins/yookassa-payment/config.json` — user-facing enabled/disabled flag.

## Architecture

```
plugins/yookassa-payment/
├── index.ts
├── YooKassaPaymentView.vue   # Creates payment + redirects to YooKassa
├── YooKassaSuccessView.vue   # Confirms payment activation
├── YooKassaCancelView.vue    # Handles user cancellation
└── locales/                  # 8 locale files
```

## Extending

The payment flow follows: `checkout → /pay/yookassa → YooKassa → /pay/yookassa/success|cancel`. YooKassa delivers a server-side webhook notification to the backend (`/api/v1/plugins/yookassa/webhook`) when payment is confirmed — the success view may poll or simply redirect to the dashboard.
