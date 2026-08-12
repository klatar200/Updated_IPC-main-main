/**
 * PLAN-10 item 7 / AUDIT-10 A10-022 — the Help page must fit a phone.
 *
 * The defect: `documentElement.scrollWidth` 689 against `clientWidth` 390 at
 * mobile-390 — 299px of PAGE-LEVEL horizontal overflow. The driver is
 * `table.field-ref td:first-child { white-space: nowrap }` (admin/help.php:112):
 * the term column cannot wrap, so each table's intrinsic width is the longest
 * term plus a full explanation column, and 11 of 11 tables end up 557-599px
 * wide with no scroll container. Because the overflow lands on the DOCUMENT,
 * the header, the heading and the contents list all slide sideways with it.
 *
 * Rick opens Help precisely when he is stuck, and the column that holds every
 * answer is off-screen — including the Quick Reference table whose whole job
 * is "what you want to do -> where to go".
 *
 * What this suite asserts:
 *   1. mobile-390 — documentElement.scrollWidth === clientWidth (page overflow 0,
 *      was 299).
 *   2. mobile-390 — 0 of 11 tables extend past the viewport without a
 *      scrolling ancestor.
 *   3. mobile-390 — for each of the 8 instances the finding names, the
 *      EXPLANATION column is reachable: either painted inside 390px, or inside
 *      a container that can actually scroll to it.
 *   4. 834 / 1024 / 1440 — page overflow still 0 and the tables still render
 *      as two real columns (i.e. the fix did not turn desktop into a scroller).
 *
 * Check 3 is the one that matters. A page can measure 0px of overflow because
 * its content was clipped rather than made reachable — `overflow-x: hidden` on
 * body would pass checks 1 and 2 and leave the second column permanently
 * unreadable. So reachability is tested per named instance, and a table inside
 * a scroller only counts if `scrollWidth > clientWidth` proves it can move.
 *
 * Usage: node _harness/plan10-helpwidth.js      (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'plan10');
fs.mkdirSync(OUT, { recursive: true });

const VP = {
  'mobile-390': { width: 390, height: 844 },
  'tablet-834': { width: 834, height: 1112 },
  'tablet-1024': { width: 1024, height: 768 },
  'desktop-1440': { width: 1440, height: 900 },
};

// The instances named in A10-022's own instances[], matched on a term in each
// table's FIRST column so the check follows the content rather than a table
// index a documentation edit would silently shift.
//
// The record names several of these by words that live in the EXPLANATION
// column, not the term column — "the category list (Polyolefin, PVDF, ...)",
// "ADD — A brand-new product was created", "UPLOADS/IMAGES WRITABLE — NO".
// Matching those needles against column 1 found nothing, which is a drifted
// check reporting a clean pass, so each is anchored on the real term that owns
// the row instead. Verified against the rendered page, not inferred.
const INSTANCES = [
  'Add a brand-new part',    // Quick reference — "what you want to do -> where to go"
  'Edit',                    // action-button table
  'Part Type *',             // Add-Product field reference (the category list)
  'add',                     // audit-log badge legend
  'Certifications',          // Business Details field table
  'Quote / Message',         // Inquiries status-badge legend
  'admin folder writable',   // "What your server allows"
  'Split into sub-columns',  // size-chart editor reference
];

const MEASURE = `(() => {
  const de = document.documentElement;
  const tables = [...document.querySelectorAll('table.field-ref')].map((t, i) => {
    const r = t.getBoundingClientRect();
    // The nearest ancestor that can actually scroll horizontally.
    let sc = t.parentElement, scroller = null;
    while (sc && sc !== de) {
      const ov = getComputedStyle(sc).overflowX;
      if ((ov === 'auto' || ov === 'scroll') && sc.scrollWidth > sc.clientWidth) { scroller = sc; break; }
      sc = sc.parentElement;
    }
    // The table itself may be the scroller (display:block + overflow-x:auto).
    const selfOv = getComputedStyle(t).overflowX;
    const selfScrolls = (selfOv === 'auto' || selfOv === 'scroll') && t.scrollWidth > t.clientWidth;
    const rows = [...t.querySelectorAll('tr')].map((tr) => {
      const cells = [...tr.children];
      if (cells.length < 2) return null;
      const c0 = cells[0].getBoundingClientRect(), c1 = cells[1].getBoundingClientRect();
      return {
        term: (cells[0].textContent || '').trim().slice(0, 26),
        explRight: Math.round(c1.right * 10) / 10,
        explLeft: Math.round(c1.left * 10) / 10,
        explText: (cells[1].textContent || '').trim().slice(0, 40),
        termNoWrap: getComputedStyle(cells[0]).whiteSpace,
        c0w: Math.round(c0.width * 10) / 10,
        c1w: Math.round(c1.width * 10) / 10,
      };
    }).filter(Boolean);
    return {
      i,
      width: Math.round(r.width * 10) / 10,
      right: Math.round(r.right * 10) / 10,
      pastViewport: r.right > de.clientWidth + 0.5,
      hasScroller: !!scroller || selfScrolls,
      scrollerCanScroll: selfScrolls
        ? t.scrollWidth - t.clientWidth
        : (scroller ? scroller.scrollWidth - scroller.clientWidth : 0),
      display: getComputedStyle(t).display,
      rows,
    };
  });
  return {
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    overflowX: de.scrollWidth - de.clientWidth,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    htmlOverflowX: getComputedStyle(de).overflowX,
    tableCount: tables.length,
    tables,
  };
})()`;

const results = [];
function note(ok, msg, detail) {
  results.push({ ok, msg });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}${!ok && detail ? `\n         <- ${detail}` : ''}`);
}

async function signIn(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  return page;
}

(async () => {
  const browser = await launch();
  const data = {};
  for (const vp of Object.keys(VP)) {
    const ctx = await browser.newContext({ viewport: VP[vp] });
    const page = await signIn(ctx);
    await page.goto(`${BASE}/admin/help.php`, { waitUntil: 'networkidle' });
    await page.waitForSelector('table.field-ref', { state: 'attached' });
    await page.waitForTimeout(200);
    data[vp] = await page.evaluate(MEASURE);
    await ctx.close();
    process.stdout.write(`  · ${vp.padEnd(14)} doc ${data[vp].scrollWidth}/${data[vp].clientWidth} ` +
      `(overflow ${data[vp].overflowX}px), ${data[vp].tableCount} field-ref tables\n`);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'helpwidth.json'), JSON.stringify(data, null, 2));

  const m = data['mobile-390'];
  // 11 when A10-022 was fixed; 12 since 2026-08-11, when the Help page gained a
  // "server warnings on the dashboard" section with its own reference table.
  // This is a guard against a table VANISHING, so it stays an exact count rather
  // than a floor — but it is descriptive of the page, not an acceptance
  // criterion of A10-022. The checks that ARE the criterion (page overflow 0, no
  // table past the viewport without a working scroller, every explanation column
  // reachable) all ran against the new table and passed before this was touched.
  const EXPECTED_TABLES = 12;
  note(m.tableCount === EXPECTED_TABLES,
    `the Help page renders all ${EXPECTED_TABLES} field-ref tables (${m.tableCount})`,
    'a table disappeared, or one was added without updating EXPECTED_TABLES');

  // ── 1. page-level overflow gone ───────────────────────────────────────────
  note(m.overflowX === 0,
    `mobile-390: page-level horizontal overflow is 0px — scrollWidth ${m.scrollWidth} === clientWidth ${m.clientWidth} (was 689 vs 390, 299px)`,
    `still ${m.overflowX}px`);

  // The symptom must be fixed by making content reachable, not by clipping it.
  note(m.bodyOverflowX !== 'hidden' && m.htmlOverflowX !== 'hidden',
    `mobile-390: the overflow was not simply hidden (body overflow-x ${m.bodyOverflowX}, html ${m.htmlOverflowX})`,
    'overflow-x:hidden makes the second column permanently unreachable — PLAN-10 forbids this route');

  // ── 2. no table escapes without a scroller ────────────────────────────────
  const naked = m.tables.filter((t) => t.pastViewport && !t.hasScroller);
  note(naked.length === 0,
    `mobile-390: 0 of ${m.tableCount} tables extend past the viewport without a scrolling ancestor (was 11 of 11)`,
    naked.slice(0, 4).map((t) => `#${t.i} ${t.width}px, right ${t.right}`).join(', '));

  // ── 3. the named instances are actually reachable ─────────────────────────
  for (const needle of INSTANCES) {
    const hits = [];
    for (const t of m.tables) {
      for (const r of t.rows) {
        if (!r.term.includes(needle)) continue;
        const painted = r.explRight <= m.clientWidth + 0.5 && r.explLeft >= -0.5;
        hits.push({ t, r, reachable: painted || (t.hasScroller && t.scrollerCanScroll > 0) , painted });
      }
    }
    const bad = hits.filter((h) => !h.reachable);
    note(hits.length > 0 && bad.length === 0,
      `mobile-390: the explanation column for "${needle}" is reachable ` +
      `(${hits.length} row(s); ${hits.filter((h) => h.painted).length} painted in-viewport, ` +
      `${hits.filter((h) => !h.painted && h.reachable).length} inside a working scroller)`,
      hits.length === 0 ? 'no row matched — the check has drifted from the page'
        : bad.slice(0, 2).map((h) => `"${h.r.term}" expl right ${h.r.explRight} > ${m.clientWidth}, scroller ${h.t.hasScroller}/${h.t.scrollerCanScroll}px`).join('; '));
  }

  // ── 4. the wide viewports are unchanged ───────────────────────────────────
  for (const vp of ['tablet-834', 'tablet-1024', 'desktop-1440']) {
    const d = data[vp];
    note(d.overflowX === 0,
      `${vp}: page-level overflow still 0px (${d.overflowX})`);
    // Two real columns, not a collapsed or scrolling layout.
    const collapsed = d.tables.filter((t) => t.rows.some((r) => r.c1w < 80));
    note(collapsed.length === 0,
      `${vp}: all ${d.tableCount} tables still render a full-width explanation column ` +
      `(narrowest ${Math.min(...d.tables.flatMap((t) => t.rows.map((r) => r.c1w)))}px, floor 80)`,
      collapsed.slice(0, 3).map((t) => `#${t.i}`).join(', '));
    const scrolling = d.tables.filter((t) => t.scrollerCanScroll > 0);
    note(scrolling.length === 0,
      `${vp}: no table needs to scroll at this width (${scrolling.length}) — desktop reading is unchanged`,
      scrolling.slice(0, 3).map((t) => `#${t.i} ${t.scrollerCanScroll}px`).join(', '));
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan10-helpwidth ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'helpwidth.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
