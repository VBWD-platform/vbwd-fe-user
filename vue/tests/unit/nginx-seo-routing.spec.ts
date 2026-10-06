/**
 * S150 — CMS content is always crawlable: nginx routing oracle.
 *
 * Reads the served nginx confs as text (same approach as geo-block-njs.spec.ts)
 * and asserts the structure the SEO seam depends on:
 *
 *   Phase 2 — every served conf routes /robots.txt, /sitemap.xml,
 *             /sitemap-<n>.xml and the IndexNow key file to the backend, forwarding
 *             `Host $http_host` (keeps the port, defect D4) and X-Forwarded-Proto.
 *             The vbwd-platform conf mirrors the shared snippet (drift guard, D5).
 *   Phase 3 — ONE crawler user-agent regex (nginx/crawler-user-agents.conf) that
 *             detects classic crawlers AND AI fetchers, never a mainstream
 *             browser; every conf with a crawler map includes it (defect D6).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, basename } from 'path'

const REPO_ROOT = resolve(__dirname, '../../..')
const SNIPPET_DIR = resolve(REPO_ROOT, 'nginx')
const CRAWLER_SNIPPET_PATH = resolve(SNIPPET_DIR, 'crawler-user-agents.conf')
const SEO_SNIPPET_PATH = resolve(SNIPPET_DIR, 'seo-proxy-locations.conf')
const DEV_CONF_PATH = resolve(REPO_ROOT, 'nginx.dev.conf')
const PROD_CONF_PATH = resolve(REPO_ROOT, 'nginx.prod.conf.template')
const PLATFORM_CONF_PATH = resolve(REPO_ROOT, '../vbwd-platform/fe-user/nginx.conf')

const SEO_LOCATION_MATCHERS = [
  '= /robots.txt',
  '= /sitemap.xml',
  '~ ^/sitemap-\\d+\\.xml$',
  '~ "^/[A-Za-z0-9-]{8,128}\\.txt$"',
]

const readText = (filePath: string) => readFileSync(filePath, 'utf8')

/** Inline every `include .../<snippet>;` whose file ships in nginx/. */
function resolveSnippetIncludes(confText: string): string {
  return confText.replace(/^\s*include\s+(\S+);\s*$/gm, (includeLine, includePath: string) => {
    const snippetPath = resolve(SNIPPET_DIR, basename(includePath))
    return existsSync(snippetPath) ? readText(snippetPath) : includeLine
  })
}

/** The `{ ... }` body of `location <matcher>`, or null when absent. */
function locationBody(confText: string, matcher: string): string | null {
  const header = `location ${matcher} {`
  const start = confText.indexOf(header)
  if (start === -1) return null
  let depth = 0
  for (let index = start + header.length - 1; index < confText.length; index++) {
    if (confText[index] === '{') depth++
    if (confText[index] === '}') depth--
    if (depth === 0) return confText.slice(start + header.length, index)
  }
  return null
}

/** Directive lines only (comments and blank lines dropped, indentation ignored). */
function normalisedDirectives(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
}

const servedConfs: Array<{ name: string; path: string }> = [
  { name: 'nginx.dev.conf', path: DEV_CONF_PATH },
  { name: 'nginx.prod.conf.template', path: PROD_CONF_PATH },
  ...(existsSync(PLATFORM_CONF_PATH)
    ? [{ name: 'vbwd-platform/fe-user/nginx.conf', path: PLATFORM_CONF_PATH }]
    : []),
]

describe('S150 Phase 2 — SEO files reach the backend with the real host', () => {
  for (const conf of servedConfs) {
    describe(conf.name, () => {
      for (const matcher of SEO_LOCATION_MATCHERS) {
        it(`routes location ${matcher} to the backend`, () => {
          const body = locationBody(resolveSnippetIncludes(readText(conf.path)), matcher)
          expect(body, `missing location ${matcher}`).not.toBeNull()
          expect(body).toMatch(/proxy_pass\s+(\$backend|http:\/\/\$api_upstream);/)
        })

        it(`location ${matcher} forwards Host $http_host and X-Forwarded-Proto`, () => {
          const body = locationBody(resolveSnippetIncludes(readText(conf.path)), matcher) ?? ''
          expect(body).toMatch(/proxy_set_header\s+Host\s+\$http_host;/)
          expect(body).toMatch(/proxy_set_header\s+X-Forwarded-Proto\s+\S+;/)
        })
      }
    })
  }

  it('nginx.dev.conf uses the shared SEO snippet rather than an inline copy', () => {
    const devConf = readText(DEV_CONF_PATH)
    expect(devConf).toMatch(/include\s+\S*seo-proxy-locations\.conf;/)
    expect(devConf).not.toContain('location = /robots.txt')
  })

  it.skipIf(!existsSync(PLATFORM_CONF_PATH))(
    'vbwd-platform conf SEO block equals the shared snippet (drift guard)',
    () => {
      const snippetText = readText(SEO_SNIPPET_PATH)
      const platformText = readText(PLATFORM_CONF_PATH)
      for (const matcher of SEO_LOCATION_MATCHERS) {
        const expected = normalisedDirectives(locationBody(snippetText, matcher) ?? '')
        const actual = normalisedDirectives(locationBody(platformText, matcher) ?? '')
        expect(actual, `platform location ${matcher} drifted from the snippet`).toEqual(expected)
      }
    },
  )
})

function crawlerRegex(): RegExp {
  const snippetText = readText(CRAWLER_SNIPPET_PATH)
  const match = snippetText.match(/"~\*(.+)"\s+1;/)
  if (!match) throw new Error('crawler-user-agents.conf holds no "~*(...)" 1; regex line')
  return new RegExp(match[1], 'i')
}

const CRAWLER_USER_AGENTS = [
  // classic search / social crawlers
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
  'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Twitterbot/1.0',
  'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  // AI agents / fetchers
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)',
  'anthropic-ai',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
  'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
  'meta-externalfetcher/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
  'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.104 Safari/537.36 (Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)',
  'cohere-ai',
  'Mozilla/5.0 (compatible; GoogleOther)',
  'Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)',
  'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)',
  'CCBot/2.0 (https://commoncrawl.org/faq/)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-User/1.0; +https://docs.mistral.ai/robots)',
  'ia_archiver (+http://www.alexa.com/site/help/webmasters; crawler@alexa.com)',
  'Mozilla/5.0 (compatible; Diffbot/0.1; +http://www.diffbot.com)',
  // tooling the dev/prod maps already treated as crawlers (behaviour kept)
  'curl/8.5.0',
  'Wget/1.21.4',
  'python-requests/2.32.3',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36',
]

const BROWSER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.81 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15',
]

describe('S150 Phase 3 — one crawler user-agent map covering AI fetchers', () => {
  it.each(CRAWLER_USER_AGENTS)('detects crawler: %s', (userAgent) => {
    expect(crawlerRegex().test(userAgent)).toBe(true)
  })

  it.each(BROWSER_USER_AGENTS)('keeps browser on the live SPA: %s', (userAgent) => {
    expect(crawlerRegex().test(userAgent)).toBe(false)
  })

  it.each([
    ['nginx.dev.conf', DEV_CONF_PATH],
    ['nginx.prod.conf.template', PROD_CONF_PATH],
  ])('%s includes the crawler snippet and holds no inline copy of the regex', (_name, confPath) => {
    const confText = readText(confPath)
    const userAgentMap = confText.match(/map \$http_user_agent \S+ \{([^}]*)\}/g) ?? []
    expect(userAgentMap).toHaveLength(1)
    expect(userAgentMap[0]).toMatch(/include\s+\S*crawler-user-agents\.conf;/)
    expect(confText).not.toMatch(/"~\*\(bot\|/)
  })
})

/**
 * S152-11a — the frontend router (D5, D7, W2). One conf serves both frontend
 * modes: after the geo-block, an HTML navigation asks the backend first
 * (`@frontend`, marked `X-VBWD-Render: 1`, at the ORIGINAL URI) and falls back to
 * the unchanged `@spa` chain on 404/5xx; `/dashboard` and `/tuktuk` never reach
 * the backend; `/_render/*` (fragments, theme assets) proxies with the bearer.
 */
const ROUTER_SNIPPET_PATH = resolve(SNIPPET_DIR, 'frontend-router.conf')
const ROUTER_MAP_SNIPPET_PATH = resolve(SNIPPET_DIR, 'frontend-router-map.conf')
const DOCKERFILE_PATH = resolve(REPO_ROOT, 'Dockerfile')
const DEV_COMPOSE_PATH = resolve(REPO_ROOT, 'docker-compose.yaml')
const SPA_ONLY_MATCHER = '~ ^/(dashboard|tuktuk)(/|$)'
const RENDER_MATCHER = '^~ /_render/'
const PAGE_LOCATION_MAP_HEADER = 'map "$request_method:$http_accept" $vbwd_page_location {'
const FORWARDED_PROTO_MAP_HEADER = 'map $http_x_forwarded_proto $forwarded_proto {'
const BACKEND_PROXY_PASS = /proxy_pass\s+(\$backend|http:\/\/\$api_upstream)\S*;/

/** Conf text with comments dropped, so prose never looks like a directive. */
function withoutComments(confText: string): string {
  return confText.replace(/(^|\s)#.*$/gm, '$1')
}

/** Every `location <matcher> { ... }` block: matcher + body (nested braces kept). */
function locationBlocks(confText: string): Array<{ matcher: string; body: string }> {
  const text = withoutComments(confText)
  const header = /location\s+((?:"[^"]*"|[^{;"])+?)\s*\{/g
  const blocks: Array<{ matcher: string; body: string }> = []
  let match: RegExpExecArray | null
  while ((match = header.exec(text)) !== null) {
    const body = locationBody(text, match[1]) ?? ''
    blocks.push({ matcher: match[1], body })
    header.lastIndex = match.index + match[0].length + body.length
  }
  return blocks
}

/** The `{ ... }` body of a top-level `map <source> <variable>` block. */
function mapBody(confText: string, mapHeader: string): string | null {
  const start = confText.indexOf(mapHeader)
  if (start === -1) return null
  const end = confText.indexOf('}', start)
  return confText.slice(start + mapHeader.length, end)
}

function pageLocationRegex(): RegExp {
  const body = mapBody(readText(ROUTER_MAP_SNIPPET_PATH), PAGE_LOCATION_MAP_HEADER) ?? ''
  const match = body.match(/"~(.+)"\s+@frontend;/)
  if (!match) throw new Error('frontend-router-map.conf holds no "~..." @frontend; line')
  return new RegExp(match[1])
}

const resolvedConf = (confPath: string) =>
  withoutComments(resolveSnippetIncludes(readText(confPath)))

const usesGeoBlock = (confPath: string) => readText(confPath).includes('js_content geo.handle;')

describe('S152-11a — theme-candidate map (D5)', () => {
  it.each([
    ['GET', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'],
    ['HEAD', 'text/html'],
    ['GET', 'application/xhtml+xml, text/html'],
  ])('routes a %s navigation (Accept: %s) to @frontend', (method, accept) => {
    expect(pageLocationRegex().test(`${method}:${accept}`)).toBe(true)
  })

  it.each([
    ['POST', 'text/html'],
    ['PUT', 'text/html'],
    ['GET', '*/*'],
    ['GET', 'application/json'],
    ['GET', ''],
    ['OPTIONS', 'text/html'],
  ])('keeps a %s request (Accept: %s) on @spa', (method, accept) => {
    expect(pageLocationRegex().test(`${method}:${accept}`)).toBe(false)
  })

  it('defaults every other request to @spa', () => {
    const body = mapBody(readText(ROUTER_MAP_SNIPPET_PATH), PAGE_LOCATION_MAP_HEADER) ?? ''
    expect(body).toMatch(/^\s*default\s+@spa;$/m)
  })

  it.each(['/dashboard', '/dashboard/', '/dashboard/invoices/1', '/tuktuk', '/tuktuk/reports'])(
    'the SPA-only matcher catches %s',
    (path) => {
      expect(new RegExp(SPA_ONLY_MATCHER.slice(2)).test(path)).toBe(true)
    },
  )

  it.each(['/dashboardx', '/tuktukfoo', '/shop/dashboard', '/', '/shop'])(
    'the SPA-only matcher leaves %s alone',
    (path) => {
      expect(new RegExp(SPA_ONLY_MATCHER.slice(2)).test(path)).toBe(false)
    },
  )
})

describe('S152-11a — frontend router in every served conf (D5/D7/W2)', () => {
  for (const conf of servedConfs) {
    describe(conf.name, () => {
      it('carries the page-location map and the @frontend / @spa locations', () => {
        const confText = resolvedConf(conf.path)
        expect(confText).toContain(PAGE_LOCATION_MAP_HEADER)
        expect(locationBody(confText, '@frontend')).not.toBeNull()
        expect(locationBody(confText, '@spa')).not.toBeNull()
      })

      it('@frontend proxies the ORIGINAL uri to the backend, marked, without a bearer', () => {
        const body = locationBody(resolvedConf(conf.path), '@frontend') ?? ''
        expect(body).toMatch(/proxy_pass\s+(\$backend|http:\/\/\$api_upstream);/)
        expect(body).not.toContain('/_render')
        expect(body).toMatch(/proxy_set_header\s+X-VBWD-Render\s+1;/)
        expect(body).toMatch(/proxy_set_header\s+Authorization\s+"";/)
        expect(body).toMatch(/proxy_set_header\s+Host\s+\$http_host;/)
        expect(body).toMatch(/proxy_set_header\s+X-Forwarded-For\s+\$proxy_add_x_forwarded_for;/)
        expect(body).toMatch(/proxy_set_header\s+X-Forwarded-Proto\s+\$forwarded_proto;/)
      })

      it('@frontend degrades to @spa on 404 / 502 / 503 / 504', () => {
        const body = locationBody(resolvedConf(conf.path), '@frontend') ?? ''
        expect(body).toMatch(/proxy_intercept_errors\s+on;/)
        // The fallback is a SECOND error_page hop for @spa's own 418 branches.
        expect(body).toMatch(/recursive_error_pages\s+on;/)
        expect(body).toMatch(/error_page\s+404 502 503 504\s+=\s+@spa;/)
      })

      it('/_render/ passes the bearer through and never marks a render', () => {
        const body = locationBody(resolvedConf(conf.path), RENDER_MATCHER)
        expect(body, `missing location ${RENDER_MATCHER}`).not.toBeNull()
        expect(body).toMatch(/proxy_pass\s+(\$backend|http:\/\/\$api_upstream);/)
        expect(body).not.toMatch(/Authorization/)
        expect(body).toMatch(/proxy_set_header\s+X-VBWD-Render\s+"";/)
        expect(body).not.toMatch(/error_page/)
      })

      it('every other backend proxy location blanks a client-sent X-VBWD-Render', () => {
        const backendLocations = locationBlocks(resolvedConf(conf.path)).filter(
          (block) => block.matcher !== '@frontend' && BACKEND_PROXY_PASS.test(block.body),
        )
        expect(backendLocations.length).toBeGreaterThan(0)
        for (const block of backendLocations) {
          expect(block.body, `location ${block.matcher}`).toMatch(
            /proxy_set_header\s+X-VBWD-Render\s+"";/,
          )
        }
      })

      it('location / sends HTML navigations to @frontend only after the geo-block', () => {
        const body = locationBody(resolvedConf(conf.path), '/') ?? ''
        if (usesGeoBlock(conf.path)) {
          const directives = normalisedDirectives(body)
          expect(directives).toEqual([
            'set $vbwd_geo_pass_location $vbwd_page_location;',
            'js_content geo.handle;',
          ])
        } else {
          expect(body).toMatch(/error_page\s+418\s+=\s+@frontend;/)
          expect(body).toMatch(/if \(\$vbwd_page_location = "@frontend"\) \{ return 418; \}/)
          expect(body).toMatch(/error_page\s+419\s+=\s+@spa;/)
          expect(body).toMatch(/recursive_error_pages\s+on;/)
        }
      })

      it('/dashboard and /tuktuk go straight to @spa, never @frontend', () => {
        const body = locationBody(resolvedConf(conf.path), SPA_ONLY_MATCHER)
        expect(body, `missing location ${SPA_ONLY_MATCHER}`).not.toBeNull()
        expect(body).not.toContain('@frontend')
        expect(body).not.toContain('$vbwd_page_location')
        if (usesGeoBlock(conf.path)) {
          expect(normalisedDirectives(body ?? '')).toEqual([
            'set $vbwd_geo_pass_location @spa;',
            'js_content geo.handle;',
          ])
        } else {
          expect(body).toMatch(/error_page\s+419\s+=\s+@spa;/)
          expect(body).toMatch(/return 419;/)
        }
      })
    })
  }

  it.each([
    ['nginx.dev.conf', DEV_CONF_PATH],
    ['nginx.prod.conf.template', PROD_CONF_PATH],
  ])('%s includes the shared router snippets rather than inline copies', (_name, confPath) => {
    const confText = readText(confPath)
    expect(confText).toMatch(/include\s+\S*\/frontend-router-map\.conf;/)
    expect(confText).toMatch(/include\s+\S*\/frontend-router\.conf;/)
    expect(confText).not.toContain('location @frontend')
    expect(confText).not.toContain(FORWARDED_PROTO_MAP_HEADER)
  })

  it('the prod template points the snippet $backend at $api_upstream', () => {
    expect(readText(PROD_CONF_PATH)).toMatch(/set \$backend http:\/\/\$api_upstream;/)
  })

  it('the prod image ships both router snippets', () => {
    const dockerfile = readText(DOCKERFILE_PATH)
    for (const snippet of ['frontend-router.conf', 'frontend-router-map.conf']) {
      expect(dockerfile).toContain(`COPY nginx/${snippet} /etc/nginx/snippets/${snippet}`)
    }
  })

  it('the dev compose bind-mounts both router snippets', () => {
    const compose = readText(DEV_COMPOSE_PATH)
    for (const snippet of ['frontend-router.conf', 'frontend-router-map.conf']) {
      expect(compose).toContain(`./nginx/${snippet}:/etc/nginx/snippets/${snippet}:ro`)
    }
  })

  it.skipIf(!existsSync(PLATFORM_CONF_PATH))(
    'vbwd-platform conf router blocks equal the shared snippets (drift guard)',
    () => {
      const snippetText = readText(ROUTER_SNIPPET_PATH)
      const mapSnippetText = readText(ROUTER_MAP_SNIPPET_PATH)
      const platformText = readText(PLATFORM_CONF_PATH)
      for (const matcher of ['@frontend', RENDER_MATCHER]) {
        const expected = normalisedDirectives(locationBody(snippetText, matcher) ?? '')
        const actual = normalisedDirectives(locationBody(platformText, matcher) ?? '')
        expect(actual, `platform location ${matcher} drifted from the snippet`).toEqual(expected)
      }
      for (const mapHeader of [PAGE_LOCATION_MAP_HEADER, FORWARDED_PROTO_MAP_HEADER]) {
        const expected = normalisedDirectives(mapBody(mapSnippetText, mapHeader) ?? '')
        const actual = normalisedDirectives(mapBody(platformText, mapHeader) ?? '')
        expect(actual, `platform ${mapHeader} drifted from the snippet`).toEqual(expected)
      }
    },
  )
})

/**
 * S152-12c — nginx allows ONE error_page redirect per request unless the location
 * that takes the first hop sets `recursive_error_pages on`. A location whose
 * error_page targets a named location that itself redirects on error (a SECOND
 * hop) must therefore opt in — otherwise the second hop is swallowed and the
 * client gets a bare nginx error page. The pre-S152 bug: prod `@spa`'s crawler
 * branch (418 → @seo_dynamic) consumed the hop, so a backend render 404 reached
 * the crawler as a bare 404 instead of falling through to @seo_static.
 */
const ERROR_PAGE_TARGET = /error_page\s+[^;=]+=\s*(@[\w-]+);/g

function errorPageTargets(locationText: string): string[] {
  return [...locationText.matchAll(ERROR_PAGE_TARGET)].map((match) => match[1])
}

describe('S152-12c — chained error_page hops opt into recursive_error_pages', () => {
  for (const conf of servedConfs) {
    it(`${conf.name}: every location whose error_page target redirects again is recursive`, () => {
      const blocks = locationBlocks(resolvedConf(conf.path))
      const bodyByMatcher = new Map(blocks.map((block) => [block.matcher, block.body]))
      for (const block of blocks) {
        const chainsAgain = errorPageTargets(block.body).some(
          (target) => errorPageTargets(bodyByMatcher.get(target) ?? '').length > 0,
        )
        if (!chainsAgain) continue
        expect(block.body, `location ${block.matcher}`).toMatch(/recursive_error_pages\s+on;/)
      }
    })
  }

  it('prod @spa lets the crawler render fall back: 418 → @seo_dynamic → 404 → @seo_static', () => {
    const confText = resolvedConf(PROD_CONF_PATH)
    expect(locationBody(confText, '@spa')).toMatch(/recursive_error_pages\s+on;/)
    expect(errorPageTargets(locationBody(confText, '@spa') ?? '')).toContain('@seo_dynamic')
    expect(errorPageTargets(locationBody(confText, '@seo_dynamic') ?? '')).toContain('@seo_static')
  })
})
