#!/bin/sh
# S120.1 — emit the geoip2 http-context block ONLY when the GeoLite2 DB is
# actually present at container start (after bind-mounts are applied).
#
# The geoip2 directive opens the .mmdb at config-parse time; a missing DB would
# make `nginx -t` fail and the container refuse to start. That would turn a
# missing GeoIP DB into a site-wide outage — the exact opposite of the S120.1
# fail-open safety invariant. So:
#   - DB present  → write the real geoip2 block (+ trusted client-IP map).
#   - DB absent   → define $geoip2_country_code as empty via a map, so nginx
#                   starts, the njs handler sees "unknown country", and (unless
#                   block_unknown_country is set) the site serves normally.
#
# Either way $geoip2_country_code is always defined, so the njs handler never
# hits an "unknown variable" error. This file lands in /etc/nginx/conf.d/ (inside
# the stock nginx.conf http{} include) BEFORE default.conf alphabetically.
set -eu

MMDB_PATH="/etc/nginx/geoip/GeoLite2-Country.mmdb"
OUT="/etc/nginx/conf.d/00-vbwd-geoip2.conf"

if [ -r "$MMDB_PATH" ]; then
    cat > "$OUT" <<'CONF'
# S120.1 geo resolution (generated at container start; DB present).
# Trusted client hop: first X-Forwarded-For entry, else the direct peer. Only our
# own proxy is in front, so the first XFF hop is the real client.
map $http_x_forwarded_for $vbwd_geo_client_ip {
    default        $remote_addr;
    "~^(?<xff_first>[^,]+)" $xff_first;
}
geoip2 /etc/nginx/geoip/GeoLite2-Country.mmdb {
    $geoip2_country_code source=$vbwd_geo_client_ip country iso_code;
}
CONF
    echo "[vbwd-geoip2] GeoLite2 DB found — geo resolution ENABLED"
else
    cat > "$OUT" <<'CONF'
# S120.1 geo resolution (generated at container start; DB ABSENT → fail-open).
# $geoip2_country_code is defined empty so the njs handler treats every visitor
# as "unknown country" and (unless block_unknown_country) serves normally.
map $host $geoip2_country_code {
    default "";
}
CONF
    echo "[vbwd-geoip2] GeoLite2 DB missing — geo resolution DISABLED (fail-open)"
fi
