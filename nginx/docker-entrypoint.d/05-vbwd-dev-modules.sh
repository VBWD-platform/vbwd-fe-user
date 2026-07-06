#!/bin/sh
# S120.1 — DEV ONLY (fe-user docker-compose.yaml `dev` profile, stock
# nginx:alpine). Bind-mounted into /docker-entrypoint.d/; NOT baked into the
# production image (which loads these at build time in the Dockerfile).
#
# The stock nginx image ships the njs module .so but does not load it, and has no
# GeoIP2. This injects the njs `load_module` + `env GEO_TEST_ALLOW;` at MAIN
# context so nginx.dev.conf's `js_content geo.handle;` works. GeoIP2 is
# deliberately absent in dev — country is forced via the X-VBWD-Geo-Test header
# (GEO_TEST_ALLOW=1) and $geoip2_country_code is defined empty by
# 25-vbwd-geoip2.sh's fallback map. Idempotent (safe on restart).
set -eu

CONF=/etc/nginx/nginx.conf

if ! grep -q 'ngx_http_js_module.so' "$CONF"; then
    printf '%s\n' \
        'load_module modules/ngx_http_js_module.so;' \
        'env GEO_TEST_ALLOW;' \
        | cat - "$CONF" > "$CONF.new"
    mv "$CONF.new" "$CONF"
    echo "[vbwd-dev-modules] injected njs load_module + env GEO_TEST_ALLOW"
fi
