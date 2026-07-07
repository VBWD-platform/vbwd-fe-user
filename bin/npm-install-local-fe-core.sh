#!/bin/sh
# npm install for local/dev containers, resolving vbwd-view-component from the
# bind-mounted fe-core submodule instead of the registry.
#
# package.json pins vbwd-view-component to the registry alias
# (npm:@vbwd-platform/vbwd-view-component) so the *standalone* fe-user CI can
# pull fe-core from GitHub Packages. That package is not published for local
# use, so a raw `npm install` 404s. Here we do what the production Dockerfile
# does: rewrite the dep to the local submodule, install, then restore
# package.json so the working tree stays clean (npm symlinks node_modules into
# the bind-mounted submodule, so the restore does not break resolution).
#
# Any extra args (e.g. --no-package-lock) are forwarded to `npm install`.
set -e

BAK="$(mktemp)"
cp package.json "$BAK"
restore() { cp "$BAK" package.json; rm -f "$BAK"; }
trap restore EXIT INT TERM

npm pkg set dependencies.vbwd-view-component=file:./vbwd-fe-core
npm install "$@"
