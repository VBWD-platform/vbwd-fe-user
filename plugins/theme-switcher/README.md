# theme-switcher (fe-user plugin)

Theme selection UI — allows users to pick and persist a visual theme.

## Routes

| Path | Component |
|------|-----------|
| `/themes` | `ThemeSelectorView.vue` |

## Key files

- `presets.ts` — list of available theme presets
- `apply-theme.ts` — applies a theme by injecting CSS variables

## No backend counterpart

Theme preference is stored in `localStorage` only.

---

## Related

**Core:** [vbwd-fe-user](https://github.com/VBWD-platform/vbwd-fe-user) · [vbwd-fe-core](https://github.com/VBWD-platform/vbwd-fe-core)
