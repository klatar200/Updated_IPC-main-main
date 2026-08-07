/**
 * sitemap/dashboard — does `public/sitemap.xml` describe the site that exists?
 *
 * The open item asked one question: should `/dashboard` be publicly indexed?
 * Nobody had established it. Measuring to answer it turned up a second thing
 * nobody had checked — the sitemap lists **8** URLs and the app declares
 * **9** public routes in `SEO_DEFAULT`. `/privacy` was absent.
 *
 * `SEO_DEFAULT` is the right source of truth to diff against: it is the app's
 * own list of routes that have a title and a description written for them,
 * i.e. exactly the pages meant to be found.
 *
 * Asserts:
 *   - every `<loc>` in the sitemap resolves to a real rendered page, not the
 *     SPA's "not found" state and not a redirect
 *   - every route in `SEO_DEFAULT` appears in the sitemap
 *   - nothing in the sitemap is Disallow'd by robots.txt — the two files
 *     contradicting each other is the classic way a page silently drops out
 *   - each listed URL's own `<link rel="canonical">` (4.3) points back at
 *     itself, so the sitemap is not advertising a URL the page disowns
 *   - `/dashboard` in particular is a genuine PUBLIC page: it renders the
 *     Product Index table with real product rows and needs no session
 *
 * Reads only. Nothing under data/ is written.
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * UPDATED 2026-08-07: the sitemap is no longer a file. `public/sitemap.xml` was
 * replaced by `public/sitemap.php`, which generates the document from the live
 * catalog and is reached through an .htaccess rewrite at the same address. This
 * suite therefore FETCHES /sitemap.xml over HTTP instead of reading the file —
 * which is what a crawler does anyway, and it now also proves the rewrite is
 * wired. Its own subject is unchanged: the 9 declared routes and whether
 * /dashboard belongs among them. The product half is `plan5c-sitemap.js`.
 *
 * Usage: node _harness/plan5b-sitemap.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const ROBOTS = path.join(__dirname, '..', 'public', 'robots.txt');
const APP = path.join(__dirname, '..', 'src', 'App.jsx');

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/** The app's own list of public routes, read out of SEO_DEFAULT. */
function declaredRoutes() {
  const src = fs.readFileSync(APP, 'utf8');
  const block = src.slice(src.indexOf('const SEO_DEFAULT = ['));
  const end = block.indexOf('\n];');
  return [...block.slice(0, end).matchAll(/page:\s*"([^"]+)"/g)]
    .map((m) => (m[1] === 'home' ? '/' : `/${m[1]}`));
}

/**
 * The ROUTE paths in the served sitemap. Product URLs carry ?productId= and are
 * plan5c-sitemap.js's subject; folding them in here would make `extra` below
 * report 42 false positives against a 9-route SEO_DEFAULT.
 */
const sitemapPaths = async () => {
  const res = await fetch(`${BASE}/sitemap.xml?t=${process.hrtime.bigint()}`);
  if (!res.ok) throw new Error(`GET /sitemap.xml -> ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!/xml/i.test(type)) {
    // The rewrite not firing looks exactly like this: the SPA shell, 200, HTML.
    throw new Error(`GET /sitemap.xml served "${type}", not XML — is the ` +
      `^sitemap\\.xml$ rewrite present in public/.htaccess and _harness/router.php?`);
  }
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => new URL(m[1].trim()))
    .filter((u) => !u.search)
    .map((u) => u.pathname.replace(/\/$/, '') || '/');
};

const disallowed = () =>
  fs.readFileSync(ROBOTS, 'utf8').split('\n')
    .filter((l) => /^\s*Disallow:/i.test(l))
    .map((l) => l.split(':').slice(1).join(':').trim())
    .filter(Boolean);

(async () => {
  const declared = declaredRoutes();
  const listed = await sitemapPaths();
  const blocked = disallowed();

  note(declared.length === 9,
    `SEO_DEFAULT declares ${declared.length} public routes`, JSON.stringify(declared));

  const missing = declared.filter((r) => !listed.includes(r));
  note(missing.length === 0,
    `every declared route is in the sitemap (${listed.length} <loc> entries)`,
    `missing: ${JSON.stringify(missing)}`);

  const extra = listed.filter((r) => !declared.includes(r));
  note(extra.length === 0,
    'the sitemap lists nothing that is not a declared public route',
    `unexpected: ${JSON.stringify(extra)}`);

  const conflicts = listed.filter((p) => blocked.some((d) => p === d || p.startsWith(d)));
  note(conflicts.length === 0,
    `nothing in the sitemap is blocked by robots.txt (Disallow: ${JSON.stringify(blocked)})`,
    `conflicting: ${JSON.stringify(conflicts)}`);

  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const bad = [];
    const noncanonical = [];
    for (const p of listed) {
      const res = await page.goto(BASE + p, { waitUntil: 'networkidle' });
      const info = await page.evaluate(() => ({
        status: document.title,
        canonical: (document.querySelector('link[rel="canonical"]') || {}).href || null,
        notFound: /Page Not Found|Catalog Unavailable/i.test(document.body.innerText),
        text: document.body.innerText.trim().length,
      }));
      if (res.status() !== 200 || info.notFound || info.text < 200) {
        bad.push(`${p} (http ${res.status()}, ${info.text} chars${info.notFound ? ', NOT FOUND state' : ''})`);
      }
      // 4.3 gives every route a self-canonical; the sitemap must agree with it.
      if (info.canonical && new URL(info.canonical).pathname.replace(/\/$/, '') !== (p === '/' ? '' : p)) {
        noncanonical.push(`${p} -> canonical ${info.canonical}`);
      }
    }
    note(bad.length === 0, `all ${listed.length} sitemap URLs render a real page`, bad.join(', '));
    note(noncanonical.length === 0,
      'every sitemap URL matches the canonical the page declares for itself',
      noncanonical.join(', '));

    // ── /dashboard is a genuine public page, which is what the item asked ──
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    const dash = await page.evaluate(() => ({
      title: document.title,
      rows: document.querySelectorAll('tbody tr').length,
      askedToSignIn: /sign in|password|log ?in/i.test(document.body.innerText),
      h1: (document.querySelector('h1') || {}).textContent || '',
    }));
    note(dash.rows > 20,
      `/dashboard renders the public Product Index — ${dash.rows} product rows, no session needed`,
      JSON.stringify(dash));
    note(!dash.askedToSignIn,
      '/dashboard asks for no credential — it is not an admin surface',
      dash.askedToSignIn ? 'the page mentions signing in' : '');
    note(/Product Index/i.test(dash.title),
      `/dashboard has its own SEO title ("${dash.title}")`);
  } finally {
    await browser.close();
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan5b-sitemap: ${results.length - bad}/${results.length}`);
  process.exit(bad ? 1 : 0);
})();
