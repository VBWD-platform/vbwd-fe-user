#!/usr/bin/env bash
# S152-11 — local frontend-mode switch check (R3: "the switch is tested").
#
# Flips VBWD_FRONTEND_MODE in vbwd-backend/.env to `theme`, recreates the api
# container, waits for health and asserts the e2e sentinel; then the same for
# `vue`. The original .env is restored on exit (any exit, via trap) and api is
# recreated once more, so the stack ends in the mode it started in.
#
# This CHANGES the running local stack while it runs. Run it only on purpose:
#   bin/e2e-frontend-mode-switch.sh
#   BACKEND_DIR=../vbwd-backend FE_BASE_URL=http://localhost:8080 bin/e2e-frontend-mode-switch.sh
#
# Theme mode needs the theme plugins enabled in the backend (theme, theme_cms, …);
# the script does not enable plugins — a disabled theme plugin makes the theme
# sentinel fail (core cannot detect it, D10; this check does).
#
# Exits non-zero when a sentinel does not match its mode.
set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$SCRIPT_DIRECTORY/../../vbwd-backend}"
FE_BASE_URL="${FE_BASE_URL:-http://localhost:8080}"
FE_BASE_URL="${FE_BASE_URL%/}"
API_HEALTH_URL="${API_HEALTH_URL:-http://localhost:5000/api/v1/health}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-60}"
HEALTH_INTERVAL_SECONDS=2
MODE_PROBE_PATH="/_render/_theme/mode"
MODE_VARIABLE="VBWD_FRONTEND_MODE"

ENV_FILE="$BACKEND_DIR/.env"
ENV_BACKUP="$BACKEND_DIR/.env.s152-mode-switch.bak"
env_file_existed=0

recreate_api() {
    (cd "$BACKEND_DIR" && docker compose up -d api)
}

wait_for_api_health() {
    local attempt
    for attempt in $(seq 1 "$HEALTH_ATTEMPTS"); do
        if curl -sf "$API_HEALTH_URL" >/dev/null 2>&1; then
            return 0
        fi
        sleep "$HEALTH_INTERVAL_SECONDS"
    done
    echo "FAIL  api not healthy at $API_HEALTH_URL after $HEALTH_ATTEMPTS attempts" >&2
    (cd "$BACKEND_DIR" && docker compose logs --tail 40 api) >&2 || true
    return 1
}

restore_environment() {
    local exit_status=$?
    if [ "$env_file_existed" = 1 ]; then
        mv "$ENV_BACKUP" "$ENV_FILE"
    else
        rm -f "$ENV_FILE"
    fi
    echo "Restored $ENV_FILE; recreating api in its original mode…"
    recreate_api && wait_for_api_health || exit_status=1
    exit "$exit_status"
}

write_mode() {
    local mode="$1"
    local without_mode
    without_mode="$(grep -v "^${MODE_VARIABLE}=" "$ENV_FILE" || true)"
    printf '%s\n%s=%s\n' "$without_mode" "$MODE_VARIABLE" "$mode" >"$ENV_FILE"
}

assert_sentinel() {
    local mode="$1"
    local probe_body probe_status
    probe_body="$(curl -s -w '\n%{http_code}' "$FE_BASE_URL$MODE_PROBE_PATH")"
    probe_status="${probe_body##*$'\n'}"
    probe_body="${probe_body%$'\n'*}"
    if [ "$mode" = "theme" ]; then
        if [ "$probe_status" = "200" ] && [[ "$probe_body" == *'"mode"'*'"theme"'* ]]; then
            echo "PASS  theme mode: $MODE_PROBE_PATH → 200 $probe_body"
            return 0
        fi
        echo "FAIL  theme mode: $MODE_PROBE_PATH → $probe_status $probe_body (theme plugin enabled?)" >&2
        return 1
    fi
    if [ "$probe_status" = "404" ]; then
        echo "PASS  vue mode: $MODE_PROBE_PATH → 404"
        return 0
    fi
    echo "FAIL  vue mode: $MODE_PROBE_PATH → $probe_status (expected 404)" >&2
    return 1
}

switch_and_assert() {
    local mode="$1"
    echo "── $MODE_VARIABLE=$mode"
    write_mode "$mode"
    recreate_api
    wait_for_api_health
    assert_sentinel "$mode"
}

main() {
    if [ -f "$ENV_FILE" ]; then
        env_file_existed=1
        cp "$ENV_FILE" "$ENV_BACKUP"
    else
        touch "$ENV_FILE"
    fi
    trap restore_environment EXIT

    switch_and_assert theme
    switch_and_assert vue
}

main "$@"
