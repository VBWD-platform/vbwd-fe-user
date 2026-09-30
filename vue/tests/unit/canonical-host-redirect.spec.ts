/**
 * S151 — `www.` → apex canonical-host 301 in the prod nginx template.
 *
 * The redirect is opt-in via the `CANONICAL_HOST` env (default "" = off). With it
 * unset the rendered condition is `$host = "www."`, which no real host matches.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(__dirname, '../../..')
const template = readFileSync(resolve(repoRoot, 'nginx.prod.conf.template'), 'utf8')
const dockerfile = readFileSync(resolve(repoRoot, 'Dockerfile'), 'utf8')

const REDIRECT_BLOCK =
  /if \(\$host = "www\.\$\{CANONICAL_HOST\}"\) \{\s*return 301 https:\/\/\$\{CANONICAL_HOST\}\$request_uri;\s*\}/

/** Mimic the nginx image's envsubst for one variable. */
function render(canonicalHost: string): string {
  return template.split('${CANONICAL_HOST}').join(canonicalHost)
}

describe('canonical host redirect (S151)', () => {
  it('declares the server-level www → apex redirect block', () => {
    expect(template).toMatch(REDIRECT_BLOCK)
  })

  it('places the redirect before the first location, so every path is covered', () => {
    const redirectIndex = template.search(REDIRECT_BLOCK)
    const firstLocationIndex = template.search(/^\s*location\s/m)
    expect(redirectIndex).toBeGreaterThan(-1)
    expect(redirectIndex).toBeLessThan(firstLocationIndex)
  })

  it('defaults CANONICAL_HOST to empty in the serve stage so the template always renders', () => {
    expect(dockerfile).toMatch(/^ENV CANONICAL_HOST=""$/m)
  })

  it('renders to a condition no host matches when CANONICAL_HOST is unset', () => {
    const rendered = render('')
    expect(rendered).toContain('if ($host = "www.")')
    expect(rendered).not.toContain('${CANONICAL_HOST}')
  })

  it('renders www.<host> → https://<host>$request_uri when CANONICAL_HOST is set', () => {
    const rendered = render('vbwd.cc')
    expect(rendered).toContain('if ($host = "www.vbwd.cc")')
    expect(rendered).toContain('return 301 https://vbwd.cc$request_uri;')
  })
})
