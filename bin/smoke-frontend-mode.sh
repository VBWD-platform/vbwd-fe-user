#!/usr/bin/env bash
# S152-11 — frontend-mode smoke on the local stack.
#
#   1. Both modes: bin/e2e-frontend-mode-switch.sh (flips vbwd-backend/.env,
#      recreates api, asserts the sentinel, restores the original mode).
#      SKIP_SWITCH=1 skips it (e.g. when only re-measuring).
#   2. `nginx -t` inside the fe-user nginx container (docker compose exec nginx).
#   3. vue mode: the D5 backend hop — the 404 every HTML navigation costs before
#      nginx falls back to the SPA — measured over 50 navigations with curl -w;
#      p50/p95 printed, and the run fails when p95 exceeds the 15 ms budget.
#
# This CHANGES the running local stack while step 1 runs. Run it only on purpose:
#   bin/smoke-frontend-mode.sh
#   SKIP_SWITCH=1 bin/smoke-frontend-mode.sh
set -uo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FE_USER_DIRECTORY="$SCRIPT_DIRECTORY/.."
FE_BASE_URL="${FE_BASE_URL:-http://localhost:8080}"
FE_BASE_URL="${FE_BASE_URL%/}"
BACKEND_ORIGIN="${BACKEND_ORIGIN:-http://localhost:5000}"
NAVIGATION_COUNT=50
HOP_P95_BUDGET_MILLISECONDS=15
MILLISECONDS_PER_SECOND=1000
# Public paths the SPA owns in vue mode; cycled through for the hop measurement.
NAVIGATION_PATHS=("/" "/login" "/shop" "/booking" "/checkout" "/about")

failure_count=0

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1" >&2; failure_count=$((failure_count + 1)); }

run_mode_switch() {
    if [ "${SKIP_SWITCH:-0}" = "1" ]; then
        echo "SKIP  mode switch (SKIP_SWITCH=1)"
        return
    fi
    if "$SCRIPT_DIRECTORY/e2e-frontend-mode-switch.sh"; then
        pass "mode switch: sentinel matched in theme and vue"
    else
        fail "mode switch: see the output above"
    fi
}

check_nginx_configuration() {
    if (cd "$FE_USER_DIRECTORY" && docker compose exec -T nginx nginx -t) 2>&1; then
        pass "nginx -t"
    else
        fail "nginx -t"
    fi
}

assert_vue_mode() {
    local probe_status
    probe_status="$(curl -s -o /dev/null -w '%{http_code}' "$FE_BASE_URL/_render/_theme/mode")"
    if [ "$probe_status" != "404" ]; then
        fail "hop measurement needs vue mode: /_render/_theme/mode → $probe_status (expected 404)"
        return 1
    fi
}

# Prints the percentile (1–100) of the sorted millisecond values on stdin.
percentile() {
    local wanted_percentile="$1"
    sort -n | awk -v wanted="$wanted_percentile" '
        { values[NR] = $1 }
        END {
            index_for_percentile = int((wanted / 100) * NR + 0.999999)
            if (index_for_percentile < 1) index_for_percentile = 1
            printf "%.2f", values[index_for_percentile]
        }'
}

measure_vue_mode_hop() {
    assert_vue_mode || return
    local samples_file navigation_index path
    samples_file="$(mktemp)"
    for navigation_index in $(seq 0 $((NAVIGATION_COUNT - 1))); do
        path="${NAVIGATION_PATHS[$((navigation_index % ${#NAVIGATION_PATHS[@]}))]}"
        # The request nginx's @frontend makes: the page path, render marker, HTML Accept.
        curl -s -o /dev/null -w '%{time_total}\n' \
            -H 'Accept: text/html,application/xhtml+xml' \
            -H 'X-VBWD-Render: 1' \
            "$BACKEND_ORIGIN$path" |
            awk -v factor="$MILLISECONDS_PER_SECOND" '{ printf "%.3f\n", $1 * factor }' >>"$samples_file"
    done
    local p50 p95
    p50="$(percentile 50 <"$samples_file")"
    p95="$(percentile 95 <"$samples_file")"
    rm -f "$samples_file"
    echo "INFO  vue-mode backend hop over $NAVIGATION_COUNT navigations: p50 ${p50} ms, p95 ${p95} ms"
    if awk -v measured="$p95" -v budget="$HOP_P95_BUDGET_MILLISECONDS" 'BEGIN { exit !(measured < budget) }'; then
        pass "vue-mode hop p95 ${p95} ms < ${HOP_P95_BUDGET_MILLISECONDS} ms"
    else
        fail "vue-mode hop p95 ${p95} ms >= ${HOP_P95_BUDGET_MILLISECONDS} ms"
    fi
}

run_mode_switch
check_nginx_configuration
measure_vue_mode_hop

if [ "$failure_count" -gt 0 ]; then
    echo "$failure_count check(s) failed" >&2
    exit 1
fi
echo "All frontend-mode smoke checks passed"
