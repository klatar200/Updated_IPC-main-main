/**
 * PLAN-8 Phase B — A3, A5, B25, A4.
 *
 * A3. All 42 product pages shipped the same <title>, the same meta description
 * and the same og:title, with the product name as an <h2> under an <h1> reading
 * "Product Catalog". Each declares a self-referencing canonical and each is in
 * the sitemap, so Google was handed 42 indexable URLs describing themselves
 * identically. Option B was chosen (PLAN-8 §0): the metadata is derived from the
 * selected product and no URL moves.
 *
 * The assertion is on the COUNT OF DISTINCT values, not on non-emptiness — 42
 * non-empty titles that happen to be the same string is exactly the defect.
 *
 * A5. Every unknown URL rendered the homepage at 200 with its own
 * self-referencing canonical, so every typo and stale inbound link became a
 * duplicate of the homepage. The server still answers 200 — Apache's catch-all
 * rewrite is load-bearing for every deep link — so `noindex` is the signal, and
 * a canonical pointing at a soft 404 is the half-fix that looks done.
 *
 * B25. /datasheets inherited the homepage's meta description because
 * content.json's seo array has 9 rows and no datasheets row. The mechanism is
 * the defect: any page added later without a row does the same silently.
 *
 * A4. og:image shipped with no content attribute at all while twitter:card was
 * summary_large_image, so every link pasted into LinkedIn, Teams or Slack
 * rendered as a bare text card.
 *
 * Usage: node _harness/plan8-meta.js       (needs :8123)
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-meta');

const ROUTES = ['/', '/products', '/dashboard', '/datasheets', '/industries',
                '/services', '/about', '/faq', '/contact', '/privacy'];
const UNKNOWN = ['/quality', '/prodcuts', '/contact-us', '/products/CC/extra'];

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const READ_META = () => {
  const m = (sel, attr = 'content') => {
    const el = document.querySelector(sel);
    return el ? el.getAttribute(attr) : null;
  };
  return {
    title: document.title,
    desc: m('meta[name="description"]'),
    ogTitle: m('meta[property="og:title"]'),
    ogImage: m('meta[property="og:image"]'),
    ogImageW: m('meta[property="og:image:width"]'),
    ogImageH: m('meta[property="og:image:height"]'),
    robots: m('meta[name="robots"]'),
    canonical: m('link[rel="canonical"]', 'href'),
    h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
  };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const record = { routes: {}, unknown: {}, products: {} };

  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    for (const r of ROUTES) {
      await page.goto(BASE + r, { waitUntil: 'networkidle' });
      record.routes[r] = await page.evaluate(READ_META);
    }
    for (const u of UNKNOWN) {
      const resp = await page.goto(BASE + u, { waitUntil: 'networkidle' });
      record.unknown[u] = { status: resp ? resp.status() : null, ...(await page.evaluate(READ_META)) };
    }
    for (const p of products) {
      await page.goto(`${BASE}/products?productId=${encodeURIComponent(p.id)}`, { waitUntil: 'networkidle' });
      record.products[p.id] = await page.evaluate(READ_META);
    }

    await ctx.close();
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(record, null, 2));

  const pv = Object.values(record.products);
  const distinct = (key) => new Set(pv.map((v) => v[key] || '')).size;

  // ── A3 ────────────────────────────────────────────────────────────────────
  note(distinct('title') === pv.length,
    `all ${pv.length} product pages have a DISTINCT <title> (${distinct('title')} distinct)`);
  note(distinct('desc') === pv.length,
    `all ${pv.length} product pages have a DISTINCT meta description (${distinct('desc')} distinct)`);
  note(distinct('ogTitle') === pv.length,
    `all ${pv.length} product pages have a DISTINCT og:title (${distinct('ogTitle')} distinct)`);

  const badH1 = Object.entries(record.products).filter(([id, v]) => {
    const p = products.find((x) => x.id === id);
    return v.h1.length !== 1 || v.h1[0] !== (p.name || '').trim();
  });
  note(badH1.length === 0,
    'every product page has exactly one <h1> and it is the product name',
    badH1.slice(0, 6).map(([id, v]) => `${id}: ${JSON.stringify(v.h1)}`).join('\n         '));

  // The canonical must not move — Option B's whole point.
  const badCanon = Object.entries(record.products).filter(
    ([id, v]) => v.canonical !== `https://www.insulationproducts.com/products?productId=${encodeURIComponent(id)}`
  );
  note(badCanon.length === 0,
    'every product canonical is still the self-referencing ?productId= URL',
    badCanon.slice(0, 6).map(([id, v]) => `${id}: ${v.canonical}`).join('\n         '));

  // ── A5 ────────────────────────────────────────────────────────────────────
  const notNoindex = Object.entries(record.unknown).filter(([, v]) => v.robots !== 'noindex');
  note(notNoindex.length === 0,
    `all ${UNKNOWN.length} unknown URLs carry <meta name="robots" content="noindex">`,
    notNoindex.map(([u, v]) => `${u}: robots=${v.robots}`).join('\n         '));

  const hasCanon = Object.entries(record.unknown).filter(([, v]) => v.canonical);
  note(hasCanon.length === 0,
    'no unknown URL declares a canonical — a canonical on a soft 404 is the half-fix that looks done',
    hasCanon.map(([u, v]) => `${u}: ${v.canonical}`).join('\n         '));

  // An over-broad known-set check would silently noindex a real page.
  const realNoindexed = Object.entries(record.routes).filter(([, v]) => v.robots === 'noindex');
  note(realNoindexed.length === 0,
    `none of the ${ROUTES.length} real routes is noindexed`,
    realNoindexed.map(([r]) => r).join(', '));
  const realNoCanon = Object.entries(record.routes).filter(([, v]) => !v.canonical);
  note(realNoCanon.length === 0,
    `all ${ROUTES.length} real routes still declare a canonical`,
    realNoCanon.map(([r]) => r).join(', '));

  // ── B25 ───────────────────────────────────────────────────────────────────
  const descs = Object.entries(record.routes).map(([r, v]) => [r, v.desc || '']);
  const dset = new Set(descs.map(([, d]) => d));
  note(dset.size === ROUTES.length,
    `all ${ROUTES.length} routes have a distinct meta description (${dset.size} distinct)`,
    descs.map(([r, d]) => `${r}: ${d.slice(0, 60)}`).join('\n         '));

  const home = record.routes['/'].desc;
  const inherit = descs.filter(([r, d]) => r !== '/' && d === home);
  note(inherit.length === 0,
    'no route inherits the homepage meta description',
    inherit.map(([r]) => r).join(', '));

  // ── A4 ────────────────────────────────────────────────────────────────────
  const all = { ...record.routes, ...record.products };
  const noImg = Object.entries(all).filter(([, v]) => !v.ogImage);
  note(noImg.length === 0,
    `og:image is set on all ${Object.keys(all).length} routes and product pages`,
    noImg.slice(0, 8).map(([r]) => r).join(', '));

  const relImg = Object.entries(all).filter(([, v]) => v.ogImage && !/^https:\/\//.test(v.ogImage));
  note(relImg.length === 0,
    'every og:image is an absolute https URL — several crawlers ignore relative ones',
    relImg.slice(0, 8).map(([r, v]) => `${r}: ${v.ogImage}`).join('\n         '));

  const noDim = Object.entries(all).filter(([, v]) => !v.ogImageW || !v.ogImageH);
  note(noDim.length === 0,
    'og:image:width and og:image:height are set, so the first share renders without a fetch',
    noDim.slice(0, 8).map(([r]) => r).join(', '));

  const card = path.join(__dirname, '..', 'public', 'images', 'og-card.jpg');
  const cardOk = fs.existsSync(card);
  const size = cardOk ? fs.statSync(card).size : 0;
  note(cardOk && size <= 300 * 1024,
    `public/images/og-card.jpg exists and is ${(size / 1024).toFixed(1)} KiB (<= 300 KiB)`,
    cardOk ? `${size} bytes` : 'missing');

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan8-meta ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'meta.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
