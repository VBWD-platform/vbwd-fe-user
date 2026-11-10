#!/usr/bin/env bash
# Shared harness for the real-nginx behaviour tests (bin/test-nginx-*.sh).
# `source` it after setting RUN_ID_PREFIX. Runs the REAL fe-user nginx confs in
# throwaway containers against a stub backend:
#
#   prod — nginx.prod.conf.template, envsubst'd by the stock image entrypoint
#          exactly as the Dockerfile ships it (template → conf.d/default.conf),
#          with the real njs geo handler (fail-open: no geo-block.json) and the
#          shared snippets. SEO_RENDER_ON is a start_prod_nginx argument.
#   dev  — nginx.dev.conf as docker-compose.yaml mounts it; the stub doubles as
#          the Vite dev server (`dev:5173`) and the backend
#          (`host.docker.internal:5000`).
#
# Needs only docker. Containers, network and temp files are removed on exit.
# NGINX_IMAGE overrides the image (default: the Dockerfile's pinned serve stage).

HARNESS_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FE_USER_DIRECTORY="$(cd "$HARNESS_DIRECTORY/../.." && pwd)"
# The Dockerfile serve stage pins nginx:1.29-alpine.
NGINX_IMAGE="${NGINX_IMAGE:-nginx:1.29-alpine}"
STUB_IMAGE="${STUB_IMAGE:-python:3.12-alpine}"
RUN_ID="${RUN_ID_PREFIX:-vbwd-nginx-test}-$$"
NETWORK_NAME="$RUN_ID"
STUB_CONTAINER="$RUN_ID-stub"
WORK_DIRECTORY="$(mktemp -d)"
READY_ATTEMPTS=50
READY_POLL_SECONDS=0.2
HTML_ACCEPT='text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
HUMAN_USER_AGENT='Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0'
CRAWLER_USER_AGENT='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
SPA_SHELL_MARKER='<title>VBWD User Portal</title>'
THEMED_MARKER='THEMED PAGE'
DYNAMIC_RENDER_MARKER='DYNAMIC RENDER'
SITEMAP_MARKER='STUB SITEMAP'

failure_count=0

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1" >&2; failure_count=$((failure_count + 1)); }

cleanup() {
    docker ps -aq --filter "name=^$RUN_ID-" | xargs docker rm -f >/dev/null 2>&1
    docker network rm "$NETWORK_NAME" >/dev/null 2>&1
    rm -rf "$WORK_DIRECTORY"
}
trap cleanup EXIT

# Backend (:5000) + Vite dev server (:5173). /real and /pay/stripe* are themed
# pages; /missing*, /pay/missing* and /software/missing* are themed URLs whose
# resource is gone
# (404 + X-VBWD-Not-Found); every other unknown path is a plain "not mine" 404.
# The crawler render misses (404 → static fallback) for any path naming
# "render-miss". /sitemap-*.xml answers an XML sitemap (cms plugin stand-in).
write_fixtures() {
    mkdir -p "$WORK_DIRECTORY/html/seo" "$WORK_DIRECTORY/stub"
    printf '<!doctype html><html><head>%s</head><body><div id="app"></div></body></html>\n' \
        "$SPA_SHELL_MARKER" > "$WORK_DIRECTORY/html/index.html"
    cat > "$WORK_DIRECTORY/stub/stub_server.py" <<'PYTHON'
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BACKEND_PORT = 5000
VITE_PORT = 5173
SPA_SHELL = b'<!doctype html><html><head><title>VBWD User Portal</title></head></html>'
THEMED_PATHS = ("/real", "/pay/stripe")
SITEMAP_XML = b'<?xml version="1.0" encoding="UTF-8"?><urlset>STUB SITEMAP</urlset>'
NOT_FOUND_PREFIXES = ("/missing", "/pay/missing", "/software/missing")


class BackendHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path_only = self.path.split("?", 1)[0]
        if self.path.startswith("/api/v1/cms/_seo-render"):
            if "render-miss" in self.path:
                self.answer(404, b"render miss")
            else:
                self.answer(200, b"<html>DYNAMIC RENDER</html>")
        elif path_only.startswith("/sitemap-") and path_only.endswith(".xml"):
            self.answer(200, SITEMAP_XML, content_type="application/xml")
        elif path_only in THEMED_PATHS:
            self.answer(200, b"<html>THEMED PAGE</html>")
        elif path_only.startswith(NOT_FOUND_PREFIXES):
            self.answer(404, b"backend not found", {"X-VBWD-Not-Found": "1"})
        else:
            self.answer(404, b"not a themed route")

    def answer(self, status, body, extra_headers=None, content_type="text/html"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
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
    local snippet entrypoint_script
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

# start_prod_nginx <container name> <SEO_RENDER_ON: 1 | 0>
start_prod_nginx() {
    local container_name="$1" seo_render_on="$2"
    local mount_arguments=() mount_argument
    while IFS= read -r mount_argument; do mount_arguments+=("$mount_argument"); done < <(shared_mounts)
    docker run -d --name "$container_name" --network "$NETWORK_NAME" -p 127.0.0.1::80 \
        -e API_UPSTREAM=stub-backend:5000 -e PLUGIN_API_UPSTREAM=stub-backend:5000 \
        -e SEO_RENDER_ON="$seo_render_on" -e SEO_RENDER_TOKEN=test-token -e CANONICAL_HOST= \
        -v "$FE_USER_DIRECTORY/nginx.prod.conf.template:/etc/nginx/templates/default.conf.template:ro" \
        -v "$WORK_DIRECTORY/html:/usr/share/nginx/html:ro" \
        "${mount_arguments[@]}" "$NGINX_IMAGE" >/dev/null
}

# start_dev_nginx <container name>
start_dev_nginx() {
    local container_name="$1"
    local mount_arguments=() mount_argument
    while IFS= read -r mount_argument; do mount_arguments+=("$mount_argument"); done < <(shared_mounts)
    docker run -d --name "$container_name" --network "$NETWORK_NAME" -p 127.0.0.1::80 \
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

# fetch <base url> <path> <user agent> — an HTML navigation; headers and body
# land in $WORK_DIRECTORY/{headers,body}, the status code is printed.
fetch() {
    curl -s -D "$WORK_DIRECTORY/headers" -o "$WORK_DIRECTORY/body" -w '%{http_code}' \
        -H "Accept: $HTML_ACCEPT" -A "$3" "$1$2"
}

# expect_response <label> <base url> <path> <user agent> <status> <body marker> [header]
expect_response() {
    local label="$1" base_url="$2" path="$3" user_agent="$4"
    local expected_status="$5" body_marker="$6" expected_header="${7:-}"
    local actual_status
    actual_status="$(fetch "$base_url" "$path" "$user_agent")"
    if [ "$actual_status" != "$expected_status" ]; then
        fail "$label: $path → $actual_status (expected $expected_status)"
    elif [ -n "$body_marker" ] && ! grep -qF -- "$body_marker" "$WORK_DIRECTORY/body"; then
        fail "$label: $path body lacks '$body_marker': $(head -c 200 "$WORK_DIRECTORY/body")"
    elif [ -n "$expected_header" ] && ! grep -qiF -- "$expected_header" "$WORK_DIRECTORY/headers"; then
        fail "$label: $path lacks header '$expected_header'"
    else
        pass "$label: $path → $expected_status ${body_marker:+($body_marker)}"
    fi
}

# expect_sitemap_proxied <label> <base url> <path> — a crawler's sitemap fetch
# (Accept: application/xml) reaches the backend: 200, application/xml, the stub
# sitemap body — never the SPA shell.
expect_sitemap_proxied() {
    local label="$1" base_url="$2" path="$3" actual_status
    actual_status="$(curl -s -D "$WORK_DIRECTORY/headers" -o "$WORK_DIRECTORY/body" -w '%{http_code}' \
        -H "Accept: application/xml" -A "$CRAWLER_USER_AGENT" "$base_url$path")"
    if [ "$actual_status" != 200 ]; then
        fail "$label: $path → $actual_status (expected 200)"
    elif ! grep -qi '^content-type: application/xml' "$WORK_DIRECTORY/headers"; then
        fail "$label: $path is not application/xml: $(grep -i '^content-type:' "$WORK_DIRECTORY/headers")"
    elif ! grep -qF -- "$SITEMAP_MARKER" "$WORK_DIRECTORY/body"; then
        fail "$label: $path body is not the backend sitemap: $(head -c 200 "$WORK_DIRECTORY/body")"
    else
        pass "$label: $path → 200 application/xml ($SITEMAP_MARKER)"
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
