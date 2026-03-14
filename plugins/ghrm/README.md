# ghrm (fe-user plugin)

GitHub Repo Manager — software catalogue with subscription-gated GitHub access.

## Routes

| Path | Component |
|------|-----------|
| `/software` | `GhrmCatalogueContent.vue` — package listing |
| `/software/:slug` | `GhrmPackageDetail.vue` — package detail with releases |

## CMS integration

Registers `GhrmCatalogueContent` and `GhrmPackageDetail` as CMS Vue components, allowing them to be embedded in CMS pages via the `vue-component` widget type.

## Backend counterpart

`vbwd-backend/plugins/ghrm/` — `/api/v1/ghrm/*`

## Admin counterpart

`vbwd-fe-admin/plugins/ghrm-admin/`
