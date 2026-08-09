/**
 * PLAN-9 items 2 + 3 — an unknown ?productId= shows the catalog it promises,
 * with honest head metadata. (Audit 2026-08-09 findings 2 and 3.)
 *
 * Before the fix, /products?productId=NOPE-XYZ-123 rendered the amber
 * "Showing the catalog instead" banner above the FULL DETAIL PAGE for CC
 * (products[0]) — with CC's sticky RFQ bar sliding in on scroll — and the
 * head declared a self-referencing canonical with no noindex: an indexable
 * soft-404 with an unbounded URL space.
 *
 * First half (item 2): the not-found path renders CatalogLanding, no
 * ProductDetail, no sticky bar. Second half (item 3): the not-found page is
 * an honest soft-404 — "Part not found" title, noindex, no canonical, no
 * og:url, no #breadcrumb-ld (the visible trail stays). Control: the exact-id
 * path is unchanged.
 *
 * Needs the mirror on :8123. Usage: node _harness/plan9-notfound.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan9');
const CC_NAME = 'Nonmetallic Liquid-tight Conduit Coupling';

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const READ = () => {
  const q = (s) => document.querySelector(s);
  const alertEl = q('[role="alert"]');
  const fixedBars = [...document.querySelectorAll('div')].filter((el) => {
    const cs = getComputedStyle(el);
    return cs.position === 'fixed' && cs.bottom === '0px' && el.getBoundingClientRect().height > 40;
  });
  const nav = q('nav[aria-label="Breadcrumb"]');
  return {
    banner: alertEl ? alertEl.textContent.replace(/\s+/g, ' ').trim() : null,
    cards: document.querySelectorAll('[data-ipc-catalog-card]').length,
    h1s: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
    fixedBottomBars: fixedBars.length,
    title: document.title,
    canonical: q('link[rel="canonical"]') ? q('link[rel="canonical"]').href : null,
    robots: q('meta[name="robots"]') ? q('meta[name="robots"]').content : null,
    ogUrl: q('meta[property="og:url"]') ? q('meta[property="og:url"]').content : null,
    breadcrumbLd: !!q('#breadcrumb-ld'),
    crumbTexts: nav
      ? [...nav.querySelectorAll('li')].map((li) =>
          ((li.querySelector('a, [aria-current="page"]') || li).textContent || '').replace(/\s+/g, ' ').trim())
      : null,
  };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // ── the unknown id ──────────────────────────────────────────────────────
  await page.goto(BASE + '/products?productId=NOPE-XYZ-123', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  let r = await page.evaluate(READ);

  // item 2, first half
  note(!!r.banner && r.banner.includes("We couldn't find part") && r.banner.includes('Showing the catalog instead'),
    'notfound: the amber role=alert banner renders with the existing copy', JSON.stringify(r.banner));
  note(r.cards === 42,
    'notfound: the catalog grid renders — 42 [data-ipc-catalog-card] links', `saw ${r.cards}`);
  note(!r.h1s.includes(CC_NAME) && r.h1s.includes('Product Catalog'),
    'notfound: no ProductDetail content — the page <h1> is "Product Catalog", not CC\'s detail',
    'h1s: ' + JSON.stringify(r.h1s));

  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(900);
  const bars = await page.evaluate(() => [...document.querySelectorAll('div')].filter((el) => {
    const cs = getComputedStyle(el);
    return cs.position === 'fixed' && cs.bottom === '0px' && el.getBoundingClientRect().height > 40;
  }).length);
  note(bars === 0, 'notfound: after scrolling, no fixed bottom RFQ bar exists', `saw ${bars}`);

  // item 3, second half — the honest soft-404 head
  note(r.title.startsWith('Part not found — '),
    'notfound: <title> is "Part not found — …"', JSON.stringify(r.title));
  note(r.robots === 'noindex' && r.canonical === null && r.ogUrl === null,
    'notfound: noindex, no canonical tag, no og:url',
    JSON.stringify({ robots: r.robots, canonical: r.canonical, ogUrl: r.ogUrl }));
  note(!r.breadcrumbLd && Array.isArray(r.crumbTexts) && r.crumbTexts.join('|') === 'Home|Product Catalog',
    'notfound: no #breadcrumb-ld script, but the visible Home › Product Catalog trail stays',
    JSON.stringify({ ld: r.breadcrumbLd, crumbs: r.crumbTexts }));

  // ── control: the exact id still renders the detail and its bar ──────────
  await page.goto(BASE + '/products?productId=CC', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  r = await page.evaluate(READ);
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(900);
  const ccBar = await page.evaluate(() => [...document.querySelectorAll('div')].filter((el) => {
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    return cs.position === 'fixed' && cs.bottom === '0px' && b.height > 40 && b.top < innerHeight;
  }).length);
  note(r.h1s.includes(CC_NAME) && r.banner === null && r.breadcrumbLd
    && r.canonical === 'https://www.insulationproducts.com/products?productId=CC'
    && ccBar === 1,
    'control: ?productId=CC still renders the detail, its canonical, its BreadcrumbList and the sticky bar',
    JSON.stringify({ h1s: r.h1s, banner: r.banner, ld: r.breadcrumbLd, canonical: r.canonical, bar: ccBar }));

  await ctx.close();
  await browser.close();

  const pass = results.filter((x) => x.ok).length;
  console.log(`\nplan9-notfound ${pass}/${results.length}`);
  fs.writeFileSync(path.join(OUT, 'notfound.json'), JSON.stringify(results, null, 2));
  process.exit(pass === results.length ? 0 : 1);
})();
