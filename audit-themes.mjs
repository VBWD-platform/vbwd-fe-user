import { chromium, request as apiRequest } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'http://localhost:8080';
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'AdminPass123@';

const TARGETS = ['home1', 'home2', 'enterprise', 'solutions', 'software', 'references'];
const OUT = path.join('test-results', 'theme-audit');
fs.mkdirSync(OUT, { recursive: true });

async function login(ctx) {
  const r = await ctx.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const body = await r.json();
  return body.token || body.access_token;
}
async function loadStyles(ctx, token) {
  const r = await ctx.get(`${API_BASE}/api/v1/admin/cms/styles?per_page=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await r.json();
  return body.items.filter(s => s.is_active);
}
async function loadPages(ctx, token) {
  const r = await ctx.get(`${API_BASE}/api/v1/admin/cms/pages?per_page=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await r.json();
  const byslug = {};
  for (const p of body.items) {
    if (TARGETS.includes(p.slug)) byslug[p.slug] = p;
  }
  return byslug;
}
async function setPageStyle(ctx, token, pageId, styleId) {
  await ctx.put(`${API_BASE}/api/v1/admin/cms/pages/${pageId}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { style_id: styleId },
  });
}

(async () => {
  const ctx = await apiRequest.newContext();
  const token = await login(ctx);
  const styles = await loadStyles(ctx, token);
  const pages = await loadPages(ctx, token);

  const original = {};
  for (const slug of TARGETS) if (pages[slug]) original[slug] = pages[slug].style_id;

  const browser = await chromium.launch();
  const rows = [];

  try {
    for (const style of styles) {
      const sdir = path.join(OUT, style.slug);
      fs.mkdirSync(sdir, { recursive: true });
      for (const slug of TARGETS) {
        const page = pages[slug];
        if (!page) continue;
        await setPageStyle(ctx, token, page.id, style.id);

        const bctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const bpage = await bctx.newPage();
        try {
          await bpage.goto(`${API_BASE}/${slug}`, { waitUntil: 'networkidle', timeout: 20000 });
          await bpage.waitForTimeout(600);
          const m = await bpage.evaluate(() => {
            const L = (sel) => {
              const el = document.querySelector(sel);
              return el ? Math.round(el.getBoundingClientRect().left) : null;
            };
            return {
              menu_link: L('.cms-widget--header-nav .cms-menu__item:first-child > .cms-menu__link'),
              burger: L('.cms-widget--header-nav .cms-burger'),
              breadcrumb: L('.cms-breadcrumb'),
              hero: L('.hero'),
              h1: L('h1'),
              card: L('.card, .ghrm-pkg-card, .ghrm-cat-card'),
              container_max: getComputedStyle(document.documentElement).getPropertyValue('--container-max').trim(),
              edge_inset: getComputedStyle(document.documentElement).getPropertyValue('--edge-inset').trim(),
            };
          });
          await bpage.screenshot({ path: path.join(sdir, `${slug}.png`), fullPage: false });
          rows.push({ style: style.slug, page: slug, ...m });
        } catch (e) {
          rows.push({ style: style.slug, page: slug, err: String(e).slice(0,80) });
        }
        await bctx.close();
      }
    }
  } finally {
    for (const slug of TARGETS) if (pages[slug]) await setPageStyle(ctx, token, pages[slug].id, original[slug] ?? null);
  }
  await browser.close();

  fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(rows, null, 2));
  // Detect misalignments: for same page, the "anchor" elements should agree
  process.stdout.write('\n=== misalignments ===\n');
  for (const r of rows) {
    if (r.err) { process.stdout.write(`${r.style}/${r.page}: ERR ${r.err}\n`); continue; }
    const fullwidth = r.container_max === '100%';
    // Menu-link and burger shouldn't both be visible (narrow=link, fullwidth=burger)
    // Check alignment within 6px tolerance on fullwidth themes
    if (fullwidth && r.burger !== null && r.breadcrumb !== null) {
      const delta = Math.abs(r.burger - r.breadcrumb);
      if (delta > 10) process.stdout.write(`${r.style}/${r.page}: burger=${r.burger} breadcrumb=${r.breadcrumb} Δ=${delta}\n`);
    }
    if (!fullwidth && r.menu_link !== null && r.breadcrumb !== null) {
      const delta = Math.abs(r.menu_link - r.breadcrumb);
      if (delta > 10) process.stdout.write(`${r.style}/${r.page}: menu=${r.menu_link} breadcrumb=${r.breadcrumb} Δ=${delta}\n`);
    }
  }
  process.stdout.write(`\n[AUDIT] ${rows.length} measurements · Report: ${OUT}/audit.json\n`);
  process.stdout.write(`[AUDIT] Screenshots: ${OUT}/<slug>/<page>.png\n`);
})();
