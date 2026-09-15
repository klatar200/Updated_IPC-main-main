/**
 * audit9-logic-data.js — PLAN-11 Appendix C rows C5, C6, C7, C8, C9.
 *
 * These rows all work by putting a specific shape (or failure) in front of the
 * three data fetches and asking the RENDERED page what happened — the visitor's
 * path, not a unit call (PLAN-11 §10.1.2).
 *
 * Mutates ONLY the mirror named by SITE, and restores every file from PRISTINE
 * in a `finally`, asserting the restore byte-for-byte before reporting
 * (same contract as _harness/audit7.js).
 *
 *   BASE     origin to drive              default http://127.0.0.1:8140
 *   SITE     that origin's docroot        default _harness/out/audit9/site-A
 *   PRISTINE dir with pristine-*.json     default _harness/out/audit9/P7
 *   OUT      result dir                   default _harness/out/audit9/P7
 *   ONLY     comma-separated row ids
 *   NEGCTL   "1" runs the negative controls instead of the checks
 */
const { launch } = require('./browser');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8140';
const SITE = process.env.SITE || '_harness/out/audit9/site-A';
const PRISTINE = process.env.PRISTINE || '_harness/out/audit9/P7';
const OUT = process.env.OUT || '_harness/out/audit9/P7';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const NEGCTL = process.env.NEGCTL === '1';

const FILES = {
  'products-all.json': 'pristine-products.json',
  'site-info.json': 'pristine-siteinfo.json',
  'content.json': 'pristine-content.json',
};
const live = (f) => path.join(SITE, 'data', f);
const ref = (f) => path.join(PRISTINE, FILES[f]);
function restoreAll() {
  for (const f of Object.keys(FILES)) fs.copyFileSync(ref(f), live(f));
}
function readRef(f) { return JSON.parse(fs.readFileSync(ref(f), 'utf8')); }


// ── Negative controls ───────────────────────────────────────────────────────
// Each check below is proven able to fail by removing the guard it tests. The
// guard is removed from the MIRROR'S BUILT BUNDLE, never from `src/App.jsx` —
// the mirror is a disposable copy and the repo is not touched. `restoreBundle()`
// puts the original bytes back in a `finally`.
const BUNDLE = (() => {
  const dir = path.join(SITE, 'assets');
  const f = fs.readdirSync(dir).find((x) => /^index-.*\.js$/.test(x));
  return f ? path.join(dir, f) : null;
})();
let _bundleOrig = null;
function patchBundle(find, replace) {
  if (_bundleOrig === null) _bundleOrig = fs.readFileSync(BUNDLE, 'utf8');
  const n = _bundleOrig.split(find).length - 1;
  if (n !== 1) throw new Error(`negative control: pattern occurs ${n} times, expected exactly 1`);
  fs.writeFileSync(BUNDLE, _bundleOrig.split(find).join(replace));
}
function restoreBundle() {
  if (_bundleOrig !== null) { fs.writeFileSync(BUNDLE, _bundleOrig); _bundleOrig = null; }
}
const GUARDS = {
  // invariant 4 — mergeSiteInfo drops blank strings unless SITE_CLEARABLE
  C7: {
    find: 's!=null&&(typeof s=="string"&&s.trim()===""&&!Am.has(`${r}.${l}`)||(a[l]=s))',
    replace: 's!=null&&(a[l]=s)',
    expectFailing: 'blank non-clearable scalar (contact.phone="")',
  },
  // invariant 3 — mergeContent treats [] as a deletion, not "unset"
  C8: {
    find: 'r[n]=Array.isArray(a)?a:i,',
    replace: 'r[n]=Array.isArray(a)&&a.length?a:i,',
    expectFailing: '[] deletes a section (privacySections=[])',
  },
  // invariant 7 — the ErrorBoundary is keyed on `page`, so `caught` resets on
  // navigation. Minified, the key is the third argument to jsx().
  C9: {
    find: 'o.jsx(Pu,{children:l&&i?o.jsx(bg,{}):l&&a?o.jsx(kg,{error:a}):s()},e)',
    replace: 'o.jsx(Pu,{children:l&&i?o.jsx(bg,{}):l&&a?o.jsx(kg,{error:a}):s()})',
    expectFailing: 'the NEXT page renders without a manual reload (invariant 7)',
  },
  // jsonOrThrow asserts the Content-Type, which is what rejects an HTML 200
  C5: {
    find: 'if(!r.includes("application/json"))throw new Error(`Expected JSON for ${t}, got "${r||"no content-type"}"`);',
    replace: '',
    // NOT the html-200 arm: an HTML body is not valid JSON, so res.json()
    // rejects it even with the Content-Type assertion gone. The arm the
    // assertion alone defends is the one whose BODY parses — a text/plain `[]`.
    expectFailing: 'catalog wrong-type — /products shows CatalogError',
  },
};

const results = [];
let pass = 0, fail = 0;
function check(row, name, ok, observed, expected) {
  results.push({ row, name, ok: !!ok, observed, expected });
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} [${row}] ${name}  observed=${JSON.stringify(observed)}`);
}
const want = (r) => ONLY.length === 0 || ONLY.includes(r);
const FONT_CSS = '*{font-family:"Liberation Sans",Arial,sans-serif !important}';

async function open(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page._errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page._errors.push(m.text()); });
  page.on('pageerror', (e) => page._errors.push('pageerror: ' + e.message));
  return { ctx, page };
}
async function go(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.addStyleTag({ content: FONT_CSS }).catch(() => {});
  await page.waitForTimeout(250);
}
const text = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());

// ── C5 helpers — the five failure modes, applied to ONE file at a time ──────
const MODES = {
  'html-200': async (page, urlPart) => page.route(`**/${urlPart}*`, (r) =>
    r.fulfill({ status: 200, contentType: 'text/html; charset=UTF-8', body: '<!doctype html><html><body>SPA shell</body></html>' })),
  'truncated': async (page, urlPart) => page.route(`**/${urlPart}*`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[{"id":"CC","sku":"C' })),
  'wrong-type': async (page, urlPart) => page.route(`**/${urlPart}*`, (r) =>
    r.fulfill({ status: 200, contentType: 'text/plain; charset=UTF-8', body: '[]' })),
  'stall': async (page, urlPart) => page.route(`**/${urlPart}*`, () => { /* never respond */ }),
  '404': async (page, urlPart) => page.route(`**/${urlPart}*`, (r) =>
    r.fulfill({ status: 404, contentType: 'text/html', body: 'not found' })),
};

async function main() {
  const browser = await launch();
  if (NEGCTL) {
    const rows = ONLY.length ? ONLY : Object.keys(GUARDS);
    for (const r of rows) {
      const g = GUARDS[r];
      if (!g) { console.log(`no negative control defined for ${r}`); continue; }
      patchBundle(g.find, g.replace);
      console.log(`--- negative control ${r}: guard removed from the mirror bundle ---`);
    }
  }
  try {
    // ── C5 — one of three files failing, five ways each ────────────────────
    if (want('C5')) {
      const targets = [
        ['products-all.json', 'catalog'],
        ['site-info.json', 'site-info'],
        ['content.json', 'content'],
      ];
      for (const [file, label] of targets) {
        for (const mode of ['404', 'html-200', 'truncated', 'wrong-type', 'stall']) {
          const { ctx, page } = await open(browser);
          await MODES[mode](page, file);
          // a catalog route and a non-catalog route, same load
          await go(page, `${BASE}/products`);
          if (mode === 'stall') await page.waitForTimeout(14000);   // > PRODUCTS_FETCH_TIMEOUT_MS
          const tProducts = await text(page);
          const catalogError = /Catalog Unavailable/i.test(tProducts);
          const phoneInFooter = /630\.771\.0700/.test(tProducts);
          const blank = tProducts.length < 40;

          await go(page, `${BASE}/contact`);
          if (mode === 'stall') await page.waitForTimeout(1000);
          const tContact = await text(page);
          const contactOk = /Request a Quote|Send us a message|Contact/i.test(tContact) && tContact.length > 300;
          const contactPhone = /630\.771\.0700/.test(tContact);

          if (file === 'products-all.json') {
            check('C5', `${label} ${mode} — /products shows CatalogError`, catalogError,
              { catalogError, blank, head: tProducts.slice(0, 90) }, 'CatalogError, never blank');
            check('C5', `${label} ${mode} — the phone number is on the CatalogError page (inv. 8)`, phoneInFooter,
              { phoneInFooter }, '630.771.0700 reachable');
          } else {
            check('C5', `${label} ${mode} — /products still renders the catalog`, !blank && !catalogError,
              { blank, catalogError, len: tProducts.length }, 'catalog unaffected by a non-catalog file');
          }
          check('C5', `${label} ${mode} — /contact fully renders`, contactOk,
            { contactOk, len: tContact.length }, 'other routes fully rendered (inv. 8)');
          check('C5', `${label} ${mode} — /contact keeps the phone number`, contactPhone,
            { contactPhone }, 'phone number survives a JSON blip');
          await ctx.close();
        }
      }
    }

    // ── C6 — TTL expiry + tab refocus refreshes without a reload ───────────
    if (want('C6')) {
      const { ctx, page } = await open(browser);
      await go(page, `${BASE}/products`);
      const before = await page.evaluate(() =>
        (document.body.innerText.match(/(\d+)\s+products/) || [])[1]);
      // add a product to the mirror while the page stays open
      const cat = readRef('products-all.json');
      cat.push({ id: 'zz-ttlprobe', sku: 'ZZ-TTLPROBE', name: 'TTL probe part', partType: 'Accessory', description: ['probe'] });
      fs.writeFileSync(live('products-all.json'), JSON.stringify(cat));
      // TTL is 60 s and the cache-buster has minute granularity — wait past both
      await page.waitForTimeout(62000);
      await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
      await page.waitForTimeout(2500);
      const after = await page.evaluate(() =>
        (document.body.innerText.match(/(\d+)\s+products/) || [])[1]);
      const url = page.url();
      check('C6', 'TTL expiry + refocus picks up the new product without a reload',
        Number(after) === Number(before) + 1, { before, after, url },
        'count +1 with no navigation');
      await ctx.close();
      restoreAll();
    }

    // ── C7 — mergeSiteInfo ─────────────────────────────────────────────────
    if (want('C7')) {
      const base = readRef('site-info.json');
      const arms = [
        ['blank non-clearable scalar (contact.phone="")', (s) => { s.contact.phone = ''; },
          (t) => /630\.771\.0700/.test(t), 'default phone re-appears (invariant 4)'],
        ['blank CLEARABLE scalar (contact.fax="")', (s) => { s.contact.fax = ''; },
          (t) => !/630\.771\.0701/.test(t), 'the fax really clears (SITE_CLEARABLE)'],
        ['blank CLEARABLE scalar (company.slogan="")', (s) => { s.company.slogan = ''; },
          (t) => !/Materials for the Electrical & Electronic Industry/.test(t), 'the slogan really clears'],
        ['missing key (delete contact.phone)', (s) => { delete s.contact.phone; },
          (t) => /630\.771\.0700/.test(t), 'default for a missing key'],
        ['wrong type (contact = "nope")', (s) => { s.contact = 'nope'; },
          (t) => /630\.771\.0700/.test(t), 'whole group falls back to defaults'],
        ['wrong type (hours.days = "Monday")', (s) => { s.hours.days = 'Monday'; },
          (t) => t.length > 500, 'array default kept, page still renders'],
        ['top level not an object (file is `[]`)', null,
          (t) => /630\.771\.0700/.test(t) && t.length > 500, 'SITE_DEFAULTS wholesale'],
      ];
      for (const [label, mutate, assert, expected] of arms) {
        const s = JSON.parse(JSON.stringify(base));
        if (mutate) { mutate(s); fs.writeFileSync(live('site-info.json'), JSON.stringify(s)); }
        else fs.writeFileSync(live('site-info.json'), '[]');
        const { ctx, page } = await open(browser);
        await go(page, `${BASE}/contact`);
        const t = await text(page);
        check('C7', label, assert(t), { len: t.length, hasPhone: /630\.771\.0700/.test(t), hasFax: /630\.771\.0701/.test(t), errors: page._errors.slice(0, 2) }, expected);
        await ctx.close();
      }
      restoreAll();
    }

    // ── C8 — mergeContent ──────────────────────────────────────────────────
    if (want('C8')) {
      const base = readRef('content.json');
      const arms = [
        ['[] deletes a section (privacySections=[])', (c) => { c.privacySections = []; },
          '/privacy', (t) => !/Information We Collect/.test(t) && t.length > 200,
          'the cleared section STAYS cleared (invariant 3)'],
        ['[] deletes a section (faq=[])', (c) => { c.faq = []; },
          '/faq', (t) => !/What types of heat shrink tubing/.test(t) && t.length > 200,
          'the cleared FAQ stays cleared'],
        ['missing section (delete faq)', (c) => { delete c.faq; },
          '/faq', (t) => /heat shrink/i.test(t), 'default FAQ for a MISSING section'],
        ['string for an array (faq="x")', (c) => { c.faq = 'x'; },
          '/faq', (t) => /heat shrink/i.test(t), 'wrong type falls back to the default'],
        ['null rows inside a section array', (c) => { c.faq = [null, base.faq[0], null]; },
          '/faq', (t) => /What types of heat shrink tubing/.test(t) && t.length > 200,
          'null rows are filtered, the real row renders (L2)'],
        ['blank non-clearable copy (copy.hero.title="")', (c) => { c.copy.hero.title = ''; },
          '/', (t) => t.length > 500, 'blank copy falls back rather than rendering empty'],
        ['PHP-only `copy` key the React side does not know', (c) => { c.copy.somethingPhpOnly = { a: 1 }; },
          '/', (t) => t.length > 500, 'an unknown copy group is ignored, not fatal'],
        ['top level not an object (file is `"x"`)', null,
          '/faq', (t) => /heat shrink/i.test(t), 'contentDefaults() wholesale'],
      ];
      for (const [label, mutate, route, assert, expected] of arms) {
        const c = JSON.parse(JSON.stringify(base));
        if (mutate) { mutate(c); fs.writeFileSync(live('content.json'), JSON.stringify(c)); }
        else fs.writeFileSync(live('content.json'), '"x"');
        const { ctx, page } = await open(browser);
        await go(page, BASE + route);
        const t = await text(page);
        check('C8', label, assert(t), { route, len: t.length, errors: page._errors.slice(0, 2), head: t.slice(150, 300) }, expected);
        await ctx.close();
      }
      restoreAll();
    }

    // ── C9 — ErrorBoundary keyed on page (invariant 7) ─────────────────────
    if (want('C9')) {
      // An object where a string belongs reaches a render site inside <main>:
      // React throws "Objects are not valid as a React child".
      const c = readRef('content.json');
      c.faq = [{ category: 'Products', question: { broken: true }, answer: { broken: true } }];
      fs.writeFileSync(live('content.json'), JSON.stringify(c));
      const { ctx, page } = await open(browser);
      await go(page, `${BASE}/faq`);
      const tBad = await text(page);
      const boundaryCaught = /went wrong|error|Try again|Reload/i.test(tBad) || page._errors.length > 0;
      const chromeAlive = /630\.771\.0700|INSULATION PRODUCTS/i.test(tBad);
      const boundaryShowing = /Something went wrong/i.test(tBad);
      check('C9', 'the probe actually reaches the boundary (not a vacuous pass)', boundaryShowing,
        { boundaryShowing, caughtErrors: page._errors.length }, '"Something went wrong" on the FAQ page');
      check('C9', 'the throwing page does not take the whole root down', chromeAlive,
        { chromeAlive, len: tBad.length, errorCount: page._errors.length }, 'navbar/footer survive (inv. 8)');
      // Now navigate away IN THE SAME TAB — invariant 7's actual claim.
      await page.evaluate(() => {
        const a = [...document.querySelectorAll('a')].find((x) => /\/contact$/.test(x.getAttribute('href') || ''));
        if (a) a.click();
      });
      await page.waitForTimeout(1200);
      const tNext = await text(page);
      // NOT /Request a Quote/ — that string is the NAVBAR CTA and is present on
      // the ErrorBoundary screen too, so it passed under the negative control.
      // Assert the contact page's own heading and the absence of the boundary.
      const secondPageRenders = /Get in Touch/i.test(tNext)
        && !/Something went wrong/i.test(tNext) && tNext.length > 400;
      check('C9', 'the NEXT page renders without a manual reload (invariant 7)', secondPageRenders,
        { url: page.url(), len: tNext.length, head: tNext.slice(150, 260) },
        'ErrorBoundary is keyed on `page`, so `caught` resets');
      await ctx.close();
      restoreAll();
    }
  } finally {
    restoreBundle();
    restoreAll();
    let restoreOk = true;
    for (const f of Object.keys(FILES)) {
      if (!fs.readFileSync(live(f)).equals(fs.readFileSync(ref(f)))) restoreOk = false;
    }
    check('--', 'mirror restored byte-for-byte', restoreOk, { restoreOk }, 'three data files identical to pristine');
    if (NEGCTL) {
      for (const r of (ONLY.length ? ONLY : Object.keys(GUARDS))) {
        const g = GUARDS[r]; if (!g) continue;
        const hit = results.find((x) => x.name === g.expectFailing);
        console.log(`NEGCTL ${r}: "${g.expectFailing}" -> ${hit ? (hit.ok ? 'STILL PASSING (control did not work)' : 'FAILED as required') : 'not run'}`);
      }
    }
    await browser.close();
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `logic-data${NEGCTL ? '-negctl' : ''}.json`), JSON.stringify({ pass, fail, results }, null, 2));
  console.log(`\naudit9-logic-data ${pass}/${pass + fail}`);
  if (fail) process.exitCode = 1;
}
main();
