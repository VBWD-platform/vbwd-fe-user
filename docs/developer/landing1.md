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

## Extending

To create additional landing page variants, add new views and routes following the same pattern. The `embed-widget.js` renders `EmbedLanding1View.vue` inside a shadow DOM to isolate styles from the host page.
