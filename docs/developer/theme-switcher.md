# Plugin: theme-switcher (fe-user)

## Purpose

Dashboard color theme selector with preset themes. Applies themes via CSS custom properties (`var(--vbwd-*)`) compatible with the fe-core design system. Persists the selected theme to `localStorage` (key: `vbwd_theme`). Reverts to default theme on plugin deactivation.

## Installation

The plugin self-registers in `plugins/plugins.json`. Loaded by `vue/src/main.ts` via `pluginLoader`.

## Routes Added

| Path | Component | Auth required |
|------|-----------|---------------|
| `/dashboard/appearance` | `ThemeSelectorView.vue` | Yes |

## Stores

No Pinia store. Theme state is managed via `localStorage` + direct DOM style injection.

## i18n Keys

Translations live in `plugins/theme-switcher/locales/`.
Available locales: `en`, `de`, `es`, `fr`, `ja`, `ru`, `th`, `zh`

## Config

`plugins/theme-switcher/config.json` — user-facing enabled/disabled flag.

## Architecture

```
plugins/theme-switcher/
├── index.ts               # Plugin install: addRoute, apply saved theme on activate
├── ThemeSelectorView.vue  # Theme preset picker UI
├── apply-theme.ts         # applyTheme(preset) — sets CSS vars on :root
├── presets.ts             # Theme preset definitions (name, CSS var map)
└── locales/               # 8 locale files
```

## Extending

Add new theme presets to `presets.ts`:

```typescript
export const presets = [
  { name: 'ocean', vars: { '--vbwd-primary': '#0ea5e9', '--vbwd-bg': '#0f172a', ... } },
  // ...
]
```

New presets appear automatically in `ThemeSelectorView.vue` without code changes.
