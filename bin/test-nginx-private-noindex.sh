#!/usr/bin/env bash
# Private areas are never indexed — behaviour test for `X-Robots-Tag`.
#
# Every response for a path under /pay, /software, /dashboard, /tuktuk
# (segment-aware) must carry exactly `X-Robots-Tag: noindex, nofollow`, whichever
# nginx branch serves it: @frontend (themed page), @spa (SPA shell), the static
# prerender (try_files rewrites $uri to /seo/<path>.html), @seo_dynamic,
# @seo_static, @seo_shell, @theme_not_found (404) and the SPA-only location.
# Every other path carries no X-Robots-Tag at all. Runs the REAL nginx confs
# against a stub backend via bin/lib/nginx-behaviour-harness.sh:
#   prod-render — prod template, SEO_RENDER_ON=1 (crawler dynamic render live)
#   prod-static — prod template, SEO_RENDER_ON=0 (crawler static prerender)
#   dev         — nginx.dev.conf
#
# Needs only docker. Containers, network and temp files are removed on exit.
#   bin/test-nginx-private-noindex.sh
#   NGINX_IMAGE=nginx:1.27-alpine bin/test-nginx-private-noindex.sh
set -uo pipefail

RUN_ID_PREFIX="vbwd-private-noindex-test"
# shellcheck source=lib/nginx-behaviour-harness.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/nginx-behaviour-harness.sh"

PROD_RENDER_CONTAINER="$RUN_ID-prod-render"
PROD_STATIC_CONTAINER="$RUN_ID-prod-static"
DEV_CONTAINER="$RUN_ID-dev"
PRIVATE_ROBOTS_TAG='noindex, nofollow'
PRERENDER_MARKER='PRERENDER page'

# expect_robots_tag <label> <base url> <path> <user agent> <status> <body marker> <tag>
# An empty <tag> asserts that NO X-Robots-Tag header is sent.
expect_robots_tag() {
    local label="$1" base_url="$2" path="$3" user_agent="$4"
    local expected_status="$5" body_marker="$6" expected_tag="$7"
    local actual_status actual_tags
    actual_status="$(fetch "$base_url" "$path" "$user_agent")"
    actual_tags="$(grep -i '^x-robots-tag:' "$WORK_DIRECTORY/headers" \
        | sed -e 's/^[^:]*:[[:space:]]*//' -e 's/\r$//')"
    if [ "$actual_status" != "$expected_status" ]; then
        fail "$label: $path → $actual_status (expected $expected_status)"
    elif [ -n "$body_marker" ] && ! grep -qF -- "$body_marker" "$WORK_DIRECTORY/body"; then
        fail "$label: $path body lacks '$body_marker': $(head -c 200 "$WORK_DIRECTORY/body")"
    elif [ "$actual_tags" != "$expected_tag" ]; then
        fail "$label: $path X-Robots-Tag '$actual_tags' (expected '${expected_tag:-<none>}')"
    else
        pass "$label: $path → $expected_status ${body_marker:+($body_marker) }X-Robots-Tag '${expected_tag:-<none>}'"
    fi
}

write_prerender() { mkdir -p "$(dirname "$WORK_DIRECTORY/html/seo$1.html")"; printf '<html>%s</html>\n' "$PRERENDER_MARKER" > "$WORK_DIRECTORY/html/seo$1.html"; }
# Empties seo/ in place — dev bind-mounts that directory itself.
remove_prerenders() { find "$WORK_DIRECTORY/html/seo" -mindepth 1 -delete; }

# Branches every conf shares: the human SPA shell, the themed page, the theme
# not-found, and the public paths that must stay header-free.
check_shared_branches() {
    local label="$1" base_url="$2" human="$HUMAN_USER_AGENT" tag="$PRIVATE_ROBOTS_TAG"
    local private_path
    for private_path in /software /software/payments /pay /pay/yookassa '/pay?invoice=1' \
        /dashboard /dashboard/subscriptions /tuktuk /DASHBOARD //pay/yookassa; do
        expect_robots_tag "$label human" "$base_url" "$private_path" "$human" 200 "$SPA_SHELL_MARKER" "$tag"
    done
    expect_robots_tag "$label human" "$base_url" /pay/stripe "$human" 200 "$THEMED_MARKER" "$tag"
    expect_robots_tag "$label crawler" "$base_url" /pay/stripe "$CRAWLER_USER_AGENT" 200 "$THEMED_MARKER" "$tag"
    expect_robots_tag "$label human" "$base_url" /software/missing "$human" 404 "$SPA_SHELL_MARKER" "$tag"
    expect_robots_tag "$label crawler" "$base_url" /software/missing "$CRAWLER_USER_AGENT" 404 "$SPA_SHELL_MARKER" "$tag"
    expect_robots_tag "$label human" "$base_url" /real "$human" 200 "$THEMED_MARKER" ""
    expect_robots_tag "$label human" "$base_url" /missing "$human" 404 "$SPA_SHELL_MARKER" ""
    expect_robots_tag "$label human" "$base_url" /payments-guide "$human" 200 "$SPA_SHELL_MARKER" ""
    expect_robots_tag "$label human" "$base_url" /softwarex "$human" 200 "$SPA_SHELL_MARKER" ""
    expect_robots_tag "$label human" "$base_url" / "$human" 200 "$SPA_SHELL_MARKER" ""
    expect_robots_tag "$label human" "$base_url" '/?next=/pay' "$human" 200 "$SPA_SHELL_MARKER" ""
    expect_robots_tag "$label crawler" "$base_url" /real "$CRAWLER_USER_AGENT" 200 "$THEMED_MARKER" ""
}

check_prod_render() {
    local base_url tag="$PRIVATE_ROBOTS_TAG" crawler="$CRAWLER_USER_AGENT" private_path
    base_url="$(base_url_of "$PROD_RENDER_CONTAINER")"
    wait_until_ready "$base_url" || { fail "prod-render nginx never answered"; docker logs "$PROD_RENDER_CONTAINER"; return; }
    check_shared_branches prod-render "$base_url"
    expect_robots_tag prod-render "$base_url" /assets/x.js "$HUMAN_USER_AGENT" 404 "" ""
    # @seo_dynamic — the crawler render, incl. the SPA-only location.
    for private_path in /software /software/payments /pay/yookassa /dashboard /tuktuk; do
        expect_robots_tag "prod-render crawler" "$base_url" "$private_path" "$crawler" 200 "$DYNAMIC_RENDER_MARKER" "$tag"
    done
    expect_robots_tag "prod-render crawler" "$base_url" /payments-guide "$crawler" 200 "$DYNAMIC_RENDER_MARKER" ""
    # @seo_static → @seo_shell (render miss, no prerender), then @seo_static's prerender.
    expect_robots_tag "prod-render crawler" "$base_url" /software/render-miss "$crawler" 200 "$SPA_SHELL_MARKER" "$tag"
    write_prerender /software/render-miss
    expect_robots_tag "prod-render crawler" "$base_url" /software/render-miss "$crawler" 200 "$PRERENDER_MARKER" "$tag"
    # @theme_not_found — a prerender for the missing themed path still wins (200).
    write_prerender /software/missing
    expect_robots_tag "prod-render crawler" "$base_url" /software/missing "$crawler" 200 "$PRERENDER_MARKER" "$tag"
    remove_prerenders
}

check_prod_static() {
    local base_url tag="$PRIVATE_ROBOTS_TAG" crawler="$CRAWLER_USER_AGENT"
    base_url="$(base_url_of "$PROD_STATIC_CONTAINER")"
    wait_until_ready "$base_url" || { fail "prod-static nginx never answered"; docker logs "$PROD_STATIC_CONTAINER"; return; }
    # @spa try_files serves seo/software.html — $uri is rewritten, $request_uri is not.
    write_prerender /software
    write_prerender /public-page
    expect_robots_tag "prod-static crawler" "$base_url" /software "$crawler" 200 "$PRERENDER_MARKER" "$tag"
    expect_robots_tag "prod-static crawler" "$base_url" /public-page "$crawler" 200 "$PRERENDER_MARKER" ""
    expect_robots_tag "prod-static crawler" "$base_url" /dashboard "$crawler" 200 "$SPA_SHELL_MARKER" "$tag"
    expect_robots_tag "prod-static crawler" "$base_url" /softwarex "$crawler" 200 "$SPA_SHELL_MARKER" ""
    remove_prerenders
}

check_dev() {
    local base_url tag="$PRIVATE_ROBOTS_TAG" crawler="$CRAWLER_USER_AGENT"
    base_url="$(base_url_of "$DEV_CONTAINER")"
    wait_until_ready "$base_url" || { fail "dev nginx never answered"; docker logs "$DEV_CONTAINER"; return; }
    check_shared_branches dev "$base_url"
    write_prerender /software
    expect_robots_tag "dev crawler" "$base_url" /software "$crawler" 200 "$PRERENDER_MARKER" "$tag"
    expect_robots_tag "dev crawler" "$base_url" /dashboard "$crawler" 200 "$SPA_SHELL_MARKER" "$tag"
    expect_robots_tag "dev crawler" "$base_url" /softwarex "$crawler" 200 "$SPA_SHELL_MARKER" ""
    remove_prerenders
}

write_fixtures
start_stub
start_prod_nginx "$PROD_RENDER_CONTAINER" 1
start_prod_nginx "$PROD_STATIC_CONTAINER" 0
start_dev_nginx "$DEV_CONTAINER"
check_prod_render
check_prod_static
check_dev

if [ "$failure_count" -gt 0 ]; then
    echo "$failure_count check(s) FAILED" >&2
    exit 1
fi
echo "All private-noindex checks passed"
