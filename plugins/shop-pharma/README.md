# shop-pharma (fe-user) — pharmacy storefront

A pharmacy **storefront** built on top of the `shop` module (S101.3). It owns its
own routes and views and reuses the shop plugin's cart/checkout for purchasing.

## Routes
- `/pharmacy` — class-segmented catalogue (`GET /api/v1/pharma/catalogue`)
- `/pharmacy/c/:slug` — single-category catalogue (`?category=<slug>`)
- `/pharmacy/p/:slug` — regulated product page (`GET /api/v1/pharma/products/<slug>`)

## Class-aware gates (UX only — the backend is authoritative)
- **RX** — purchase blocked ("prescription required")
- **OTC** — age gate (when an age restriction applies) + per-order max-quantity guard
- **MEDICAL_DEVICE / FMCG_PERSONAL / FMCG_HOSPITAL** — sold normally

Add-to-cart reuses the shop plugin's `useCartStore`; checkout flows through the
existing shop `/checkout?source=shop` path. Region compliance facts (logo,
register URL, pharmacovigilance URL, withdrawal-right copy, code scheme) come
from the active region object returned by the backend — no jurisdiction is
hardcoded.
