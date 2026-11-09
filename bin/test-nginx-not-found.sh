#!/usr/bin/env bash
# Soft-404 fix — behaviour test for the X-VBWD-Not-Found contract.
#
# A theme plugin answers a TRUE not-found (it owns the URL, the resource is
# missing) with 404 + `X-VBWD-Not-Found: 1`; a plain 404 still means "not a
# themed route, hand to the SPA". This runs the REAL nginx confs in throwaway
# containers against a stub backend and asserts what a browser / crawler gets:
#
#   prod — nginx.prod.conf.template, envsubst'd by the stock image entrypoint
#          exactly as the Dockerfile ships it (template → conf.d/default.conf),
#          with the real njs geo handler (fail-open: no geo-block.json) and the
#          shared snippets. SEO_RENDER_ON=1 so the crawler dynamic-render branch
#          is LIVE — the not-found path must still skip it.
#   dev  — nginx.dev.conf as docker-compose.yaml mounts it; the stub doubles as
#          the Vite dev server (`dev:5173`) and the backend
#          (`host.docker.internal:5000`).
#
# Needs only docker. Containers, network and temp files are removed on exit.
#   bin/test-nginx-not-found.sh
#   NGINX_IMAGE=nginx:1.27-alpine bin/test-nginx-not-found.sh
set -uo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FE_USER_DIRECTORY="$(cd "$SCRIPT_DIRECTORY/.." && pwd)"
# The Dockerfile serve stage pins nginx:1.29-alpine.
NGINX_IMAGE="${NGINX_IMAGE:-nginx:1.29-alpine}"
STUB_IMAGE="${STUB_IMAGE:-python:3.12-alpine}"
RUN_ID="vbwd-not-found-test-$$"
NETWORK_NAME="$RUN_ID"
STUB_CONTAINER="$RUN_ID-stub"
PROD_CONTAINER="$RUN_ID-prod"
DEV_CONTAINER="$RUN_ID-dev"
WORK_DIRECTORY="$(mktemp -d)"
READY_ATTEMPTS=50
READY_POLL_SECONDS=0.2
HTML_ACCEPT='text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
CRAWLER_USER_AGENT='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
SPA_SHELL_MARKER='<title>VBWD User Portal</title>'
THEMED_MARKER='THEMED PAGE'
DYNAMIC_RENDER_MARKER='DYNAMIC RENDER'
PRERENDER_MARKER='PRERENDER missing'

failure_count=0

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1" >&2; failure_count=$((failure_count + 1)); }

cleanup() {
    docker rm -f "$PROD_CONTAINER" "$DEV_CONTAINER" "$STUB_CONTAINER" >/dev/null 2>&1
    docker network rm "$NETWORK_NAME" >/dev/null 2>&1
    rm -rf "$WORK_DIRECTORY"
}
trap cleanup EXIT

write_fixtures() {
    mkdir -p "$WORK_DIRECTORY/html/seo" "$WORK_DIRECTORY/stub"
    printf '<!doctype html><html><head>%s</head><body><div id="app"></div></body></html>\n' \
        "$SPA_SHELL_MARKER" > "$WORK_DIRECTORY/html/index.html"
    # Backend (:5000) + Vite dev server (:5173). /missing* is a themed URL whose
    # resource is gone; every other unknown path is a plain "not mine" 404.
    cat > "$WORK_DIRECTORY/stub/stub_server.py" <<'PYTHON'
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BACKEND_PORT = 5000
VITE_PORT = 5173
SPA_SHELL = b'<!doctype html><html><head><title>VBWD User Portal</title></head></html>'


class BackendHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/real":
            self.answer(200, b"<html>THEMED PAGE</html>")
        elif self.path.startswith("/api/v1/cms/_seo-render"):
            self.answer(200, b"<html>DYNAMIC RENDER</html>")
        elif self.path.startswith("/missing"):
            self.answer(404, b"backend not found", {"X-VBWD-Not-Found": "1"})
        else:
            self.answer(404, b"not a themed route")

    def answer(self, status, body, extra_headers=None):
        self.send_response(status)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", str(len(body)))
        for header_name, header_value in (extra_headers or {}).items():
            self.send_header(header_name, header_value)
        self.end_headers()
        self.wfile.write(body)


class ViteHandler(BackendHandler):
    def do_GET(self):
        self.answer(200, SPA_SHELL)


vite_server = ThreadingHTTPServer(("0.0.0.0", VITE_PORT), ViteHandler)
threading.Thread(target=vite_server.serve_forever, daemon=True).start()
ThreadingHTTPServer(("0.0.0.0", BACKEND_PORT), BackendHandler).serve_forever()
PYTHON
}

start_stub() {
    docker network create "$NETWORK_NAME" >/dev/null
    docker run -d --name "$STUB_CONTAINER" --network "$NETWORK_NAME" \
        --network-alias stub-backend --network-alias dev \
        --network-alias host.docker.internal \
        -v "$WORK_DIRECTORY/stub:/stub:ro" \
        "$STUB_IMAGE" python -u /stub/stub_server.py >/dev/null
}

# Mounts shared by both confs: the router/crawler snippets and the njs geo
# handler. 05-vbwd-dev-modules.sh injects the njs `load_module` the Dockerfile
# bakes into the prod image; 25-vbwd-geoip2.sh defines $geoip2_country_code
# (no GeoLite2 DB here → fail-open map), exactly as at a real container start.
shared_mounts() {
    local snippet
    for snippet in crawler-user-agents.conf seo-proxy-locations.conf \
        frontend-router-map.conf frontend-router.conf; do
        printf -- '-v\n%s/nginx/%s:/etc/nginx/snippets/%s:ro\n' \
            "$FE_USER_DIRECTORY" "$snippet" "$snippet"
    done
    printf -- '-v\n%s/nginx/geo_block.js:/etc/nginx/njs/geo_block.js:ro\n' "$FE_USER_DIRECTORY"
    for entrypoint_script in 05-vbwd-dev-modules.sh 25-vbwd-geoip2.sh; do
        printf -- '-v\n%s/nginx/docker-entrypoint.d/%s:/docker-entrypoint.d/%s:ro\n' \
            "$FE_USER_DIRECTORY" "$entrypoint_script" "$entrypoint_script"
    done
}

start_prod_nginx() {
    local mount_arguments=() mount_argument
    while IFS= read -r mount_argument; do mount_arguments+=("$mount_argument"); done < <(shared_mounts)
    docker run -d --name "$PROD_CONTAINER" --network "$NETWORK_NAME" -p 127.0.0.1::80 \
        -e API_UPSTREAM=stub-backend:5000 -e PLUGIN_API_UPSTREAM=stub-backend:5000 \
        -e SEO_RENDER_ON=1 -e SEO_RENDER_TOKEN=test-token -e CANONICAL_HOST= \
        -v "$FE_USER_DIRECTORY/nginx.prod.conf.template:/etc/nginx/templates/default.conf.template:ro" \
        -v "$WORK_DIRECTORY/html:/usr/share/nginx/html:ro" \
        "${mount_arguments[@]}" "$NGINX_IMAGE" >/dev/null
}

start_dev_nginx() {
    local mount_arguments=() mount_argument
    while IFS= read -r mount_argument; do mount_arguments+=("$mount_argument"); done < <(shared_mounts)
    docker run -d --name "$DEV_CONTAINER" --network "$NETWORK_NAME" -p 127.0.0.1::80 \
        -v "$FE_USER_DIRECTORY/nginx.dev.conf:/etc/nginx/conf.d/default.conf:ro" \
        -v "$WORK_DIRECTORY/html/seo:/usr/share/nginx/seo:ro" \
        "${mount_arguments[@]}" "$NGINX_IMAGE" >/dev/null
}

base_url_of() {
    echo "http://$(docker port "$1" 80/tcp | head -n 1)"
}

wait_until_ready() {
    local base_url="$1" attempt
    for attempt in $(seq "$READY_ATTEMPTS"); do
        curl -s -o /dev/null "$base_url/real" && return 0
        sleep "$READY_POLL_SECONDS"
    done
    return 1
}

# expect_response <label> <base url> <path> <user agent> <status> <body marker> [header]
expect_response() {
    local label="$1" base_url="$2" path="$3" user_agent="$4"
    local expected_status="$5" body_marker="$6" expected_header="${7:-}"
    local headers_file="$WORK_DIRECTORY/headers" body_file="$WORK_DIRECTORY/body"
    local actual_status
    actual_status="$(curl -s -D "$headers_file" -o "$body_file" -w '%{http_code}' \
        -H "Accept: $HTML_ACCEPT" -A "$user_agent" "$base_url$path")"
    if [ "$actual_status" != "$expected_status" ]; then
        fail "$label: $path → $actual_status (expected $expected_status)"
    elif [ -n "$body_marker" ] && ! grep -qF -- "$body_marker" "$body_file"; then
        fail "$label: $path body lacks '$body_marker': $(head -c 200 "$body_file")"
    elif [ -n "$expected_header" ] && ! grep -qiF -- "$expected_header" "$headers_file"; then
        fail "$label: $path lacks header '$expected_header'"
    else
        pass "$label: $path → $expected_status ${body_marker:+($body_marker)}"
    fi
}

expect_no_body_marker() {
    local label="$1" base_url="$2" path="$3" user_agent="$4" forbidden_marker="$5"
    if curl -s -H "Accept: $HTML_ACCEPT" -A "$user_agent" "$base_url$path" \
        | grep -qF -- "$forbidden_marker"; then
        fail "$label: $path served '$forbidden_marker'"
    else
        pass "$label: $path did not serve '$forbidden_marker'"
    fi
}

check_prod() {
    local base_url human='Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0'
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
}

check_dev() {
    local base_url human='Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0'
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
}

write_fixtures
start_stub
start_prod_nginx
start_dev_nginx
check_prod
check_dev

if [ "$failure_count" -gt 0 ]; then
    echo "$failure_count check(s) FAILED" >&2
    exit 1
fi
echo "All not-found checks passed"
