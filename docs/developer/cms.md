# Plugin: cms (fe-user)

## Purpose

CMS page and category browsing for the public-facing frontend. Fetches pages and layouts from the backend `cms` plugin, renders them using `CmsLayoutRenderer` + `CmsWidgetRenderer`, and applies per-page CSS stylesheets. Registers reusable Vue widgets (`CmsBreadcrumb`, `NativePricingPlans`, `ContactForm`) available to all CMS layouts.

## Installation

The plugin self-registers in `plugins/plugins.json`. Loaded by `vue/src/main.ts` via `pluginLoader`.

Requires the backend `cms` plugin to be enabled.
Dependency: `landing1` plugin (for pricing plan display).

## Routes Added

| Path | Component | Auth required | Meta |
|------|-----------|---------------|------|
| `/:slug(.+)` | `CmsPage.vue` | No | `cmsLayout: true` |
| `/pages` | `CmsPageIndex.vue` | No | `cmsLayout: true` |

## Stores

**Store name:** `cms-user`

| State key | Type | Description |
|-----------|------|-------------|
| `categories` | `CmsCategory[]` | All CMS categories |
| `pageList` | `PaginatedPages \| null` | Paginated page list |
| `currentPage` | `CmsPageItem \| null` | Currently viewed page |
| `currentLayout` | `CmsLayout \| null` | Current page layout |
| `currentStyleCss` | `string \| null` | CSS for current page |
| `loading` | `boolean` | Loading state |
| `error` | `string \| null` | Error message |

**Key actions:** `fetchCategories()`, `fetchPages(params)`, `fetchPage(slug)`, `fetchLayout(id)`, `fetchStyleCss(id)`

## i18n Keys

Translations live in `plugins/cms/locales/`. Available: `en`

## Config

`plugins/cms/config.json` — user-facing enabled/disabled flag.

## Architecture

```
plugins/cms/
├── index.ts
├── src/
│   ├── views/
│   │   ├── CmsPage.vue           # Renders a page by slug
│   │   └── CmsPageIndex.vue      # Category + page listing
│   ├── components/
│   │   ├── CmsLayoutRenderer.vue # Renders layout slots
│   │   ├── CmsWidgetRenderer.vue # Renders individual widgets
│   │   ├── CmsBreadcrumb.vue     # Breadcrumb widget
│   │   ├── NativePricingPlans.vue # Pricing plans widget
│   │   └── ContactForm.vue       # Contact form widget
│   ├── registry/
│   │   └── vueComponentRegistry.ts # Widget component registry
│   └── stores/
│       └── useCmsStore.ts
└── locales/
```

## Extending

Register new Vue widgets for use in CMS layouts:

```typescript
import { vueComponentRegistry } from '../cms/src/registry/vueComponentRegistry'
import MyWidget from './MyWidget.vue'

vueComponentRegistry.register('my-widget', MyWidget)
```

The widget `type` must match the `type` field stored in the `cms_widget` table.
