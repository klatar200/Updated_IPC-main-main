/**
 * PLAN-7 item 3 — the datasheet library.
 *
 * Every one of the 42 products carries a published PDF and, before this, they
 * were reachable only from inside an individual product page. There was no
 * index, nothing in the sitemap, and — this is the part that matters — **no
 * suite anywhere checked that a pdfUrl resolves at all**. `plan5-images.js`
 * asserts every `/images/` response is a 2xx with an `image/*` content type;
 * nothing did the equivalent for `/pdfs/`. (`deadlinks.js` sounds like it
 * would, and does not: it resolves industry→SKU references in content.json and
 * never makes an HTTP request.)
 *
 * That gap was hiding a live defect. `VALUE-ADDED`'s pdfUrl is
 * `/pdfs/VALUE-ADDED.pdf`; the file on disk is `Value-Added.pdf`. On a
 * case-sensitive filesystem the SPA rewrite answers the miss with index.html
 * and a **200**, so a status-only check passes and the visitor downloads
 * 2 KB of HTML named .pdf. Identical failure class to the four photoUrl case
 * mismatches found under 4.32 — which is exactly why the content-type
 * assertion, not the status assertion, is the one carrying weight here.
 *
 * Asserts:
 *   - /datasheets renders the real page, not the SPA fallback shell
 *   - every product with a pdfUrl is listed, grouped under its own partType
 *   - EVERY pdfUrl answers 200 with application/pdf — no exceptions list
 *   - the page is reachable: a footer link on an ordinary page, not just here
 *   - /sitemap.xml carries it, so it can be indexed
 *   - the filter narrows the list and clearing it restores the full set
 *   - no horizontal overflow at 375
 *
 * Reads only. Nothing under data/ is written.
 * Needs the mirror on :8123 (started with -t _harness/site), and sync.sh must
 * have copied pdfs/ into it — without that every link 404s for the wrong
 * reason and this suite is measuring the harness, not the site.
 *
 * Usage: node _harness/plan7-datasheets.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8'));
const products = raw.products || raw;
const withPdf = products.filter((p) => p.pdfUrl);

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

(async () => {
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // ── the page exists and is not the SPA fallback ─────────────────────────
    await page.goto(`${BASE}/datasheets`, { waitUntil: 'networkidle' });
    const shape = await page.evaluate(() => ({
      h1: (document.querySelector('h1') || {}).textContent || '',
      links: [...document.querySelectorAll('a[href$=".pdf"]')].map((a) => a.getAttribute('href')),
      families: [...document.querySelectorAll('[data-ipc-family]')].map((e) => e.getAttribute('data-ipc-family')),
    }));

    note(/datasheet/i.test(shape.h1),
      `/datasheets renders its own page — <h1> is ${JSON.stringify(shape.h1)}`,
      `got ${JSON.stringify(shape.h1)} (an SPA fallback would show the homepage)`);

    // IP12GA and IP12GA-IP1274 share one combined datasheet, so the catalogue
    // has 42 products with a pdfUrl and only 41 distinct files. Count CARDS
    // against products and pin the shared count separately — asserting
    // distinct-links === products would fail on correct data, and relaxing it
    // to <= would stop noticing a card that vanished.
    const listed = new Set(shape.links);
    const missing = withPdf.filter((p) => !listed.has(p.pdfUrl)).map((p) => p.sku);
    const sharedExpected = withPdf.length - new Set(withPdf.map((p) => p.pdfUrl)).size;
    note(missing.length === 0 && shape.links.length === withPdf.length,
      `all ${withPdf.length} products are listed as cards (${listed.size} distinct files — ${sharedExpected} shared)`,
      missing.length ? `missing: ${missing.join(', ')}` : `${shape.links.length} cards vs ${withPdf.length} products`);

    const wantFamilies = [...new Set(withPdf.map((p) => p.partType || 'Other'))].sort();
    const gotFamilies = [...new Set(shape.families)].sort();
    note(wantFamilies.length > 0 && wantFamilies.join('|') === gotFamilies.join('|'),
      `grouped under all ${wantFamilies.length} product families, and no others`,
      `want ${wantFamilies.join(', ')}\n         got  ${gotFamilies.join(', ')}`);

    // ── THE ONE THAT MATTERS: every link is really a PDF ─────────────────────
    // Status alone is not enough. The SPA rewrite answers a miss with
    // index.html and a 200, so a case-mismatched filename looks healthy to
    // anything that only reads r.status().
    const bad = [];
    for (const p of withPdf) {
      const r = await page.request.get(BASE + p.pdfUrl);
      const ct = (r.headers()['content-type'] || '').toLowerCase();
      if (r.status() !== 200 || !ct.startsWith('application/pdf')) {
        bad.push(`${p.sku.padEnd(22)} ${p.pdfUrl} → ${r.status()} ${ct || '(no type)'}`);
      }
    }
    note(bad.length === 0,
      `every one of the ${withPdf.length} pdfUrls answers 200 with application/pdf`,
      bad.join('\n         '));

    // ── reachable from an ordinary page, not just by typing the URL ──────────
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const hrefs = () => page.evaluate(() =>
      [...document.querySelectorAll('a')]
        .map((a) => a.getAttribute('href') || '')
        .filter((h) => /datasheets/.test(h)));
    const closed = await hrefs();
    await page.click('button:has-text("Products")');
    await page.waitForTimeout(300);
    const opened = await hrefs();
    note(opened.length > 0,
      `reachable from the homepage — ${opened.length} link in the Products menu ` +
      `(${closed.length} before opening it, same as Product Index)`,
      'no link anywhere — the page would be reachable only by typing the URL');

    // ── indexable ────────────────────────────────────────────────────────────
    const sm = await page.request.get(`${BASE}/sitemap.xml`);
    const smBody = await sm.text();
    const smType = (sm.headers()['content-type'] || '').toLowerCase();
    note(sm.status() === 200 && /xml/.test(smType) && /\/datasheets</.test(smBody),
      'sitemap.xml lists /datasheets',
      `status ${sm.status()} type ${smType} contains=${/\/datasheets</.test(smBody)}`);

    // ── the filter works, and clearing it restores everything ───────────────
    await page.goto(`${BASE}/datasheets`, { waitUntil: 'networkidle' });
    const countLinks = () => page.evaluate(() => document.querySelectorAll('a[href$=".pdf"]').length);
    let before = 0, narrowed = -1, restored = -1, filterErr = '';
    try {
      before = await countLinks();
      await page.fill('input[type="text"]', 'PVDF', { timeout: 3000 });
      await page.waitForTimeout(200);
      narrowed = await countLinks();
      await page.fill('input[type="text"]', '', { timeout: 3000 });
      await page.waitForTimeout(200);
      restored = await countLinks();
    } catch (e) {
      // A missing input must FAIL this assertion, not abort the run — the
      // remaining checks still carry information on a half-built page.
      filterErr = String(e.message || e).split('\n')[0];
    }
    note(!filterErr && narrowed > 0 && narrowed < before && restored === before,
      `the filter narrows ${before} → ${narrowed} and clearing restores ${restored}`,
      filterErr || `before ${before}, narrowed ${narrowed}, restored ${restored}`);

    // ── 375 ─────────────────────────────────────────────────────────────────
    const m = await browser.newContext({ viewport: { width: 375, height: 800 } });
    const mp = await m.newPage();
    await mp.goto(`${BASE}/datasheets`, { waitUntil: 'networkidle' });
    const overflow = await mp.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    note(overflow <= 0, `no horizontal overflow at 375 (${overflow}px)`, `${overflow}px`);
    await m.close();
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nplan7-datasheets: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
})();
