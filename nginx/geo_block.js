/*
 * S120.1 — nginx-layer geo-block handler (njs).
 *
 * Runs as a `js_content` handler on the fe-user `location /`. Its single job is
 * to decide, per request, whether the visitor may see the CMS site:
 *   - "pass"  → `r.internalRedirect('@spa')`, handing off to the unchanged SPA /
 *               prerender serving chain (byte-identical to pre-S120.1);
 *   - "block" → `302 → blocked_target_slug` (or `451` when the slug is empty);
 *   - "grant" → mint a signed bypass cookie and `302` to the clean URL.
 *
 * Config is the frozen JSON contract the cms backend writes to
 * `/etc/nginx/geo/geo-block.json` (bind-mounted read-only), re-read live with a
 * short in-process TTL cache — no nginx reload is ever needed. The bypass cookie
 * is HMAC-signed with the config's `bypass_secret` (njs `crypto`), mirroring the
 * S120 `GeoBypassTokenSigner` token shape `<expBase64url>.<hmacHex>`.
 *
 * Safety invariant (CRITICAL): a missing / unparseable config, or a disabled
 * feature, is fail-open — the request passes exactly as today. A bad config or a
 * missing GeoIP DB must NEVER lock the site.
 */

import fs from 'fs'
import crypto from 'crypto'

const CONFIG_PATH = '/etc/nginx/geo/geo-block.json'
const CONFIG_CACHE_TTL_MS = 5000
const BYPASS_COOKIE_NAME = 'vbwd_geo_bypass'
const SECONDS_PER_DAY = 86400
const SPA_LOCATION = '@spa'
const NO_STORE = 'private, no-store'
const REDIRECT_FOUND = 302
const HTTP_UNAVAILABLE_FOR_LEGAL_REASONS = 451
const DEFAULT_TTL_DAYS = 30

// Static assets (by extension) are never geo-gated: they carry no readable
// content and blocking them would break the locked page itself.
const STATIC_ASSET_PATTERN =
  /\.(?:css|js|mjs|cjs|map|json|webmanifest|wasm|png|jpe?g|gif|svg|webp|avif|ico|bmp|woff2?|ttf|eot|otf|mp4|webm|ogg|mp3|wav|pdf|txt|xml)$/i

// Injectable seams so the handler is unit-testable off-nginx. In production njs
// these resolve to the real file read, wall clock, and process env; tests swap
// them via `__setRuntimeForTest`.
function defaultReadConfigRaw() {
  return fs.readFileSync(CONFIG_PATH, 'utf8')
}

function defaultNowMs() {
  return Date.now()
}

function defaultDevTestEnabled() {
  // `env GEO_TEST_ALLOW;` in the main nginx.conf exposes this to njs. Unset in
  // prod ⇒ the test-override header is inert.
  return typeof process !== 'undefined' && process.env && process.env.GEO_TEST_ALLOW === '1'
}

const runtime = {
  readConfigRaw: defaultReadConfigRaw,
  nowMs: defaultNowMs,
  devTestEnabled: defaultDevTestEnabled,
}

let configCache = { atMs: 0, value: null, primed: false }

function resetConfigCache() {
  configCache = { atMs: 0, value: null, primed: false }
}

/** TEST ONLY — override the injectable runtime seams and clear the cache. */
function __setRuntimeForTest(overrides) {
  if (overrides.readConfigRaw) runtime.readConfigRaw = overrides.readConfigRaw
  if (overrides.nowMs) runtime.nowMs = overrides.nowMs
  if (overrides.devTestEnabled) runtime.devTestEnabled = overrides.devTestEnabled
  resetConfigCache()
}

/** TEST ONLY — restore the production seams. */
function __resetRuntimeForTest() {
  runtime.readConfigRaw = defaultReadConfigRaw
  runtime.nowMs = defaultNowMs
  runtime.devTestEnabled = defaultDevTestEnabled
  resetConfigCache()
}

function base64UrlEncode(text) {
  return Buffer.from(text)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64UrlDecode(encoded) {
  try {
    const standard = encoded.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(standard, 'base64').toString()
  } catch (error) {
    return null
  }
}

function hmacHex(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex')
}

/** Constant-time comparison of two equal-purpose hex strings. */
function constantTimeEquals(left, right) {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

/**
 * Mint a bypass token `<base64url(expSeconds)>.<hmacHex(secret, expSeconds)>`.
 * The HMAC signs the decimal exp string (matching S120's signer).
 */
function mintBypassToken(secret, expSeconds) {
  const expString = String(expSeconds)
  return base64UrlEncode(expString) + '.' + hmacHex(secret, expString)
}

/** Verify a bypass token: HMAC must match and the expiry must be in the future. */
function verifyBypassToken(secret, token, nowSeconds) {
  if (!token) return false
  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1) return false
  const expEncoded = token.substring(0, dot)
  const signature = token.substring(dot + 1)
  const expString = base64UrlDecode(expEncoded)
  if (expString === null || expString === '') return false
  const expSeconds = Number(expString)
  if (!isFinite(expSeconds)) return false
  const expected = hmacHex(secret, expString)
  if (!constantTimeEquals(expected, signature)) return false
  return expSeconds > nowSeconds
}

/** Read + parse the config with a short TTL cache. Any error ⇒ null (fail-open). */
function readConfig(nowMs) {
  if (configCache.primed && nowMs - configCache.atMs < CONFIG_CACHE_TTL_MS) {
    return configCache.value
  }
  let parsed = null
  try {
    parsed = JSON.parse(runtime.readConfigRaw())
  } catch (error) {
    parsed = null
  }
  configCache = { atMs: nowMs, value: parsed, primed: true }
  return parsed
}

function getCookie(request, name) {
  const header = request.headersIn.Cookie || request.headersIn.cookie
  if (!header) return null
  const parts = header.split(';')
  for (let index = 0; index < parts.length; index += 1) {
    const pair = parts[index].trim()
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    if (pair.substring(0, eq) === name) return pair.substring(eq + 1)
  }
  return null
}

function isStaticAsset(uri) {
  return STATIC_ASSET_PATTERN.test(uri)
}

/** The locked page and everything under it must never be blocked (loop guard). */
function isLockedSlug(uri, slug) {
  if (!slug) return false
  return uri === slug || uri.substring(0, slug.length + 1) === slug + '/'
}

function bypassKeyValue(bypassQuery) {
  const eq = bypassQuery.indexOf('=')
  if (eq < 0) return null
  return { key: bypassQuery.substring(0, eq), value: bypassQuery.substring(eq + 1) }
}

function matchesBypassQuery(request, bypassQuery) {
  const pair = bypassKeyValue(bypassQuery)
  if (!pair) return false
  return request.args[pair.key] === pair.value
}

/** Rebuild the request URL with the bypass param removed, other params kept. */
function cleanUrl(request, bypassQuery) {
  const pair = bypassKeyValue(bypassQuery)
  const dropKey = pair ? pair.key : bypassQuery
  const kept = []
  for (const key in request.args) {
    if (key === dropKey) continue
    kept.push(key + '=' + request.args[key])
  }
  return request.uri + (kept.length ? '?' + kept.join('&') : '')
}

function resolveCountry(request) {
  if (runtime.devTestEnabled()) {
    const forced = request.headersIn['X-VBWD-Geo-Test'] || request.headersIn['x-vbwd-geo-test']
    if (forced) return String(forced).toUpperCase()
  }
  const code = request.variables.geoip2_country_code
  return code ? String(code).toUpperCase() : ''
}

function pass(request) {
  request.internalRedirect(SPA_LOCATION)
}

function block(request, config) {
  request.headersOut['Cache-Control'] = NO_STORE
  const slug = config.blocked_target_slug || ''
  if (!slug) {
    request.return(HTTP_UNAVAILABLE_FOR_LEGAL_REASONS)
    return
  }
  // njs sets the redirect Location from r.return's second argument (assigning
  // headersOut.Location on a js_content handler is not honoured).
  request.return(REDIRECT_FOUND, slug)
}

function grantBypass(request, config) {
  const ttlDays = config.bypass_cookie_ttl_days > 0 ? config.bypass_cookie_ttl_days : DEFAULT_TTL_DAYS
  const maxAgeSeconds = ttlDays * SECONDS_PER_DAY
  const expSeconds = Math.floor(runtime.nowMs() / 1000) + maxAgeSeconds
  const token = mintBypassToken(config.bypass_secret || '', expSeconds)
  request.headersOut['Set-Cookie'] =
    BYPASS_COOKIE_NAME +
    '=' +
    token +
    '; Max-Age=' +
    maxAgeSeconds +
    '; Path=/; Secure; HttpOnly; SameSite=Lax'
  request.headersOut['Cache-Control'] = NO_STORE
  // Set-Cookie / Cache-Control ride headersOut; the Location comes from r.return.
  request.return(REDIRECT_FOUND, cleanUrl(request, config.bypass_query))
}

/**
 * njs `js_content` entry point. Decides pass / block / grant for the request.
 * Order mirrors the S120 middleware: OFF → passthrough → bypass GET → bypass
 * cookie → country gate.
 */
function handle(request) {
  const nowMs = runtime.nowMs()
  const config = readConfig(nowMs)

  // Fail-open: no config, unparseable, or disabled ⇒ serve exactly as today.
  if (!config || config.enabled !== true) {
    pass(request)
    return
  }

  const uri = request.uri
  const slug = config.blocked_target_slug || ''

  // Passthrough: static assets and the locked page + sub-paths (loop guard).
  if (isStaticAsset(uri) || isLockedSlug(uri, slug)) {
    pass(request)
    return
  }

  // Bypass by GET param → mint the signed cookie and redirect to the clean URL.
  const bypassQuery = config.bypass_query || ''
  if (request.method === 'GET' && bypassQuery && matchesBypassQuery(request, bypassQuery)) {
    grantBypass(request, config)
    return
  }

  // Bypass by a still-valid signed cookie.
  const cookieToken = getCookie(request, BYPASS_COOKIE_NAME)
  if (cookieToken && verifyBypassToken(config.bypass_secret || '', cookieToken, Math.floor(nowMs / 1000))) {
    pass(request)
    return
  }

  // Country gate.
  const country = resolveCountry(request)
  const allowed = config.allowed_codes || []
  if (country && allowed.indexOf(country) >= 0) {
    pass(request)
    return
  }
  if (!country) {
    if (config.block_unknown_country === true) {
      block(request, config)
      return
    }
    pass(request)
    return
  }

  block(request, config)
}

// njs only supports the `export default { ... }` form (its module parser rejects
// the `export { a, b }` re-export list). njs uses `geo.handle`; the remaining
// members are the unit-test surface (mint/verify + the runtime seams).
export default {
  handle,
  mintBypassToken,
  verifyBypassToken,
  __setRuntimeForTest,
  __resetRuntimeForTest,
}
