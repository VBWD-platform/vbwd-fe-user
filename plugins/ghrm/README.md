# ghrm (fe-user plugin)

GitHub Repo Manager — software catalogue with subscription-gated GitHub access.

## Routes

| Path | Component |
|------|-----------|
| `/software` | `GhrmCatalogueContent.vue` — package listing |
| `/software/:slug` | `GhrmPackageDetail.vue` — package detail with releases |

## CMS integration

Registers `GhrmCatalogueContent` and `GhrmPackageDetail` as CMS Vue components, allowing them to be embedded in CMS pages via the `vue-component` widget type.

---

## Related

| | Repository |
|-|------------|
| 🖥 Backend | [vbwd-plugin-ghrm](https://github.com/VBWD-platform/vbwd-plugin-ghrm) |
| 🛠 Frontend (admin) | [vbwd-fe-admin-plugin-ghrm](https://github.com/VBWD-platform/vbwd-fe-admin-plugin-ghrm) |

**Core:** [vbwd-fe-user](https://github.com/VBWD-platform/vbwd-fe-user) · [vbwd-fe-core](https://github.com/VBWD-platform/vbwd-fe-core)
