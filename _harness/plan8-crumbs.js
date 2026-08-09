/**
 * PLAN-8 C33 — no breadcrumbs and no BreadcrumbList anywhere.
 *
 * `nav[aria-label*=breadcrumb]` returned nothing on all 10 routes. On a
 * 42-product catalog with a deep-linkable detail view that is the standard
 * orientation cue, and the structured-data half is what puts the trail into a
 * search result instead of a bare URL.
 *
 * Two things this suite is deliberately strict about:
 *
 *  - The family crumb must come from the product's OWN partType matched against
 *    familyOrder(content), not from a second hardcoded list. So the expected
 *    value is read out of products-all.json per product and compared to what
 *    the page rendered — 42 independent comparisons, not one spot check.
 *  - The item URLs must be absolute and built the same way the page builds its
 *    own canonical. A breadcrumb that points at window.location.origin is worse
 *    than no breadcrumb: dev, the php -S mirror and production would each
 *    declare a different graph. The product crumb is therefore compared byte
 *    for byte against the page's own <link rel="canonical">.
 *
 * A5 interacts: an unknown segment is noindex with no canonical, so it must not
 * emit a BreadcrumbList either — structured data on a soft 404 is the same
 * class of error as a self-referencing canonical on one.
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan8-crumbs.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-crumbs');
const ORIGIN = 'https://www.insulationproducts.com';

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/** What the page rendered: the breadcrumb trail, plus its links and the LD node. */
const READ = () => {
  const nav = document.querySelector('nav[aria-label="Breadcrumb"]');
  const out = { present: !!nav };
  if (nav) {
    out.list = !!nav.querySelector('ol');
    out.items = [...nav.querySelectorAll('li')].map((li) => {
      const a = li.querySelector('a');
      // The crumb's LABEL is the link or the current-page span — not the whole
      // <li>, which also holds the "›" separator. That separator is
      // aria-hidden and presentational, so reading li.textContent would
      // compare "›Accessory" against "Accessory" and report a defect that is
      // not there. The AX-tree-visible label is what matters.
      const label = li.querySelector('a, [aria-current="page"]');
      return {
        text: ((label || li).textContent || '').replace(/\s+/g, ' ').trim(),
        href: a ? a.getAttribute('href') : null,
        isLink: !!a,
        current: li.querySelector('[aria-current="page"]') !== null
          || (a && a.getAttribute('aria-current') === 'page'),
      };
    });
    // The separators must be hidden from assistive tech, or the trail reads
    // as "Home chevron Product Catalog chevron …".
    out.sepsHidden = [...nav.querySelectorAll('li > span')]
      .filter((s) => !s.hasAttribute('aria-current'))
      .every((s) => s.getAttribute('aria-hidden') === 'true');
  }
  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
  const nodes = scripts.map((s) => { try { return JSON.parse(s.text); } catch { return null; } });
  out.ldCount = nodes.filter((n) => n && n['@type'] === 'BreadcrumbList').length;
  out.ld = nodes.find((n) => n && n['@type'] === 'BreadcrumbList') || null;
  const c = document.querySelector('link[rel="canonical"]');
  out.canonical = c ? c.getAttribute('href') : null;
  const h1 = document.querySelector('h1');
  out.h1 = h1 ? (h1.textContent || '').trim() : null;
  return out;
};

async function productPages(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const badFamily = [], noNav = [], badLast = [], badLd = [], badUrl = [], badH1 = [], dupes = [];

  for (const p of products) {
    await page.goto(`${BASE}/products?productId=${encodeURIComponent(p.id)}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(60);
    const r = await page.evaluate(READ);

    if (!r.present || !r.list) { noNav.push(p.id); continue; }
    if (r.ldCount > 1) dupes.push(`${p.id}:${r.ldCount}`);

    const texts = r.items.map((i) => i.text);
    // Home > Product Catalog > <family> > <product>
    const family = p.partType || '';
    if (family && texts[2] !== family) badFamily.push(`${p.id}: rendered ${JSON.stringify(texts[2])} want ${JSON.stringify(family)}`);
    const last = texts[texts.length - 1];
    if (last !== (p.name || '')) badLast.push(`${p.id}: last crumb ${JSON.stringify(last)} want ${JSON.stringify(p.name)}`);

    // The <h1> must still be the product name — A3 moved it there on purpose.
    if (r.h1 !== (p.name || '')) badH1.push(`${p.id}: h1 ${JSON.stringify(r.h1)}`);

    const ld = r.ld;
    if (!ld || !Array.isArray(ld.itemListElement) || ld.itemListElement.length !== texts.length) {
      badLd.push(`${p.id}: ${ld ? (ld.itemListElement || []).length : 'no'} LD items vs ${texts.length} crumbs`);
      continue;
    }
    const pos = ld.itemListElement.map((e) => e.position);
    if (pos.join(',') !== pos.map((_, i) => i + 1).join(',')) badLd.push(`${p.id}: positions ${pos.join(',')}`);
    const names = ld.itemListElement.map((e) => e.name);
    if (names.join('|') !== texts.join('|')) badLd.push(`${p.id}: LD names ${names.join('|')} vs crumbs ${texts.join('|')}`);

    // Every item URL absolute on the canonical origin, and the LAST one equal
    // to the page's own canonical.
    for (const e of ld.itemListElement) {
      const u = typeof e.item === 'string' ? e.item : (e.item && e.item['@id']);
      if (u && !String(u).startsWith(ORIGIN)) badUrl.push(`${p.id}: ${u}`);
    }
    const lastItem = ld.itemListElement[ld.itemListElement.length - 1];
    const lastUrl = typeof lastItem.item === 'string' ? lastItem.item : (lastItem.item && lastItem.item['@id']);
    if (lastUrl && r.canonical && lastUrl !== r.canonical) {
      badUrl.push(`${p.id}: last item ${lastUrl} != canonical ${r.canonical}`);
    }
  }

  note(noNav.length === 0, `C33: a Breadcrumb nav with an <ol> renders on all ${products.length} product pages`,
    `${noNav.length} missing: ${noNav.slice(0, 4).join(', ')}`);
  note(badFamily.length === 0, `C33: the family crumb matches the product's own partType on all ${products.length}`,
    `${badFamily.length} wrong — ${badFamily.slice(0, 3).join(' | ')}`);
  note(badLast.length === 0, `C33: the last crumb is the product name on all ${products.length}`,
    `${badLast.length} wrong — ${badLast.slice(0, 3).join(' | ')}`);
  note(badH1.length === 0, `C33: the <h1> is still the product name — the breadcrumb did not take it`,
    `${badH1.length} changed — ${badH1.slice(0, 3).join(' | ')}`);
  note(badLd.length === 0, `C33: BreadcrumbList parses and mirrors the rendered trail on all ${products.length}`,
    `${badLd.length} bad — ${badLd.slice(0, 3).join(' | ')}`);
  note(badUrl.length === 0, `C33: every BreadcrumbList item URL is absolute on ${ORIGIN}, and the last equals the page canonical`,
    `${badUrl.length} bad — ${badUrl.slice(0, 3).join(' | ')}`);
  note(dupes.length === 0, 'C33: exactly one BreadcrumbList node per page',
    `duplicated on ${dupes.slice(0, 4).join(', ')}`);

  await ctx.close();
}

async function otherRoutes(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // The three catalog views.
  for (const [route, want] of [
    ['/products', 'Product Catalog'],
    ['/dashboard', 'Product Index'],
    ['/datasheets', 'Datasheets'],
  ]) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(120);
    const r = await page.evaluate(READ);
    const texts = r.present ? r.items.map((i) => i.text) : [];
    note(r.present && texts[0] === 'Home' && texts[texts.length - 1] === want,
      `C33: ${route} carries a breadcrumb ending in ${JSON.stringify(want)}`,
      r.present ? `got ${JSON.stringify(texts)}` : 'no breadcrumb nav at all');
    note(r.present && r.ldCount === 1, `C33: ${route} emits exactly one BreadcrumbList`, `ldCount=${r.ldCount}`);
    // The trailing crumb is the current page and must not be a link.
    const lastItem = r.present ? r.items[r.items.length - 1] : null;
    note(!!lastItem && !lastItem.isLink && lastItem.current,
      `C33: ${route}'s trailing crumb is aria-current and not a link`,
      JSON.stringify(lastItem));
  }

  // The "›" separators must not be announced.
  await page.goto(`${BASE}/products?productId=${encodeURIComponent(products[0].id)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  const sep = await page.evaluate(READ);
  note(sep.sepsHidden === true, 'C33: the "›" separators are aria-hidden, not announced');

  // The homepage: a one-item trail is noise, so there should be none.
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(120);
  const home = await page.evaluate(READ);
  note(!home.present && home.ldCount === 0, 'C33: the homepage has no breadcrumb (a lone "Home" is noise)',
    `present=${home.present} ldCount=${home.ldCount}`);

  // A5 — a soft 404 is noindex with no canonical; it must not emit a trail either.
  await page.goto(BASE + '/prodcuts', { waitUntil: 'networkidle' });
  await page.waitForTimeout(120);
  const nf = await page.evaluate(READ);
  note(nf.ldCount === 0 && !nf.present,
    'C33: an unknown route emits no BreadcrumbList (A5 keeps it out of the index)',
    `present=${nf.present} ldCount=${nf.ldCount}`);

  // Crawlable: PLAN-1 4.21 — real <a href>, not a click handler on a div.
  await page.goto(`${BASE}/products?productId=${encodeURIComponent(products[0].id)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  const links = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Breadcrumb"]');
    return nav ? [...nav.querySelectorAll('a')].map((a) => a.getAttribute('href')) : [];
  });
  note(links.length >= 2 && links.every((h) => typeof h === 'string' && h.startsWith('/')),
    'C33: breadcrumb links are real crawlable hrefs (4.21)', JSON.stringify(links));

  // Keyboard: focus the first crumb, then a real Enter, must navigate.
  const before = page.url();
  const tagged = await page.evaluate(() => {
    const a = document.querySelector('nav[aria-label="Breadcrumb"] a');
    if (!a) return false;
    a.setAttribute('data-crumb-probe', '1');
    return true;
  });
  if (!tagged) {
    note(false, 'C33: Enter on the first crumb navigates away from the product', 'no breadcrumb link to focus');
  } else {
    await page.focus('[data-crumb-probe="1"]');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const after = page.url();
    note(after !== before && !/productId=/.test(after),
      'C33: Enter on the first crumb navigates away from the product', `${before} -> ${after}`);
  }

  // A no-family product must not render an empty crumb.
  const noType = products.find((p) => !p.partType);
  if (noType) {
    await page.goto(`${BASE}/products?productId=${encodeURIComponent(noType.id)}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(120);
    const r = await page.evaluate(READ);
    note(r.present && r.items.every((i) => i.text.length > 0),
      `C33: ${noType.id} has no partType and renders no empty crumb`,
      JSON.stringify(r.items.map((i) => i.text)));
  } else {
    note(true, 'C33: (no product lacks a partType, so the empty-family case cannot arise)');
  }

  await page.goto(`${BASE}/products?productId=${encodeURIComponent(products[0].id)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'crumb-product-1440.png') });
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  await productPages(browser);
  await otherRoutes(browser);
  await browser.close();

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nplan8-crumbs ${pass}/${results.length}`);
  fs.writeFileSync(path.join(OUT, 'crumbs.json'), JSON.stringify(results, null, 2));
  console.log(`record -> ${path.join(OUT, 'crumbs.json')}`);
  process.exit(pass === results.length ? 0 : 1);
})();
