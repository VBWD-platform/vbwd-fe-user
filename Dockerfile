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

# ── Stage 2: Serve ──────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.prod.conf.template /etc/nginx/templates/default.conf.template

# API_UPSTREAM is the backend service host:port within the Docker network.
# PLUGIN_API_UPSTREAM is the plugin-api sidecar (/_plugins endpoint).
# Override at runtime via environment variables.
ENV API_UPSTREAM=api:5000
ENV PLUGIN_API_UPSTREAM=plugin-api:3001

EXPOSE 80
