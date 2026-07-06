# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Requires vbwd-fe-core submodule (clone with --recurse-submodules)
COPY . .

# Build shared component library first so the file: dependency resolves
RUN cd vbwd-fe-core && rm -f package-lock.json && npm install && npm run build && rm -rf node_modules

# Install and build main application against the locally-built fe-core.
# package.json pins vbwd-view-component to a registry alias
# (npm:@vbwd-platform/vbwd-view-component) for platform/SDK consumers, but that
# package is not published to GitHub Packages yet — override it to the built
# submodule so this image resolves fe-core locally instead of 404ing on the
# registry. Remove the lockfile so npm resolves platform-specific optional deps
# (e.g. @rollup/rollup-linux-x64-musl).
RUN rm -f package-lock.json \
 && npm pkg set dependencies.vbwd-view-component=file:./vbwd-fe-core \
 && npm install

ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 1b: Build the GeoIP2 dynamic module (S120.1) ──────────────────────
# The official nginx:alpine ships njs (nginx-module-njs) but NOT GeoIP2, and the
# Alpine community nginx-mod-http-geoip2 apk conflicts with the nginx.org-built
# nginx in this image. So compile leev/ngx_http_geoip2_module as a dynamic module
# against the EXACT nginx source of the pinned base with `--with-compat`, then
# copy just the .so into the serve stage. Both stages pin `nginx:1.29-alpine`
# (not floating `:alpine`) so the module ABI matches the runtime nginx.
FROM nginx:1.29-alpine AS geoip2-builder
ARG GEOIP2_MODULE_VERSION=3.4
RUN set -eux; \
    apk add --no-cache gcc make libc-dev pcre2-dev zlib-dev libmaxminddb-dev linux-headers wget; \
    NGINX_VERSION="$(nginx -v 2>&1 | sed 's|.*/||')"; \
    cd /tmp; \
    wget -q -O nginx.tar.gz "https://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz"; \
    wget -q -O geoip2.tar.gz "https://github.com/leev/ngx_http_geoip2_module/archive/refs/tags/${GEOIP2_MODULE_VERSION}.tar.gz"; \
    tar xzf nginx.tar.gz; \
    tar xzf geoip2.tar.gz; \
    cd "nginx-${NGINX_VERSION}"; \
    ./configure --with-compat "--add-dynamic-module=../ngx_http_geoip2_module-${GEOIP2_MODULE_VERSION}"; \
    make modules; \
    cp objs/ngx_http_geoip2_module.so /ngx_http_geoip2_module.so

# ── Stage 2: Serve ──────────────────────────────────────────────────────────
FROM nginx:1.29-alpine

# S120.1 — geo enforcement at the nginx layer.
#  - libmaxminddb: runtime dependency of the GeoIP2 module.
#  - GeoIP2 module .so from the builder stage; njs (ngx_http_js_module.so) already
#    ships in the base image.
#  - load both modules at MAIN context (they cannot live in conf.d) and expose the
#    dev-only GEO_TEST_ALLOW flag to njs via `env`.
#  - mount points /etc/nginx/geoip (mmdb) and /etc/nginx/geo (geo-block.json).
#  - the njs handler + the container-start entrypoint that emits the geoip2 block
#    only when the mmdb is present (fail-open when it is not).
RUN apk add --no-cache libmaxminddb
COPY --from=geoip2-builder /ngx_http_geoip2_module.so /etc/nginx/modules/ngx_http_geoip2_module.so
RUN printf '%s\n' \
      'load_module modules/ngx_http_geoip2_module.so;' \
      'load_module modules/ngx_http_js_module.so;' \
      'env GEO_TEST_ALLOW;' \
    | cat - /etc/nginx/nginx.conf > /etc/nginx/nginx.conf.new \
 && mv /etc/nginx/nginx.conf.new /etc/nginx/nginx.conf \
 && mkdir -p /etc/nginx/njs /etc/nginx/geoip /etc/nginx/geo
COPY nginx/geo_block.js /etc/nginx/njs/geo_block.js
COPY nginx/docker-entrypoint.d/25-vbwd-geoip2.sh /docker-entrypoint.d/25-vbwd-geoip2.sh
RUN chmod +x /docker-entrypoint.d/25-vbwd-geoip2.sh

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.prod.conf.template /etc/nginx/templates/default.conf.template

# API_UPSTREAM is the backend service host:port within the Docker network.
# PLUGIN_API_UPSTREAM is the plugin-api sidecar (/_plugins endpoint).
# Override at runtime via environment variables.
ENV API_UPSTREAM=api:5000
ENV PLUGIN_API_UPSTREAM=plugin-api:3001

# S120.1 — dev-only geo test override. When "1", the njs handler honours the
# `X-VBWD-Geo-Test: <ISO>` header as the visitor country so the block is
# exercisable from localhost without a foreign IP or a GeoIP DB. Empty (default)
# ⇒ the header is inert, so this is a pure no-op in production.
ENV GEO_TEST_ALLOW=""

# S118 Track B: shared secret nginx injects on the crawler dynamic-render proxy
# (X-VBWD-Render-Token), matched by the backend `seo_render_internal_token`. MUST
# be defined so the nginx template's ${SEO_RENDER_TOKEN} substitutes cleanly; the
# empty default keeps dynamic rendering OFF (backend 404 → static-prerender
# fallback) until an instance sets a real token.
ENV SEO_RENDER_TOKEN=""
# S118 feature switch for the nginx crawler branch. "0" (default) = crawlers get
# the static prerender exactly as pre-S118 (no dynamic render, no backend
# round-trip, no redirect loop). An instance sets "1" (with a token) to enable.
ENV SEO_RENDER_ON="0"

EXPOSE 80
