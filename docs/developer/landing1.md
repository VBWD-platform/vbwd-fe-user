# Plugin: landing1 (fe-user)

## Purpose

Public marketing landing page with tariff plan selection. Renders a full-page promotional view with plan cards that link to checkout. Also provides an embeddable widget (`embed-widget.js`) for embedding the landing page or plan selector into external websites.

## Installation

The plugin self-registers in `plugins/plugins.json`. Loaded by `vue/src/main.ts` via `pluginLoader`.

## Routes Added

| Path | Component | Auth required | Meta |
|------|-----------|---------------|------|
| `/landing1` | `Landing1View.vue` | No | `cmsLayout: true` |
| `/embed/landing1` | `EmbedLanding1View.vue` | No | `embed: true` |

## Stores

No Pinia store.

## i18n Keys

Translations live in `plugins/landing1/locales/`.
Available locales: `en`, `de`, `es`, `fr`, `ja`, `ru`, `th`, `zh`

## Config

`plugins/landing1/config.json` — user-facing enabled/disabled flag.

## Architecture

```
plugins/landing1/
├── index.ts              # Plugin install: addRoute /landing1, /embed/landing1
├── Landing1View.vue      # Full marketing landing page
├── EmbedLanding1View.vue # Stripped-down embed version
├── embed-widget.js       # Embeddable script for external sites
└── locales/              # 8 locale files
```

## Card presentation config

`Landing1View.vue` renders the tariff-plan cards and accepts optional presentation
props (all backward-compatible — omit them for the classic look):

| Prop | Type | Effect |
|------|------|--------|
| `heading` / `subtitle` | string | Override the section title / subtitle (blank → i18n default) |
| `ctaLabel` | string | Button label (blank → `landing1.choosePlan`) |
| `theme` | string | Card theme class `landing1--<theme>`: `default`, `light`, `dark`, `teal`, `indigo`, `emerald` |
| `imageUrl` | string | Optional image shown at the top of every card |
| `features` | string[] | Checkmark feature list shown on every card (blank entries dropped) |
| `highlightSlug` | string | Plan slug to emphasize (badge + accent border + scale + gradient button) |
| `badge` | string | Emphasis badge text (blank → `landing1.popular`) |

### Where the props come from

- **CMS page (`NativePricingPlans` widget)** — `plugins/cms/src/components/NativePricingPlans.vue`
  maps the widget `config` keys → props: `heading`, `subtitle`, `cta_label`, `theme`,
  `image_url`, `features`, `highlight_slug`, `highlight_badge`. Edited in fe-admin via
  `cms-admin/src/widgets/NativePricingPlansEditorTab.vue` (the **Card image** field uses the
  CMS Image Library picker, not a free-text URL). Plus a raw `css` override injected into
  `<head>` while the widget is on the page.
- **Embed (`/embed/widget.js`)** — data attributes are forwarded as query params to
  `/embed/landing1`: `data-theme`, `data-image`, `data-features` (comma-separated),
  `data-highlight`, `data-badge`, `data-heading`, `data-subtitle`, `data-cta`.
  `EmbedLanding1View.vue` reads them from the route query and passes them down.

## Styling

The card CSS lives in `Landing1View.vue` `<style>` (non-scoped): `.landing1`, `.plans-grid`,
`.plan-card`, `.plan-card--featured`, `.plan-card__badge`, `.plan-card__image`,
`.plan-features`, `.plan-price__amount`, `.choose-plan-btn`. Colours come from `--l1-*`
tokens defined per `.landing1--<theme>`, which fall back to the shared `--vbwd-*` tokens
(active CMS Style / `vue/src/assets/vbwd-ui.css`) when a theme leaves them unset. Override
order (low→high): component CSS → theme class → `--vbwd-*` Style tokens → widget `config.css`
→ page `source_css`.

## Extending

To create additional landing page variants, add new views and routes following the same pattern. The `embed-widget.js` renders `EmbedLanding1View.vue` inside a shadow DOM to isolate styles from the host page.
