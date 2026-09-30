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
