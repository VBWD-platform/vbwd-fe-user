/**
 * S120.1 — unit tests for the njs geo-block handler (`nginx/geo_block.js`).
 *
 * The handler runs inside nginx (njs) as a `js_content` handler on `location /`.
 * njs cannot be run on this box, so we exercise the pure handler logic against a
 * hand-built mock of the njs `r` request object (headers, args, variables,
 * cookies, and the terminal actions `return` / `internalRedirect`). The mock
 * mirrors the njs API the handler actually touches — nothing more.
 *
 * The handler reads its config from `/etc/nginx/geo/geo-block.json`; that read
 * (and the wall clock + the dev-flag) is injected through `__setRuntimeForTest`
 * so every branch of the matrix is deterministic and offline:
 *   allowed→pass · blocked→302 slug · blocked+empty-slug→451 · unknown→pass or
 *   block per flag · bypass GET→Set-Cookie+302-strip · valid cookie→pass ·
 *   tampered/expired cookie→ignored · passthrough assets + locked slug ·
 *   OFF→pass · missing/unparseable JSON→pass (fail-open) · dev override header.
 */
import { afterEach, describe, expect, it } from 'vitest'
// The handler is authored as an njs ES module (geo_block.js); its type surface is
// declared in the colocated geo_block.d.ts. njs only supports a single
// `export default { ... }`, so every member hangs off the default export.
import geoModule from '../../../nginx/geo_block.js'
import type { GeoBlockRequest } from '../../../nginx/geo_block.js'

const { handle, mintBypassToken, verifyBypassToken, __setRuntimeForTest, __resetRuntimeForTest } =
  geoModule

const SECRET = 'a1b2c3d4e5f6'
const NOW_MS = 1_700_000_000_000
const NOW_SECONDS = Math.floor(NOW_MS / 1000)

interface MockResult {
  status: number | null
  // njs sets a redirect Location via r.return's 2nd argument.
  location: string | null
  internalRedirect: string | null
  headersOut: Record<string, string>
}

function makeRequest(opts: {
  method?: string
  uri?: string
  args?: Record<string, string>
  headers?: Record<string, string>
  cookie?: string
  country?: string
}) {
  const headersIn: Record<string, string> = { ...(opts.headers || {}) }
  if (opts.cookie) headersIn.Cookie = opts.cookie
  const result: MockResult = { status: null, location: null, internalRedirect: null, headersOut: {} }
  const r: GeoBlockRequest = {
    method: opts.method || 'GET',
    uri: opts.uri || '/',
    args: opts.args || {},
    headersIn,
    headersOut: result.headersOut,
    variables: { geoip2_country_code: opts.country || '' },
    return(code: number, location?: string) {
      result.status = code
      if (location !== undefined) result.location = location
    },
    internalRedirect(name: string) {
      result.internalRedirect = name
    },
    log() {
      /* njs r.log — inert in tests */
    },
    warn() {
      /* njs r.warn — inert in tests */
    },
    error() {
      /* njs r.error — inert in tests */
    },
  }
  return { r, result }
}

/** Serialise a config object exactly like the backend writer does. */
function useConfig(config: object | 'MISSING' | 'GARBAGE', devTest = false) {
  __setRuntimeForTest({
    nowMs: () => NOW_MS,
    devTestEnabled: () => devTest,
    readConfigRaw: () => {
      if (config === 'MISSING') throw new Error('ENOENT: no such file')
      if (config === 'GARBAGE') return '{ this is not json'
      return JSON.stringify(config)
    },
  })
}

const baseConfig = {
  enabled: true,
  allowed_codes: ['DE', 'AT'],
  bypass_query: 'allowme=yes',
  bypass_cookie_ttl_days: 30,
  blocked_target_slug: '/locked',
  block_unknown_country: false,
  bypass_secret: SECRET,
}

afterEach(() => {
  __resetRuntimeForTest()
})

describe('bypass token mint/verify', () => {
  it('mints a "<expB64url>.<hmacHex>" token that verifies with the same secret', () => {
    const exp = NOW_SECONDS + 3600
    const token = mintBypassToken(SECRET, exp)
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/)
    expect(verifyBypassToken(SECRET, token, NOW_SECONDS)).toBe(true)
  })

  it('rejects a token signed with a different secret', () => {
    const token = mintBypassToken(SECRET, NOW_SECONDS + 3600)
    expect(verifyBypassToken('other-secret', token, NOW_SECONDS)).toBe(false)
  })

  it('rejects a tampered token', () => {
    const token = mintBypassToken(SECRET, NOW_SECONDS + 3600)
    const tampered = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a')
    expect(verifyBypassToken(SECRET, tampered, NOW_SECONDS)).toBe(false)
  })

  it('rejects an expired token', () => {
    const token = mintBypassToken(SECRET, NOW_SECONDS - 10)
    expect(verifyBypassToken(SECRET, token, NOW_SECONDS)).toBe(false)
  })

  it('rejects empty / malformed input', () => {
    expect(verifyBypassToken(SECRET, '', NOW_SECONDS)).toBe(false)
    expect(verifyBypassToken(SECRET, 'no-dot-here', NOW_SECONDS)).toBe(false)
  })
})

describe('fail-open safety invariant', () => {
  it('passes when the feature is disabled, even from a blocked country', () => {
    useConfig({ ...baseConfig, enabled: false })
    const { r, result } = makeRequest({ uri: '/', country: 'FR' })
    handle(r)
    expect(result.internalRedirect).toBe('@spa')
    expect(result.status).toBeNull()
  })

  it('passes when the config JSON is missing (fail-open)', () => {
    useConfig('MISSING')
    const { r, result } = makeRequest({ uri: '/', country: 'FR' })
    handle(r)
    expect(result.internalRedirect).toBe('@spa')
  })

  it('passes when the config JSON is unparseable (fail-open)', () => {
    useConfig('GARBAGE')
    const { r, result } = makeRequest({ uri: '/', country: 'FR' })
    handle(r)
    expect(result.internalRedirect).toBe('@spa')
  })
})

describe('country gate', () => {
  it('passes an allowed country', () => {
    useConfig(baseConfig)
    const { r, result } = makeRequest({ uri: '/', country: 'DE' })
    handle(r)
    expect(result.internalRedirect).toBe('@spa')
    expect(result.status).toBeNull()
  })

  it('redirects a blocked country to the slug with no-store', () => {
    useConfig(baseConfig)
    const { r, result } = makeRequest({ uri: '/', country: 'FR' })
    handle(r)
    expect(result.status).toBe(302)
    expect(result.location).toBe('/locked')
    expect(result.headersOut['Cache-Control']).toBe('private, no-store')
    expect(result.internalRedirect).toBeNull()
  })

  it('answers 451 for a blocked country when the slug is empty', () => {
    useConfig({ ...baseConfig, blocked_target_slug: '' })
    const { r, result } = makeRequest({ uri: '/', country: 'FR' })
    handle(r)
    expect(result.status).toBe(451)
    expect(result.headersOut['Cache-Control']).toBe('private, no-store')
  })

  it('passes an unknown country when block_unknown_country is false (fail-open)', () => {
    useConfig(baseConfig)
    const { r, result } = makeRequest({ uri: '/', country: '' })
    handle(r)
    expect(result.internalRedirect).toBe('@spa')
  })

  it('blocks an unknown country when block_unknown_country is true', () => {
    useConfig({ ...baseConfig, block_unknown_country: true })
    const { r, result } = makeRequest({ uri: '/', country: '' })
    handle(r)
    expect(result.status).toBe(302)
    expect(result.location).toBe('/locked')
  })
})

describe('passthrough (never blocked)', () => {
  it('passes static assets by extension even from a blocked country', () => {
    useConfig(baseConfig)
    for (const uri of ['/assets/index-abc123.js', '/img/logo.png', '/fonts/x.woff2', '/main.css']) {
      const { r, result } = makeRequest({ uri, country: 'FR' })
      handle(r)
      expect(result.internalRedirect, uri).toBe('@spa')
      expect(result.status, uri).toBeNull()
    }
  })

  it('passes the locked slug page and its sub-paths (loop guard)', () => {
    useConfig(baseConfig)
    for (const uri of ['/locked', '/locked/', '/locked/details']) {
      const { r, result } = makeRequest({ uri, country: 'FR' })
      handle(r)
      expect(result.internalRedirect, uri).toBe('@spa')
      expect(result.status, uri).toBeNull()
    }
  })

  it('does NOT treat a look-alike prefix as the locked slug', () => {
    useConfig(baseConfig)
    const { r, result } = makeRequest({ uri: '/locked-out', country: 'FR' })
    handle(r)
    expect(result.status).toBe(302)
  })
})

describe('bypass by GET param', () => {
  it('mints a signed cookie and 302s to the clean URL (bypass param stripped)', () => {
    useConfig(baseConfig)
    const { r, result } = makeRequest({
      uri: '/pricing',
      args: { allowme: 'yes', ref: 'partner' },
      country: 'FR',
    })
    handle(r)
    expect(result.status).toBe(302)
    // clean URL keeps other params, drops the bypass param
    expect(result.location).toBe('/pricing?ref=partner')
    expect(result.headersOut['Cache-Control']).toBe('private, no-store')
    const setCookie = result.headersOut['Set-Cookie']
    expect(setCookie).toContain('vbwd_geo_bypass=')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('Max-Age=' + 30 * 86400)
    // the minted token must verify
    const token = setCookie.split('vbwd_geo_bypass=')[1].split(';')[0]
    expect(verifyBypassToken(SECRET, token, NOW_SECONDS)).toBe(true)
  })

  it('drops the query entirely when the bypass param was the only one', () => {
    useConfig(baseConfig)
    const { r, result } = makeRequest({ uri: '/', args: { allowme: 'yes' }, country: 'FR' })
    handle(r)
    expect(result.location).toBe('/')
  })

  it('ignores the bypass param on a non-GET request', () => {
    useConfig(baseConfig)
    const { r, result } = makeRequest({
      method: 'POST',
      uri: '/',
      args: { allowme: 'yes' },
      country: 'FR',
    })
    handle(r)
    expect(result.headersOut['Set-Cookie']).toBeUndefined()
    expect(result.status).toBe(302)
    expect(result.location).toBe('/locked')
  })

  it('ignores a wrong bypass value', () => {
    useConfig(baseConfig)
    const { r, result } = makeRequest({ uri: '/', args: { allowme: 'no' }, country: 'FR' })
    handle(r)
    expect(result.headersOut['Set-Cookie']).toBeUndefined()
    expect(result.status).toBe(302)
  })
})

describe('bypass by cookie', () => {
  it('passes a valid bypass cookie from a blocked country', () => {
    useConfig(baseConfig)
    const token = mintBypassToken(SECRET, NOW_SECONDS + 3600)
    const { r, result } = makeRequest({
      uri: '/',
      country: 'FR',
      cookie: 'foo=bar; vbwd_geo_bypass=' + token + '; baz=qux',
    })
    handle(r)
    expect(result.internalRedirect).toBe('@spa')
    expect(result.status).toBeNull()
  })

  it('ignores a tampered cookie (still blocked)', () => {
    useConfig(baseConfig)
    const token = mintBypassToken(SECRET, NOW_SECONDS + 3600)
    const tampered = token.slice(0, -2) + 'ff'
    const { r, result } = makeRequest({
      uri: '/',
      country: 'FR',
      cookie: 'vbwd_geo_bypass=' + tampered,
    })
    handle(r)
    expect(result.status).toBe(302)
  })

  it('ignores an expired cookie (still blocked)', () => {
    useConfig(baseConfig)
    const token = mintBypassToken(SECRET, NOW_SECONDS - 10)
    const { r, result } = makeRequest({
      uri: '/',
      country: 'FR',
      cookie: 'vbwd_geo_bypass=' + token,
    })
    handle(r)
    expect(result.status).toBe(302)
  })
})

describe('dev override header', () => {
  it('honours X-VBWD-Geo-Test as the country only when the dev flag is set', () => {
    useConfig(baseConfig, /* devTest */ true)
    const { r, result } = makeRequest({
      uri: '/',
      country: '',
      headers: { 'X-VBWD-Geo-Test': 'FR' },
    })
    handle(r)
    expect(result.status).toBe(302)
    expect(result.location).toBe('/locked')
  })

  it('ignores X-VBWD-Geo-Test when the dev flag is unset (inert in prod)', () => {
    useConfig(baseConfig, /* devTest */ false)
    const { r, result } = makeRequest({
      uri: '/',
      country: '',
      headers: { 'X-VBWD-Geo-Test': 'FR' },
    })
    handle(r)
    // no real country + fail-open ⇒ pass
    expect(result.internalRedirect).toBe('@spa')
  })

  it('lets the dev override reach an allowed country', () => {
    useConfig(baseConfig, true)
    const { r, result } = makeRequest({
      uri: '/',
      country: '',
      headers: { 'X-VBWD-Geo-Test': 'DE' },
    })
    handle(r)
    expect(result.internalRedirect).toBe('@spa')
  })
})

describe('config TTL cache', () => {
  it('reads the config file at most once within the TTL window', () => {
    let reads = 0
    __setRuntimeForTest({
      nowMs: () => NOW_MS,
      devTestEnabled: () => false,
      readConfigRaw: () => {
        reads += 1
        return JSON.stringify(baseConfig)
      },
    })
    for (let i = 0; i < 3; i += 1) {
      const { r } = makeRequest({ uri: '/', country: 'DE' })
      handle(r)
    }
    expect(reads).toBe(1)
  })
})
