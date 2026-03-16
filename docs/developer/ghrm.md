# Plugin: ghrm (fe-user)

## Purpose

GitHub Repo Manager frontend — software catalogue with subscription-gated GitHub repository access. Browseable package catalogue, package detail pages with README/CHANGELOG/versions, GitHub OAuth connect flow, install instructions, and search. Registers CMS widget components and plan detail tabs so the catalogue integrates seamlessly with CMS-driven pages.

## Installation

The plugin self-registers in `plugins/plugins.json`. Loaded by `vue/src/main.ts` via `pluginLoader`.

Requires the backend `ghrm` plugin and the `cms` + `checkout` fe-user plugins.

## Routes Added

| Path | Component | Auth required | Meta |
|------|-----------|---------------|------|
| `/category` | `GhrmCatalogueContent.vue` | No | `cmsLayout: true` |
| `/category/:category_slug` | `GhrmCatalogueContent.vue` | No | `cmsLayout: true` |
| `/category/:category_slug/:package_slug` | `GhrmPackageDetail.vue` | No | `cmsLayout: true` |
| `/category/search` | `GhrmSearch.vue` | No | `cmsLayout: true` |
| `/ghrm/auth/github/callback` | `GhrmOAuthCallback.vue` | No | — |

## Stores

**Store name:** `ghrm`

| State key | Type | Description |
|-----------|------|-------------|
| `packages` | `GhrmPaginated<GhrmPackageListItem> \| null` | Package listing |
| `currentPackage` | `GhrmPackage \| null` | Currently viewed package |
| `relatedPackages` | `GhrmPackageListItem[]` | Related packages |
| `versions` | `{...}[]` | Package release versions |
| `installInstructions` | `GhrmInstallInstructions \| null` | Install guide |
| `accessStatus` | `GhrmAccessStatus \| null` | GitHub access status |
| `searchResults` | `GhrmPaginated<GhrmPackageListItem> \| null` | Search results |

**Key actions:** `fetchPackages(params)`, `fetchPackage(slug)`, `fetchRelated(slug)`, `fetchVersions(slug)`, `fetchInstallInstructions(slug)`, `fetchAccessStatus()`, `search(query, page)`, `disconnect()`

## i18n Keys

Translations live in `plugins/ghrm/locales/`. Available: `en`

## Config

`plugins/ghrm/config.json` — user-facing enabled/disabled flag.

## Architecture

```
plugins/ghrm/
├── index.ts
├── src/
│   ├── api/
│   │   └── ghrmApi.ts
│   ├── views/
│   │   ├── GhrmCatalogueContent.vue
│   │   ├── GhrmPackageDetail.vue
│   │   ├── GhrmOAuthCallback.vue
│   │   └── GhrmSearch.vue
│   ├── components/
│   │   ├── GhrmBreadcrumb.vue
│   │   ├── GhrmCheckoutContext.vue     # Injected into checkout plugin
│   │   ├── GhrmGithubConnectButton.vue
│   │   ├── GhrmInstallInstructions.vue
│   │   ├── GhrmMarkdownRenderer.vue
│   │   ├── GhrmPlanGithubAccessTab.vue # Injected into plan detail
│   │   ├── GhrmPlanSoftwareTab.vue
│   │   └── GhrmVersionsTable.vue
│   └── stores/
│       └── useGhrmStore.ts
└── locales/
```

## Extending

The plugin injects `GhrmCheckoutContext.vue` into the checkout flow via `checkoutContextRegistry` and registers plan detail tabs via the plan tab extension registry. Additional tabs or context components can be added the same way.
