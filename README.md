# VBWD Frontend — User App

Vue 3 user-facing application for the VBWD SaaS platform. Handles authentication, subscription management, billing, token purchases, add-ons, and invoicing. Built on the shared `vbwd-fe-core` component library (included as a git submodule).

## Features

### Authentication
- Login / register with email + password
- JWT token management with automatic refresh
- Session expiry detection with modal prompt
- Persistent auth state via localStorage

### Dashboard
- Overview of active subscriptions (primary `is_single` plan first, multi-subscriptions below)
- Token balance widget
- Recent invoices
- Subscription history
- Add-on summary
- Token activity feed
- Quick actions

### Plans & Checkout
- Browse available tarif plans with pricing and billing periods
- Filter plans by category
- Multi-step checkout: email/auth → billing address → payment method → confirm
- Inline sign-up or login during checkout (new and existing users)
- Terms and conditions acceptance
- Tax calculation by country
- Zero-price plans activated instantly (no payment step)

### Subscription Management
- Active subscriptions table with next payment date and per-row cancel
- Upgrade to higher-tier plan (immediate)
- Downgrade scheduled at next renewal
- Proration calculation before upgrade
- Pause / resume subscription
- Cancel with access-until-expiry

### Token Economy
- Token balance display
- Browse and purchase token bundles
- Full transaction history with type labels

### Add-ons
- Browse subscription-scoped and global add-ons
- Purchase via cart / checkout
- Add-on detail view with status, dates, and cancel

### Invoices
- Full invoice list with search and status filter
- Invoice detail view with line items
- Pay pending invoices inline (Stripe, PayPal, YooKassa, bank transfer)
- PDF download

### Profile
- Personal info, company, VAT / tax number
- Billing address
- Password change

### Internationalisation
- English locale (`vue-i18n`)
- All UI strings externalised to `vue/src/i18n/locales/en.json`

### Plugin System
- Client-side plugin architecture (`vbwd-view-component` `PluginRegistry`)
- Plugins can add routes, Pinia stores, and translations at runtime
- Plugins loaded from `plugins/` directory

---

## Tech Stack

| | |
|-|-|
| Framework | Vue 3 (Composition API) |
| State | Pinia |
| Router | Vue Router 4 |
| i18n | vue-i18n |
| HTTP | `ApiClient` from `vbwd-view-component` |
| Realtime | socket.io-client |
| Build | Vite |
| Tests | Vitest (unit), Playwright (E2E) |

---

## Prerequisites

- Node.js 20+
- Docker + Docker Compose (for containerised dev)
- `vbwd-backend` running (see backend README)

---

## Install & Run

### Via monorepo install script (recommended)

Clones, builds, and wires all repos including this one:

```bash
# From vbwd-sdk-2 root:
./recipes/dev-install-ce.sh

# With custom domain and SSL:
./recipes/dev-install-ce.sh --domain myapp.com --ssl
```

### Standalone (manual)

```bash
git clone --recurse-submodules https://github.com/VBWD-platform/vbwd-fe-user.git
cd vbwd-fe-user

# Build the shared component library (submodule) first
cd vbwd-fe-core && npm install && npm run build && rm -rf node_modules
cd ..

# Install main app
npm install

# Configure environment
cp .env.example .env   # or create manually (see below)

# Start dev server
npm run dev
```

App available at `http://localhost:5173` (via Vite) or `http://localhost:8080` (via Docker nginx proxy).

---

## Docker

```bash
# Start with Docker Compose (nginx + Vite dev server)
make up
# or
docker compose --profile dev up -d --build
```

The nginx container (port 8080) proxies:
- `/api/` → backend at `http://host.docker.internal:5000`
- `/_plugins` → plugin API server
- everything else → Vite dev server

```bash
# Stop
docker compose down

# View logs
docker compose logs -f
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Base API path — relative, works for any domain via nginx proxy
VITE_API_URL=/api/v1

# Vite dev-server proxy target (only used by `npm run dev`)
VITE_BACKEND_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
```

For a remote domain:

```env
VITE_API_URL=/api/v1
VITE_BACKEND_URL=https://myapp.com:5000
VITE_WS_URL=wss://myapp.com:5000
```

---

## Production Build

The production Docker image is a two-stage build (builder → nginx):

```bash
# Build production image
docker build -t vbwd_fe_user .

# Run (set API_UPSTREAM to your backend service name/address)
docker run -p 8080:80 -e API_UPSTREAM=api:5000 vbwd_fe_user
```

`API_UPSTREAM` is injected into the nginx config at container startup via `envsubst`. Default: `api:5000`.

---

## Testing

```bash
npm run test          # unit tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)
npm run test:e2e:ui   # E2E with interactive Playwright UI
npm run lint          # ESLint
```

Test credentials (against seeded backend):
- User: `test@example.com` / `TestPass123@`

---

## Project Structure

```
vue/
└── src/
    ├── api/           # ApiClient singleton + auth helpers
    ├── components/
    │   └── checkout/  # EmailBlock, BillingAddressBlock, TermsCheckbox, PaymentMethods
    ├── composables/   # useEmailCheck, usePaymentMethods
    ├── i18n/
    │   └── locales/   # en.json
    ├── router/        # Vue Router config
    ├── stores/        # Pinia stores
    │   ├── auth.ts
    │   ├── subscription.ts
    │   ├── plans.ts
    │   ├── checkout.ts
    │   ├── invoices.ts
    │   └── profile.ts
    └── views/         # Page components
        ├── Dashboard.vue
        ├── Plans.vue
        ├── Checkout.vue
        ├── Subscription.vue
        ├── Invoices.vue
        ├── InvoiceDetail.vue
        ├── InvoicePay.vue
        ├── Tokens.vue
        ├── AddOns.vue
        └── Profile.vue
plugins/               # Client-side plugin directory
vbwd-fe-core/          # git submodule — shared component library
```

---

## Plugin Directory

| Plugin | Repository | Description |
|--------|-----------|-------------|
| chat | [vbwd-fe-user-plugin-chat](https://github.com/VBWD-platform/vbwd-fe-user-plugin-chat) | Chat UI — view, input, message, session |
| checkout | [vbwd-fe-user-plugin-checkout](https://github.com/VBWD-platform/vbwd-fe-user-plugin-checkout) | Checkout flow with billing address and payment method routing |
| cms | [vbwd-fe-user-plugin-cms](https://github.com/VBWD-platform/vbwd-fe-user-plugin-cms) | CMS page rendering with widget slots |
| ghrm | [vbwd-fe-user-plugin-ghrm](https://github.com/VBWD-platform/vbwd-fe-user-plugin-ghrm) | Package catalogue, detail page, GitHub OAuth |
| landing1 | [vbwd-fe-user-plugin-landing1](https://github.com/VBWD-platform/vbwd-fe-user-plugin-landing1) | Marketing landing page + embed widget |
| paypal-payment | [vbwd-fe-user-plugin-paypal-payment](https://github.com/VBWD-platform/vbwd-fe-user-plugin-paypal-payment) | PayPal redirect/success/cancel views |
| stripe-payment | [vbwd-fe-user-plugin-stripe-payment](https://github.com/VBWD-platform/vbwd-fe-user-plugin-stripe-payment) | Stripe redirect/success/cancel views |
| taro | [vbwd-fe-user-plugin-taro](https://github.com/VBWD-platform/vbwd-fe-user-plugin-taro) | Tarot card reading UI |
| theme-switcher | [vbwd-fe-user-plugin-theme-switcher](https://github.com/VBWD-platform/vbwd-fe-user-plugin-theme-switcher) | Light/dark/system theme selector |
| yookassa-payment | [vbwd-fe-user-plugin-yookassa-payment](https://github.com/VBWD-platform/vbwd-fe-user-plugin-yookassa-payment) | YooKassa redirect/success/cancel views |

---

## License

CC0 1.0 Universal (Public Domain)
