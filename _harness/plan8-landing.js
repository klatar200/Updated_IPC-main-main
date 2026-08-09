/**
 * PLAN-8 C29 — /products has no catalog landing state.
 *
 * /products auto-selected CC and rendered ONE product's detail under a
 * "Product Catalog" banner and the sub-line "Select a product to view full
 * specifications" — when one was already selected. So the canonical /products
 * page WAS the CC product page, and the natural landing page for a "product
 * catalog" search did not exist.
 *
 * §0 settled A3 as Option B: ?productId= stays. So this is built explicitly
 * rather than falling out of a route split, and the thing most likely to go
 * wrong is a URL moving. Every check below that touches a URL asserts it did
 * NOT move:
 *
 *   - /products' own canonical is still SITE_ORIGIN + /products
 *   - all 42 product canonicals are still the self-referencing ?productId=
 *   - the served sitemap still carries /products and all 42 product URLs
 *
 * A7 also has to keep holding on a page that did not exist when it shipped:
 * the landing grid renders 42 photos, and five products carry a placehold.co
 * URL, so the "treat placehold.co as no photo" guard is asserted here by
 * INTERCEPTING requests rather than by reading the data.
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan8-landing.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-landing');
const ORIGIN = 'https://www.insulationproducts.com';

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/** `[data-ipc-photo-box]` is ProductDetail's own marker — B23 put it there. */
const READ = () => {
  const main = document.querySelector('main') || document.body;
  return {
    h1: [...document.querySelectorAll('h1')].map((h) => (h.textContent || '').trim()),
    hasDetail: !!document.querySelector('[data-ipc-photo-box]'),
    hasSpecTable: !!main.querySelector('table'),
    canonical: (document.querySelector('link[rel="canonical"]') || {}).href || null,
    // The catalog grid: every card links to a product.
    cards: [...document.querySelectorAll('[data-ipc-catalog-card]')].map((el) => {
      const a = el.querySelector('a[href]') || (el.matches('a[href]') ? el : null);
      return {
        href: a ? a.getAttribute('href') : null,
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        img: (() => { const i = el.querySelector('img'); return i ? { src: i.getAttribute('src'), lazy: i.getAttribute('loading'), dims: !!(i.getAttribute('width') && i.getAttribute('height')) } : null; })(),
      };
    }),
    mainHtml: main.innerHTML.length,
    bodyText: (main.textContent || '').replace(/\s+/g, ' ').trim(),
  };
};

async function landing(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Intercept before the first navigation — A7 is about requests, not markup.
  const external = [];
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u);
    route.continue();
  });

  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  // Scroll the whole page so lazy images below the fold actually request.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
  const bare = await page.evaluate(READ);

  note(bare.h1.length === 1 && bare.h1[0] === 'Product Catalog',
    'C29: bare /products has exactly one <h1> and it is "Product Catalog"',
    JSON.stringify(bare.h1));
  note(!bare.hasDetail, 'C29: bare /products renders NO product-detail panel',
    'the detail photo box is still on the page');
  note(!bare.hasSpecTable, 'C29: bare /products renders no spec table',
    'a product spec table is still rendered');
  note(bare.canonical === `${ORIGIN}/products`,
    'C29: bare /products still declares its own unmoved canonical', String(bare.canonical));

  note(bare.cards.length === products.length,
    `C29: the landing lists all ${products.length} products`,
    `${bare.cards.length} cards`);

  // Every card resolves to a real product, and carries SKU + name + family.
  // Compare the PARSED productId, not the encoded string. pageHref builds the
  // query with URLSearchParams, which writes a space as "+"; the canonical
  // uses encodeURIComponent, which writes "%20". Both decode to the same id
  // — 9 product ids contain a space, a "/" or an "&" — so a string compare
  // here would report a defect that does not exist.
  const idOf = (href) => {
    try { return new URL(href, 'http://x').searchParams.get('productId'); } catch { return null; }
  };
  const badCard = [];
  for (const p of products) {
    const card = bare.cards.find((c) => c.href && idOf(c.href) === p.id);
    if (!card) { badCard.push(`${p.id}: no card links to it (hrefs seen: ${bare.cards.length})`); continue; }
    if (p.sku && !card.text.includes(p.sku)) badCard.push(`${p.id}: card omits sku ${p.sku}`);
    if (p.name && !card.text.includes(p.name)) badCard.push(`${p.id}: card omits name`);
    if (p.partType && !card.text.includes(p.partType)) badCard.push(`${p.id}: card omits family ${p.partType}`);
  }
  note(badCard.length === 0, `C29: every card carries a working ?productId= link, the SKU, the name and the family`,
    `${badCard.length} bad — ${badCard.slice(0, 3).join(' | ')}`);

  const imgs = bare.cards.map((c) => c.img).filter(Boolean);
  note(imgs.length > 0 && imgs.every((i) => i.lazy === 'lazy'),
    `C29: all ${imgs.length} landing photos are lazy-loaded (none is the LCP element)`,
    JSON.stringify(imgs.filter((i) => i.lazy !== 'lazy').slice(0, 3)));
  // Guarded on imgs.length: `[].every()` is true, so without this both of the
  // next two checks pass on a page with no grid at all — the exact state this
  // item exists to change.
  note(imgs.length > 0 && imgs.every((i) => i.dims),
    'C29: every landing photo declares width and height (no layout shift)',
    `${imgs.length} photos; bad: ` + JSON.stringify(imgs.filter((i) => !i.dims).slice(0, 3)));
  note(imgs.length > 0 && !imgs.some((i) => (i.src || '').includes('placehold.co')),
    'C29: no landing card renders a placehold.co src (A7 holds on the new page)',
    `${imgs.length} photos; bad: ` + JSON.stringify(imgs.filter((i) => (i.src || '').includes('placehold.co')).slice(0, 3)));
  note(external.length === 0, 'C29: the landing makes zero external requests',
    external.slice(0, 4).join(', '));

  await page.screenshot({ path: path.join(OUT, 'landing-1440.png'), fullPage: false });

  // ── not byte-identical to ?productId=CC ──
  await page.goto(`${BASE}/products?productId=CC`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const cc = await page.evaluate(READ);
  note(cc.hasDetail, 'C29: ?productId=CC still renders the detail panel (no regression)');
  note(bare.bodyText !== cc.bodyText,
    'C29: /products is not byte-identical to ?productId=CC',
    'the two pages render the same text');
  note(cc.canonical === `${ORIGIN}/products?productId=CC`,
    'C29: the CC canonical did not move', String(cc.canonical));

  // ── sidebar navigation from the landing still works ──
  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const sidebarClicked = await page.evaluate(() => {
    // The sidebar's product links are ?productId= anchors OUTSIDE the grid.
    const a = [...document.querySelectorAll('a[href*="productId="]')]
      .find((x) => !x.closest('[data-ipc-catalog-card]'));
    if (!a) return null;
    const href = a.getAttribute('href');
    a.click();
    return href;
  });
  await page.waitForTimeout(700);
  const afterSidebar = await page.evaluate(READ);
  note(sidebarClicked !== null && afterSidebar.hasDetail,
    'C29: sidebar navigation from the landing still opens a product',
    `clicked ${sidebarClicked}, detail=${afterSidebar.hasDetail}`);

  // ── a card click opens that product ──
  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const wanted = await page.evaluate(() => {
    const a = document.querySelector('[data-ipc-catalog-card] a[href], a[data-ipc-catalog-card]');
    if (!a) return null;
    const href = a.getAttribute('href');
    a.click();
    return href;
  });
  await page.waitForTimeout(700);
  const afterCard = await page.evaluate(READ);
  const url = page.url();
  const idIn = (u) => { try { return new URL(u, 'http://x').searchParams.get('productId'); } catch { return null; } };
  note(wanted !== null && afterCard.hasDetail && idIn(url) !== null && idIn(url) === idIn(wanted),
    'C29: clicking a landing card opens THAT product detail',
    `card href=${wanted}, landed on ${url}, detail=${afterCard.hasDetail}`);

  await ctx.close();
}

/** Nothing about C29 may move a URL the sitemap or the canonicals declare. */
async function urlsDidNotMove(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const res = await page.goto(`${BASE}/sitemap.xml`, { waitUntil: 'domcontentloaded' });
  const ctype = res.headers()['content-type'] || '';
  const xml = await res.text();
  note(/xml/i.test(ctype), 'C29: /sitemap.xml is still served as XML', ctype);
  note(xml.includes(`<loc>${ORIGIN}/products</loc>`),
    'C29: the sitemap still carries the bare /products URL');
  const missing = products.filter(
    (p) => !xml.includes(`productId=${encodeURIComponent(p.id).replace(/&/g, '&amp;')}`)
        && !xml.includes(`productId=${encodeURIComponent(p.id)}`)
  );
  note(missing.length === 0, `C29: the sitemap still carries all ${products.length} product URLs`,
    `${missing.length} missing: ${missing.slice(0, 3).map((p) => p.id).join(', ')}`);

  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  await landing(browser);
  await urlsDidNotMove(browser);
  await browser.close();

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nplan8-landing ${pass}/${results.length}`);
  fs.writeFileSync(path.join(OUT, 'landing.json'), JSON.stringify(results, null, 2));
  console.log(`record -> ${path.join(OUT, 'landing.json')}`);
  process.exit(pass === results.length ? 0 : 1);
})();
