# Plugin: checkout (fe-user)

## Purpose

Public checkout page for anonymous and authenticated users. Renders the checkout flow without the main site layout (`noLayout: true`). Provides a `checkoutContextRegistry` so other plugins (e.g. `ghrm`) can inject custom context components into the checkout UI without modifying checkout code.

## Installation

The plugin self-registers in `plugins/plugins.json`. It is loaded by `vue/src/main.ts` via `pluginLoader`.

## Routes Added

| Path | Component | Auth required | Meta |
|------|-----------|---------------|------|
| `/checkout` | `PublicCheckoutView.vue` | No | `noLayout: true` |

## Stores

No Pinia store.

## i18n Keys

Translations live in `plugins/checkout/locales/`.
Available locales: `en`, `de`, `es`, `fr`, `ja`, `ru`, `th`, `zh`

## Config

`plugins/checkout/config.json` — user-facing enabled/disabled flag.

## Architecture

```
plugins/checkout/
├── index.ts                   # Plugin install: addRoute /checkout
├── PublicCheckoutView.vue     # Checkout form (billing + payment method selection)
└── checkoutContextRegistry.ts # Registry for per-plugin checkout context components
```

## Extending

Other plugins inject custom UI into the checkout page via `checkoutContextRegistry`:

```typescript
import { checkoutContextRegistry } from '../checkout/checkoutContextRegistry'
import MyContextComponent from './MyContextComponent.vue'

checkoutContextRegistry.register('my-plugin', MyContextComponent)
```

`PublicCheckoutView.vue` renders all registered context components inside the checkout card.
