/**
 * PLAN-9 item 3 — one product-matching definition; honest metadata on alias
 * and unknown ?productId= URLs. (Audit 2026-08-09 finding 3.)
 *
 * Before the fix, ProductPage matched an id four ways while PageMeta matched
 * exact-id only and handed the RAW param to canonicalFor(): ?productId=cc
 * rendered CC's detail under the generic "Product Catalog" title with a
 * self-canonical of the lowercase param — a duplicate of the real CC page —
 * and ?productId=NOPE-XYZ-123 was an indexable self-canonical soft-404. The
 * BreadcrumbList's last item (built from the MATCHED product) contradicted
 * the page canonical on every such URL.
 *
 * Derived from _harness/aud9-meta.js (the audit's evidence — not edited).
 * Needs the mirror on :8123. Usage: node _harness/plan9-meta.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const ORIGIN = 'https://www.insulationproducts.com';
const OUT = path.join(__dirname, 'out', 'plan9');

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);
const byId = (id) => products.find((p) => p.id === id);

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const READ = () => {
  const q = (s) => document.querySelector(s);
  const ld = q('#breadcrumb-ld');
  let lastItem = null;
  if (ld) {
    try {
      const j = JSON.parse(ld.text);
      const items = j.itemListElement || [];
      lastItem = items.length ? items[items.length - 1].item : null;
    } catch (e) { lastItem = 'PARSE-ERROR'; }
  }
  return {
    title: document.title,
    canonical: q('link[rel="canonical"]') ? q('link[rel="canonical"]').href : null,
    robots: q('meta[name="robots"]') ? q('meta[name="robots"]').content : null,
    ogUrl: q('meta[property="og:url"]') ? q('meta[property="og:url"]').content : null,
    hasLd: !!ld,
    crumbLastItem: lastItem,
  };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const visit = async (url) => {
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    return page.evaluate(READ);
  };

  // ── the item-3 acceptance table ─────────────────────────────────────────
  const cc = byId('CC');
  const ipx = byId('IP12GA - IP1274');
  const ccCanon = `${ORIGIN}/products?productId=CC`;
  const ipxCanon = `${ORIGIN}/products?productId=${encodeURIComponent('IP12GA - IP1274')}`;

  for (const c of [
    { name: 'control-exact', url: '/products?productId=CC', product: cc, canonical: ccCanon },
    { name: 'alias-lowercase', url: '/products?productId=cc', product: cc, canonical: ccCanon },
    { name: 'alias-punct', url: '/products?productId=' + encodeURIComponent('ip12ga-ip1274'), product: ipx, canonical: ipxCanon },
  ]) {
    const r = await visit(c.url);
    note(r.title.includes(c.product.name),
      `${c.name}: <title> is the matched product's title`, JSON.stringify(r.title));
    note(r.canonical === c.canonical && r.ogUrl === c.canonical,
      `${c.name}: canonical and og:url both declare the MATCHED id's URL`,
      JSON.stringify({ canonical: r.canonical, ogUrl: r.ogUrl, want: c.canonical }));
    note(r.robots === null, `${c.name}: no robots meta`, JSON.stringify(r.robots));
    note(r.crumbLastItem === c.canonical,
      `${c.name}: breadcrumb-ld last item equals the canonical byte for byte`,
      JSON.stringify({ crumb: r.crumbLastItem, want: c.canonical }));
  }

  // ── the unknown id: an honest soft-404 ──────────────────────────────────
  const g = await visit('/products?productId=NOPE-XYZ-123');
  note(g.title.startsWith('Part not found — '),
    'garbage-id: <title> is "Part not found — …"', JSON.stringify(g.title));
  note(g.canonical === null && g.ogUrl === null,
    'garbage-id: no canonical tag and no og:url', JSON.stringify({ canonical: g.canonical, ogUrl: g.ogUrl }));
  note(g.robots === 'noindex', 'garbage-id: robots is noindex', JSON.stringify(g.robots));
  note(!g.hasLd, 'garbage-id: no #breadcrumb-ld node', 'present: ' + g.hasLd);

  // ── every exact id: canonical == breadcrumb-ld last item, og:url too ────
  const badCrumb = [], badOg = [];
  for (const p of products) {
    const r = await visit('/products?productId=' + encodeURIComponent(p.id));
    if (r.crumbLastItem !== r.canonical) badCrumb.push(`${p.id}: crumb ${r.crumbLastItem} != canonical ${r.canonical}`);
    if (r.ogUrl !== r.canonical) badOg.push(`${p.id}: og:url ${r.ogUrl} != canonical ${r.canonical}`);
  }
  note(badCrumb.length === 0,
    `all ${products.length} exact ids: canonical equals breadcrumb-ld last item`,
    badCrumb.slice(0, 3).join(' | '));
  note(badOg.length === 0,
    `all ${products.length} exact ids: og:url equals the canonical`,
    badOg.slice(0, 3).join(' | '));

  await ctx.close();
  await browser.close();

  const pass = results.filter((x) => x.ok).length;
  console.log(`\nplan9-meta ${pass}/${results.length}`);
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(results, null, 2));
  process.exit(pass === results.length ? 0 : 1);
})();
