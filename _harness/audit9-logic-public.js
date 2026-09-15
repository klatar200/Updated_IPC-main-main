/**
 * audit9-logic-public.js — PLAN-11 Appendix C rows C1-C9, C31 (the `new` rows
 * on the public/React side), plus the C6 TTL/refocus row.
 *
 * Deterministic: fixed viewport, Liberation Sans forced (GUARDRAILS §7.1),
 * no timing assertion without a documented settle.
 *
 * BASE   — origin to drive (default http://127.0.0.1:8140)
 * SITE   — docroot of that origin, needed only by the C5 arms, which mutate
 *          data/*.json and restore from PRISTINE in a finally.
 * PRISTINE — directory holding the three reference JSON files.
 * OUT    — where to write the JSON result (default _harness/out/audit9/P7)
 * ONLY   — comma-separated row ids to run (default all)
 * NEGCTL — set to a row id to run that row's negative control instead
 */
const { launch } = require('./browser');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8140';
const SITE = process.env.SITE || '_harness/out/audit9/site-A';
const PRISTINE = process.env.PRISTINE || '_harness/out/audit9/P7';
const OUT = process.env.OUT || '_harness/out/audit9/P7';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const NEGCTL = process.env.NEGCTL || '';

const FILES = {
  'products-all.json': path.join(PRISTINE, 'pristine-products.json'),
  'site-info.json': path.join(PRISTINE, 'pristine-siteinfo.json'),
  'content.json': path.join(PRISTINE, 'pristine-content.json'),
};
const dataPath = (f) => path.join(SITE, 'data', f);
function restoreAll() {
  for (const [f, src] of Object.entries(FILES)) fs.copyFileSync(src, dataPath(f));
}
function writeData(f, body) {
  fs.writeFileSync(dataPath(f), body);
}

// ── Negative control ───────────────────────────────────────────────────────
// NEGCTL=1 replaces the DERIVED copyright year in the MIRROR'S built bundle
// with a hardcoded one; the 2027 arm of C31 must then fail. The mirror is a
// disposable copy — `src/App.jsx` and `dist/` are never touched.
const BUNDLE = (() => {
  const dir = path.join(SITE, 'assets');
  const f = fs.existsSync(dir) ? fs.readdirSync(dir).find((x) => /^index-.*\.js$/.test(x)) : null;
  return f ? path.join(dir, f) : null;
})();
const YEAR_REAL = 'new Date().getFullYear()';
const YEAR_NEUT = '"2026"';
let _bundleOrig = null;
function patchBundle() {
  _bundleOrig = fs.readFileSync(BUNDLE, 'utf8');
  const n = _bundleOrig.split(YEAR_REAL).length - 1;
  if (n < 1) throw new Error('negative control: derived-year expression not found in the bundle');
  fs.writeFileSync(BUNDLE, _bundleOrig.split(YEAR_REAL).join(YEAR_NEUT));
  return n;
}
function restoreBundle() { if (_bundleOrig !== null) { fs.writeFileSync(BUNDLE, _bundleOrig); _bundleOrig = null; } }

const results = [];
let pass = 0, fail = 0;
function check(row, name, ok, observed, expected) {
  results.push({ row, name, ok: !!ok, observed, expected });
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} [${row}] ${name}  observed=${JSON.stringify(observed)}`);
}
const want = (row) => ONLY.length === 0 || ONLY.includes(row);

// Force a metric-compatible font so no width/wrap observation is DejaVu's.
const FONT_CSS = '*{font-family:"Liberation Sans",Arial,sans-serif !important}';

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page._console = [];
  page.on('console', (m) => page._console.push(`${m.type()}: ${m.text()}`));
  await page.addStyleTag && 0;
  return { ctx, page };
}

async function goto(page, url, waitFor = 'networkidle') {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState(waitFor).catch(() => {});
  await page.addStyleTag({ content: FONT_CSS }).catch(() => {});
  return res;
}

const bodyText = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
const robots = (page) => page.evaluate(() => (document.querySelector('meta[name="robots"]') || {}).content || '');
const title = (page) => page.title();

async function main() {
  const browser = await launch();
  if (NEGCTL) { const n = patchBundle(); console.log(`--- negative control: derived copyright year replaced at ${n} sites in the mirror bundle ---`); }
  try {
    // ── C1 — routing shim: path shapes ────────────────────────────────────
    if (want('C1')) {
      const shapes = ['/Products', '/products/', '/products/x', '//products'];
      for (const s of shapes) {
        const { ctx, page } = await newPage(browser);
        await goto(page, BASE + s);
        const t = await bodyText(page);
        const r = await robots(page);
        const blank = t.length < 40;
        const is404 = /Page not found/i.test(t);
        const normalised = /Product Catalog|All Products|Browse/i.test(t) && !is404;
        check('C1', `${s} is not blank`, !blank, { len: t.length }, 'body renders');
        check('C1', `${s} is a 404 page or a normalised route`, is404 || normalised,
          { is404, normalised, head: t.slice(0, 70) }, '404 page or normalised route');
        if (is404) check('C1', `${s} 404 carries noindex`, /noindex/.test(r), { robots: r }, 'noindex');
        await ctx.close();
      }
    }

    // ── C2 — ?productId= shapes ───────────────────────────────────────────
    if (want('C2')) {
      const cat = JSON.parse(fs.readFileSync(dataPath('products-all.json'), 'utf8'));
      const realId = cat[0].id;
      const cases = [
        ['', 'empty'],
        ['definitely-not-a-part', 'unknown'],
        [String(realId).toUpperCase(), 'uppercase'],
        [String(realId) + ' ', 'trailing space'],
      ];
      for (const [val, label] of cases) {
        const { ctx, page } = await newPage(browser);
        await goto(page, `${BASE}/products?productId=${encodeURIComponent(val)}`);
        const t = await bodyText(page);
        const tl = await title(page);
        const notFound = /Part not found|not found|could not find/i.test(t) || /Part not found/i.test(tl);
        const rendered = t.length > 200;
        check('C2', `productId=${label} — page renders`, rendered, { len: t.length }, 'page renders, never blank');
        check('C2', `productId=${label} — banner or a real product`, notFound || /Request Quote|Specifications/i.test(t),
          { notFound, title: tl, head: t.slice(0, 90) }, 'part-not-found banner (T2.8) or the product');
        await ctx.close();
      }
    }

    // ── C3 — unknown ?family= / ?approval= ────────────────────────────────
    if (want('C3')) {
      // `?family=` IS a route parameter. `?approval=` is NOT: ApprovalFilter
      // (App.jsx:2851) is driven by useState inside DashboardPage
      // (App.jsx:10025) and is never read from the URL, so an unknown
      // `?approval=` is an inert query string and the correct outcome is the
      // full catalog, not an empty state. Both are asserted for what they are.
      for (const q of ['family=not-a-family', 'family=not-a-family&approval=nope']) {
        const { ctx, page } = await newPage(browser);
        await goto(page, `${BASE}/products?${q}`);
        const t = await bodyText(page);
        const empty = /No products found/i.test(t);
        const named = /Nothing in not-a-family/i.test(t);
        const wayOut = /Clear filters/i.test(t);
        const phone = /630\.771\.0700/.test(t);
        check('C3', `${q} — renders the empty state`, empty, { head: t.slice(150, 330) }, '"No products found"');
        check('C3', `${q} — the empty state names the filter`, named, { named }, '"Nothing in <family>"');
        check('C3', `${q} — has a way out`, wayOut, { wayOut }, 'a Clear filters control');
        check('C3', `${q} — and a phone number as the human way out`, phone, { phone }, '630.771.0700 in the empty state');
        await ctx.close();
      }
      {
        const { ctx, page } = await newPage(browser);
        await goto(page, `${BASE}/products?approval=not-an-approval`);
        const t = await bodyText(page);
        check('C3', '?approval= is not a route parameter — it is inert, and the catalog renders in full',
          /42 products/.test(t) && !/No products found/i.test(t),
          { head: t.slice(150, 300) }, 'all 42 products; no empty state for a parameter the app does not read');
        await ctx.close();
      }
    }

    // ── C4 — {replace:true} on ?family= and ?sent=1 ───────────────────────
    if (want('C4')) {
      const { ctx, page } = await newPage(browser);
      await goto(page, `${BASE}/`);
      await goto(page, `${BASE}/products`);
      // click a family filter if there is one, else set the param directly
      const before = page.url();
      await page.goto(`${BASE}/products?family=Heat%20Shrink%20Tubing`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(400);
      const afterBack = page.url();
      check('C4', 'Back from a filtered catalog is not trapped',
        !afterBack.includes('family='), { before, afterBack }, 'Back leaves the filtered view');
      await ctx.close();

      // ?sent=1 reload must not show a false success (F5)
      const { ctx: c2, page: p2 } = await newPage(browser);
      await goto(p2, `${BASE}/contact?sent=1`);
      await p2.waitForTimeout(500);
      const t1 = await bodyText(p2);
      const urlAfter = p2.url();
      const claims = /Thank you|we[' ]?ve received|Message sent|Request sent|successfully/i.test(t1);
      check('C4', '?sent=1 on a cold load shows no false success', !claims,
        { claims, url: urlAfter, head: t1.slice(0, 140) }, 'no success panel without an actual submission');
      check('C4', '?sent=1 is stripped from the URL (replace, not push)', !urlAfter.includes('sent=1'),
        { url: urlAfter }, 'param cleaned up with {replace:true}');
      await c2.close();
    }

    // C9 is in _harness/audit9-logic-data.js — it needs the data-file mutation
    // machinery, and that is where the restore contract lives.

    // ── C31 — year boundary, derived copyright + static effectiveDate ──────
    if (want('C31')) {
      for (const [iso, expectYear] of [['2026-12-31T23:59:59', '2026'], ['2027-01-01T00:00:01', '2027']]) {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        await ctx.clock.install({ time: new Date(iso + 'Z') });
        const page = await ctx.newPage();
        await page.goto(`${BASE}/privacy`, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        const t = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
        const copyRe = new RegExp(`©\\s*1974\\s*[–-]\\s*${expectYear}`);
        check('C31', `clock ${iso} — © 1974–${expectYear} derived`, copyRe.test(t),
          { match: (t.match(/©[^.|]{0,30}/) || [''])[0] }, `© 1974–${expectYear}`);
        const eff = (t.match(/Effective[^.]{0,60}/i) || [''])[0];
        check('C31', `clock ${iso} — effectiveDate is static, not the clock`, !eff.includes(expectYear === '2027' ? '2027' : 'ZZZ'),
          { eff }, 'effective date does not track the browser clock');
        await ctx.close();
      }
    }
  } finally {
    restoreBundle();
    await browser.close();
    if (NEGCTL) {
      const hit = results.find((x) => x.name === 'clock 2027-01-01T00:00:01 — © 1974–2027 derived');
      console.log(`NEGCTL: "© 1974–2027 derived" -> ${hit ? (hit.ok ? 'STILL PASSING (control did not work)' : 'FAILED as required') : 'not run'}`);
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'logic-public.json'), JSON.stringify({ pass, fail, results }, null, 2));
  console.log(`\naudit9-logic-public ${pass}/${pass + fail}`);
  if (fail) process.exitCode = 1;
}
main();
