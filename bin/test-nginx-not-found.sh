#!/usr/bin/env bash
# Soft-404 fix — behaviour test for the X-VBWD-Not-Found contract.
#
# A theme plugin answers a TRUE not-found (it owns the URL, the resource is
# missing) with 404 + `X-VBWD-Not-Found: 1`; a plain 404 still means "not a
# themed route, hand to the SPA". Runs the REAL nginx confs (prod template +
# dev conf) against a stub backend via bin/lib/nginx-behaviour-harness.sh and
# asserts what a browser / crawler gets. Prod runs with SEO_RENDER_ON=1 so the
# crawler dynamic-render branch is LIVE — the not-found path must still skip it.
# Also: every sitemap chunk — legacy /sitemap-<n>.xml and S154 per-provider
# /sitemap-<provider>-<n>.xml — reaches the backend instead of the SPA shell's
# soft 200 HTML.
#
# Needs only docker. Containers, network and temp files are removed on exit.
#   bin/test-nginx-not-found.sh
#   NGINX_IMAGE=nginx:1.27-alpine bin/test-nginx-not-found.sh
set -uo pipefail

RUN_ID_PREFIX="vbwd-not-found-test"
# shellcheck source=lib/nginx-behaviour-harness.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/nginx-behaviour-harness.sh"

PROD_CONTAINER="$RUN_ID-prod"
DEV_CONTAINER="$RUN_ID-dev"
PRERENDER_MARKER='PRERENDER missing'

# check_sitemap_chunks <label> <base url>
check_sitemap_chunks() {
    local label="$1" base_url="$2" sitemap_path
    for sitemap_path in /sitemap-1.xml /sitemap-cms-1.xml /sitemap-shop-products-12.xml; do
        expect_sitemap_proxied "$label" "$base_url" "$sitemap_path"
    done
}

check_prod() {
    local base_url human="$HUMAN_USER_AGENT"
    base_url="$(base_url_of "$PROD_CONTAINER")"
    wait_until_ready "$base_url" || { fail "prod nginx never answered"; docker logs "$PROD_CONTAINER"; return; }
    expect_response prod "$base_url" /real "$human" 200 "$THEMED_MARKER"
    expect_response prod "$base_url" /missing "$human" 404 "$SPA_SHELL_MARKER" 'Cache-Control: no-cache'
    expect_response prod "$base_url" /missing/deep/path.vue "$human" 404 "$SPA_SHELL_MARKER"
    expect_response prod "$base_url" /dashboard "$human" 200 "$SPA_SHELL_MARKER"
    expect_response prod "$base_url" /register "$human" 200 "$SPA_SHELL_MARKER"
    expect_response prod "$base_url" /assets/nope.js "$human" 404 ""
    # Control: the crawler dynamic-render branch is live for a plain 404 …
    expect_response "prod crawler" "$base_url" /register "$CRAWLER_USER_AGENT" 200 "$DYNAMIC_RENDER_MARKER"
    # … and skipped for a theme not-found.
    expect_response "prod crawler" "$base_url" /missing "$CRAWLER_USER_AGENT" 404 "$SPA_SHELL_MARKER"
    expect_no_body_marker "prod crawler" "$base_url" /missing "$CRAWLER_USER_AGENT" "$DYNAMIC_RENDER_MARKER"
    printf '<html>%s</html>\n' "$PRERENDER_MARKER" > "$WORK_DIRECTORY/html/seo/missing.html"
    expect_response "prod crawler" "$base_url" /missing "$CRAWLER_USER_AGENT" 200 "$PRERENDER_MARKER"
    expect_response prod "$base_url" /missing "$human" 404 "$SPA_SHELL_MARKER"
    rm -f "$WORK_DIRECTORY/html/seo/missing.html"
    check_sitemap_chunks "prod sitemap" "$base_url"
}

check_dev() {
    local base_url human="$HUMAN_USER_AGENT"
    base_url="$(base_url_of "$DEV_CONTAINER")"
    wait_until_ready "$base_url" || { fail "dev nginx never answered"; docker logs "$DEV_CONTAINER"; return; }
    expect_response dev "$base_url" /real "$human" 200 "$THEMED_MARKER"
    expect_response dev "$base_url" /missing "$human" 404 "$SPA_SHELL_MARKER"
    expect_response dev "$base_url" /register "$human" 200 "$SPA_SHELL_MARKER"
    expect_response dev "$base_url" /dashboard "$human" 200 "$SPA_SHELL_MARKER"
    expect_response "dev crawler" "$base_url" /missing "$CRAWLER_USER_AGENT" 404 "$SPA_SHELL_MARKER"
    printf '<html>%s</html>\n' "$PRERENDER_MARKER" > "$WORK_DIRECTORY/html/seo/missing.html"
    expect_response "dev crawler" "$base_url" /missing "$CRAWLER_USER_AGENT" 200 "$PRERENDER_MARKER"
    rm -f "$WORK_DIRECTORY/html/seo/missing.html"
    check_sitemap_chunks "dev sitemap" "$base_url"
}

write_fixtures
start_stub
start_prod_nginx "$PROD_CONTAINER" 1
start_dev_nginx "$DEV_CONTAINER"
check_prod
check_dev

if [ "$failure_count" -gt 0 ]; then
    echo "$failure_count check(s) FAILED" >&2
    exit 1
fi
echo "All not-found checks passed"
