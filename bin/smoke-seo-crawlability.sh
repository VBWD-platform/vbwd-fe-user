#!/usr/bin/env bash
# S150 Phase 4 — cold-install smoke: CMS content is crawlable by every robot/agent.
#
# Run against a running fe-user stack (dev-install-ce.sh or vbwd-platform):
#   bin/smoke-seo-crawlability.sh                       # BASE=http://localhost:8080
#   BASE=http://localhost:8080 NGINX_CONTAINER=vbwd-platform-fe-user-nginx-1 bin/smoke-seo-crawlability.sh
#   NGINX_CONTAINER= bin/smoke-seo-crawlability.sh      # skip the in-container `nginx -t`
#   SMOKE_PAGE_PATH=/about bin/smoke-seo-crawlability.sh  # page fetched as an AI agent
#
# Checks (each prints PASS/FAIL; exits non-zero on any FAIL):
#   1. /robots.txt carries the S150 default policy lines (whole-line match) and a
#      Sitemap line on BASE (port kept) — no bare /api, /admin, /dashboard prefixes.
#   2. /sitemap.xml is served as XML.
#   3. Every sitemap <loc> is allowed by robots.txt under RFC 9309 longest-match.
#   4. A seeded CMS page fetched as ChatGPT-User returns rendered content, not an
#      empty SPA shell.
#   5. `nginx -t` inside the fe-user nginx container.
set -uo pipefail

BASE="${BASE:-http://localhost:8080}"
BASE="${BASE%/}"
NGINX_CONTAINER="${NGINX_CONTAINER-vbwd-fe-user-nginx-1}"
SMOKE_PAGE_PATH="${SMOKE_PAGE_PATH:-}"
AI_AGENT_USER_AGENT='Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot'
# A rendered CMS page carries far more visible text than the SPA shell's <title>.
MIN_VISIBLE_TEXT_CHARS=200

failure_count=0

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; failure_count=$((failure_count + 1)); }

robots_body="$(curl -fsS "$BASE/robots.txt")" || { fail "GET $BASE/robots.txt"; robots_body=""; }

expect_robots_line() {
    if printf '%s\n' "$robots_body" | grep -qxF -- "$1"; then
        pass "robots.txt has line: $1"
    else
        fail "robots.txt missing line: $1"
    fi
}

reject_robots_line() {
    if printf '%s\n' "$robots_body" | grep -qxF -- "$1"; then
        fail "robots.txt still has line: $1"
    else
        pass "robots.txt has no line: $1"
    fi
}

for required_line in 'User-agent: *' 'Allow: /' 'Allow: /api/v1/cms/' 'Disallow: /api/' \
    'Disallow: /admin/' 'Disallow: /dashboard$' 'Disallow: /dashboard/' "Sitemap: $BASE/sitemap.xml"; do
    expect_robots_line "$required_line"
done
for forbidden_line in 'Disallow: /api' 'Disallow: /admin' 'Disallow: /dashboard' 'Disallow: /'; do
    reject_robots_line "$forbidden_line"
done

sitemap_content_type="$(curl -fsS -o /dev/null -w '%{content_type}' "$BASE/sitemap.xml")"
if printf '%s' "$sitemap_content_type" | grep -qi xml; then
    pass "sitemap.xml content-type is XML ($sitemap_content_type)"
else
    fail "sitemap.xml content-type is not XML (${sitemap_content_type:-no response})"
fi

# Collect every page path from the sitemap (following a sitemap index), then
# evaluate each against robots.txt with the RFC 9309 longest-match rule
# (longest matching pattern wins, Allow wins a tie, `*` wildcard, `$` anchor).
sitemap_report="$(ROBOTS_BODY="$robots_body" BASE="$BASE" python3 - <<'PYTHON'
import os
import re
import sys
import urllib.parse
import urllib.request

base = os.environ["BASE"]
robots_body = os.environ["ROBOTS_BODY"]


def fetch(url):
    with urllib.request.urlopen(url, timeout=20) as response:
        return response.read().decode("utf-8", "replace")


def path_of(location):
    parsed = urllib.parse.urlparse(location)
    return (parsed.path or "/") + (("?" + parsed.query) if parsed.query else "")


def sitemap_page_paths(url, seen):
    if url in seen:
        return []
    seen.add(url)
    document = fetch(url)
    locations = re.findall(r"<loc>\s*(.*?)\s*</loc>", document, re.S)
    if "<sitemapindex" in document:
        paths = []
        for location in locations:
            paths += sitemap_page_paths(urllib.parse.urljoin(base + "/", location), seen)
        return paths
    return [path_of(location) for location in locations]


def wildcard_group_rules(body):
    rules, in_wildcard_group, previous_was_agent = [], False, False
    for raw_line in body.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        field, value = (part.strip() for part in line.split(":", 1))
        field = field.lower()
        if field == "user-agent":
            in_wildcard_group = (in_wildcard_group and previous_was_agent) or value == "*"
            previous_was_agent = True
            continue
        previous_was_agent = False
        if in_wildcard_group and field in ("allow", "disallow") and value:
            rules.append((field == "allow", value))
    return rules


def pattern_matches(pattern, path):
    anchored = pattern.endswith("$")
    body = pattern[:-1] if anchored else pattern
    expression = ".*".join(re.escape(piece) for piece in body.split("*"))
    return re.match(expression + ("$" if anchored else ""), path) is not None


def is_allowed(rules, path):
    best_length, best_allow = -1, True
    for allow, pattern in rules:
        if pattern_matches(pattern, path):
            length = len(pattern)
            if length > best_length or (length == best_length and allow):
                best_length, best_allow = length, allow
    return best_allow


try:
    page_paths = sitemap_page_paths(base + "/sitemap.xml", set())
except (OSError, ValueError) as error:  # URLError is an OSError
    print(f"ERROR could not read sitemap: {error}")
    sys.exit(1)
rules = wildcard_group_rules(robots_body)
blocked = [path for path in page_paths if not is_allowed(rules, path)]
first_page = next((path for path in page_paths if path != "/"), "")
print(f"FIRST_PAGE {first_page}")
print(f"COUNT {len(page_paths)}")
for path in blocked:
    print(f"BLOCKED {path}")
sys.exit(1 if blocked or not page_paths else 0)
PYTHON
)"
sitemap_status=$?
sitemap_url_count="$(printf '%s\n' "$sitemap_report" | sed -n 's/^COUNT //p')"
if [ "$sitemap_status" -eq 0 ]; then
    pass "all ${sitemap_url_count} sitemap URLs allowed by robots.txt (longest-match)"
else
    fail "sitemap URLs not all allowed by robots.txt (of ${sitemap_url_count:-0}):"
    printf '%s\n' "$sitemap_report" | grep -E '^(BLOCKED|ERROR)' | sed 's/^/      /'
fi

if [ -z "$SMOKE_PAGE_PATH" ]; then
    SMOKE_PAGE_PATH="$(printf '%s\n' "$sitemap_report" | sed -n 's/^FIRST_PAGE //p')"
fi
if [ -z "$SMOKE_PAGE_PATH" ]; then
    fail "no CMS page path to fetch as an AI agent (empty sitemap; set SMOKE_PAGE_PATH)"
else
    visible_text_chars="$(curl -fsS -A "$AI_AGENT_USER_AGENT" "$BASE$SMOKE_PAGE_PATH" | python3 -c '
import html
import re
import sys

document = sys.stdin.read()
without_code = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", document, flags=re.S | re.I)
visible_text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", without_code))).strip()
print(len(visible_text))
')"
    if [ "${visible_text_chars:-0}" -ge "$MIN_VISIBLE_TEXT_CHARS" ]; then
        pass "$SMOKE_PAGE_PATH as ChatGPT-User renders content (${visible_text_chars} visible chars)"
    else
        fail "$SMOKE_PAGE_PATH as ChatGPT-User is an empty shell (${visible_text_chars:-0} visible chars < ${MIN_VISIBLE_TEXT_CHARS})"
    fi
fi

if [ -z "$NGINX_CONTAINER" ]; then
    echo "SKIP  nginx -t (NGINX_CONTAINER empty)"
elif docker exec "$NGINX_CONTAINER" nginx -t >/dev/null 2>&1; then
    pass "nginx -t in $NGINX_CONTAINER"
else
    fail "nginx -t in $NGINX_CONTAINER"
fi

if [ "$failure_count" -gt 0 ]; then
    echo "SEO crawlability smoke: ${failure_count} check(s) FAILED"
    exit 1
fi
echo "SEO crawlability smoke: all checks passed"
