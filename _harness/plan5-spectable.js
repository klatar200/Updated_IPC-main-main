/**
 * PLAN-5 4.29 — three products render an empty, invalid spec table.
 *
 * `IP75AD`, `VALUE-ADDED` and `VT-1100` carry `specTable2: { rows: [] }`.
 * `SpecTable2` rendered its chrome unconditionally, so those pages emitted
 *
 *     <table><thead><tr></tr></thead><tbody></tbody></table>
 *
 * inside a bordered, rounded box: a `<tr>` with no cells (invalid HTML — the
 * content model for `tr` requires one or more `td`/`th`) and a visible empty
 * panel on a page a buyer is using to evaluate a spec-grade part.
 *
 * Asserts:
 *   - across ALL 42 product pages, zero `<tr>` with no `td`/`th` child
 *   - across ALL 42 product pages, zero `<table>` with no data rows
 *   - on the three named products, the right-hand spec panel is gone entirely:
 *     no `<table>`, and no empty bordered box left behind by its wrapper
 *   - a product WITH rows is untouched (cell counts unchanged)
 *   - the neighbouring case: a table with a TITLE but no rows emits no heading
 *     either — driven by writing that state into the mirror's catalog
 *   - no horizontal overflow at 375px on any of the 42 pages (the layout
 *     collapses from two columns to one, which can move things)
 *
 * Screenshots of the three empty-table products and one control land in
 * _harness/out/plan5-spectable/ at 1440 and 375.
 *
 * The mirror's products-all.json is written for the title-but-no-rows case and
 * restored from pristine/ afterwards. The repo's data/ is never touched.
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan5-spectable.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan5-spectable');
const MIRROR_DATA = path.join(__dirname, 'site', 'data');
const PRISTINE = path.join(__dirname, 'pristine');

const EMPTY_T2 = ['IP75AD', 'VALUE-ADDED', 'VT-1100'];
const CONTROL = 'IP52EC';

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const catalog = () => JSON.parse(fs.readFileSync(path.join(PRISTINE, 'products-all.json'), 'utf8'));

function restoreMirror() {
  fs.copyFileSync(path.join(PRISTINE, 'products-all.json'), path.join(MIRROR_DATA, 'products-all.json'));
}

/** Everything structural we care about, read out of the live DOM. */
const scrape = (page) =>
  page.evaluate(() => {
    const trs = [...document.querySelectorAll('tr')];
    const tables = [...document.querySelectorAll('table')];
    return {
      trCount: trs.length,
      emptyTr: trs.filter((tr) => tr.querySelectorAll('td,th').length === 0).length,
      tableCount: tables.length,
      tablesWithNoDataRows: tables.filter((t) => t.querySelectorAll('tbody tr').length === 0).length,
      cellCount: document.querySelectorAll('td,th').length,
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    };
  });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const products = catalog();

  try {
    restoreMirror();

    // ── the whole catalog, at 375 (the width where the two-column spec grid
    //    collapses and where overflow shows up) ────────────────────────────
    const ctx375 = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const p375 = await ctx375.newPage();
    let emptyTrTotal = 0, emptyTableTotal = 0, overflowPages = [];
    const perProduct = {};
    for (const prod of products) {
      await p375.goto(`${BASE}/products?productId=${encodeURIComponent(prod.id)}`, { waitUntil: 'networkidle' });
      const s = await scrape(p375);
      perProduct[prod.id] = s;
      emptyTrTotal += s.emptyTr;
      emptyTableTotal += s.tablesWithNoDataRows;
      if (s.overflow > 0) overflowPages.push(`${prod.id}:${s.overflow}px`);
    }
    note(emptyTrTotal === 0,
      `zero <tr> with no cells across all ${products.length} product pages`,
      `${emptyTrTotal} found; offenders: ` +
        Object.entries(perProduct).filter(([, s]) => s.emptyTr).map(([k, s]) => `${k}(${s.emptyTr})`).join(', '));
    note(emptyTableTotal === 0,
      `zero <table> with no data rows across all ${products.length} product pages`,
      `${emptyTableTotal} found; offenders: ` +
        Object.entries(perProduct).filter(([, s]) => s.tablesWithNoDataRows).map(([k]) => k).join(', '));
    note(overflowPages.length === 0,
      `no horizontal overflow at 375px across all ${products.length} product pages`,
      overflowPages.join(', '));

    // ── the three named products: the panel is GONE, not merely empty ──────
    // The empty-box check runs at 1440, NOT 375. At 375 the spec grid is a
    // single column and `h-full` has nothing to stretch against, so the empty
    // panel collapses to 0px high and a size-based detector passes against the
    // unfixed code — the first draft of this suite did exactly that. Measured
    // at 1440 on IP75AD before the fix the box is 391 x 508 px.
    const ctx1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p1440 = await ctx1440.newPage();
    for (const sku of EMPTY_T2) {
      const s = perProduct[sku];
      note(s.tableCount === 0,
        `${sku}: no <table> element at all (specTable2 has rows: [])`,
        `found ${s.tableCount}`);
      await p1440.goto(`${BASE}/products?productId=${sku}`, { waitUntil: 'networkidle' });
      const box = await p1440.evaluate(() =>
        [...document.querySelectorAll('div')].filter((d) => {
          const cs = getComputedStyle(d);
          const r = d.getBoundingClientRect();
          return d.textContent.trim() === '' &&
                 r.width > 40 && r.height > 40 &&
                 cs.borderTopWidth !== '0px' &&
                 d.querySelectorAll('svg,img').length === 0;
        }).map((d) => `${Math.round(d.getBoundingClientRect().width)}x${Math.round(d.getBoundingClientRect().height)}`));
      note(box.length === 0,
        `${sku}: no empty bordered box left where the table was (1440px)`,
        `${box.length} found: ${box.join(', ')}`);
    }
    await ctx1440.close();

    // ── the control keeps its table ────────────────────────────────────────
    const c = perProduct[CONTROL];
    note(c.tableCount >= 1 && c.trCount > 1 && c.cellCount > 4,
      `${CONTROL} (a product WITH rows) is unchanged: ${c.tableCount} table, ${c.trCount} rows, ${c.cellCount} cells`,
      JSON.stringify(c));

    // ── screenshots, 1440 and 375 ──────────────────────────────────────────
    for (const w of [1440, 375]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const pg = await ctx.newPage();
      for (const sku of [...EMPTY_T2, CONTROL]) {
        await pg.goto(`${BASE}/products?productId=${sku}`, { waitUntil: 'networkidle' });
        await pg.screenshot({ path: path.join(OUT, `${sku}-${w}.png`), fullPage: true });
      }
      await ctx.close();
    }

    // ── the neighbouring case: a TITLE but no rows ─────────────────────────
    // SpecTable1 always drew its dark heading bar, so a table Rick has titled
    // but not yet filled would announce a section that is not there.
    {
      const doc = catalog();
      const target = doc.find((p) => p.id === CONTROL);
      target.specTable1 = { title: 'Specifications:', rows: [] };
      target.specTable2 = { title: 'Dimensions:', columnSpans: [], rows: [] };
      fs.writeFileSync(path.join(MIRROR_DATA, 'products-all.json'), JSON.stringify(doc, null, 2));

      await p375.goto(`${BASE}/products?productId=${CONTROL}`, { waitUntil: 'networkidle' });
      const s = await scrape(p375);
      const headings = await p375.evaluate(() =>
        [...document.querySelectorAll('body *')]
          .filter((e) => e.children.length === 0 && /^(Specifications:|Dimensions:)$/.test(e.textContent.trim()))
          .map((e) => e.textContent.trim()));
      note(s.emptyTr === 0 && s.tableCount === 0,
        `${CONTROL} with BOTH tables emptied: no table, no empty <tr>`,
        JSON.stringify(s));
      note(headings.length === 0,
        `${CONTROL} with BOTH tables emptied: no heading is emitted for the absent table`,
        `still showing: ${JSON.stringify(headings)}`);
      note(s.overflow === 0, `${CONTROL} with both tables emptied: no overflow at 375px`, `${s.overflow}px`);
      await p375.screenshot({ path: path.join(OUT, `${CONTROL}-both-empty-375.png`), fullPage: true });
    }

    await ctx375.close();
  } finally {
    restoreMirror();
    await browser.close();
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan5-spectable: ${results.length - bad}/${results.length}`);
  console.log(`screenshots -> ${OUT}`);
  process.exit(bad ? 1 : 0);
})();
