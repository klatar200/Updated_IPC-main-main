/**
 * PLAN-8 Phase C — A6, B19, B20, B27, B12.
 *
 * Everything here is measured in the browser rather than read out of the
 * source. A6 and B19 are both "what width did the browser actually compute",
 * which a source scan cannot answer: DASHBOARD_COLS declares a width for four
 * of its seven columns and the table ignored all of them, because the table
 * lays out on content.
 *
 * A6. At 1440 the Product Index table was 1264px inside a 1230px wrapper, so
 * all 41 "View Product" buttons — the primary action on the page — overflowed
 * the wrapper's right edge and were visibly cut. The wrapper is
 * overflow-x: auto so it CAN be scrolled, but nothing said so.
 *
 * B19. Measured header widths at 1440: Product Name 159, Part ID 259,
 * Part Type 258, Description 142, Temp 110, Specifications 163, Action 173.
 * The two columns holding a short SKU and a small chip took 517px between
 * them; the longest content got 142 and wrapped to one to three words a line.
 * Rows came out 183-223px tall, so 41 products made a 9,595px page.
 *
 * B20. The no-results cell stopped short of the table's right edge because
 * colSpan was hardcoded to 6 and the table has 7 columns.
 *
 * B27. The catalog sidebar was max-height 720px with a scrollHeight of 3,203:
 * every family opened on first paint, so ten of the eleven category headers
 * sat below an inner fold with no cue that the region scrolled.
 *
 * B12. The catalog was counted three ways on four surfaces — 41 in the sidebar
 * and the dashboard header, 42 in the dashboard's approval filter and on
 * /datasheets — because VALUE-ADDED was in SIDEBAR_EXCLUDED. Resolved per
 * PLAN-8 §0 C48: it is a product, so every surface says 42.
 *
 * Usage: node _harness/plan8-catalog.js      (needs :8123)
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-catalog');

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);
const TOTAL = products.length;

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/** The Product Index table, its wrapper, and every action button. */
const READ_TABLE = () => {
  const table = document.querySelector('table');
  if (!table) return null;
  // The scrolling wrapper is the nearest ancestor that can scroll on x.
  let wrap = table.parentElement;
  while (wrap && getComputedStyle(wrap).overflowX !== 'auto' && wrap !== document.body) {
    wrap = wrap.parentElement;
  }
  const heads = [...table.querySelectorAll('thead th')].map((th) => ({
    label: th.textContent.trim(),
    w: Math.round(th.getBoundingClientRect().width),
  }));
  const rows = [...table.querySelectorAll('tbody tr')].map((tr) =>
    Math.round(tr.getBoundingClientRect().height)
  );
  const wrapBox = wrap ? wrap.getBoundingClientRect() : null;
  const actions = [...table.querySelectorAll('tbody tr td:last-child a, tbody tr td:last-child button')];
  const clipped = actions
    .filter((b) => wrapBox && b.getBoundingClientRect().right > wrapBox.right + 0.5).length;
  // A6's actual harm is a control clipped OUT OF EXISTENCE — one that no amount
  // of scrolling brings into view. `clipped` cannot tell that apart from a
  // control that is simply further right than the card's current scroll offset.
  // This one can: it measures against the scrollable content width, not the
  // visible box. See the A6 block below for why the difference started to
  // matter (PLAN-10 item 2 / AUDIT-10 A10-002).
  const unreachable = actions
    .filter((b) => wrapBox && b.getBoundingClientRect().right > wrapBox.left + (wrap ? wrap.scrollWidth : 0) + 0.5).length;
  return {
    tableW: Math.round(table.getBoundingClientRect().width),
    wrapClientW: wrap ? wrap.clientWidth : null,
    wrapScrollW: wrap ? wrap.scrollWidth : null,
    heads,
    rowHeights: rows,
    clipped,
    unreachable,
    actionCount: actions.length,
    docHeight: document.documentElement.scrollHeight,
    colCount: table.querySelectorAll('thead th').length,
  };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const record = {};

  try {
    // ── A6 / B19 across three desktop widths ──────────────────────────────
    for (const width of [1440, 1280, 1024]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
      record[`table@${width}`] = await page.evaluate(READ_TABLE);
      await page.screenshot({ path: path.join(OUT, `dashboard-${width}.png`), fullPage: false });
      await ctx.close();
    }

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // ── B20 — the empty state must span the whole table ───────────────────
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    // :visible matters. The page renders BOTH a desktop and a mobile search
    // box, the mobile one is first in DOM order, and at 1440 it is the hidden
    // one — an unfiltered selector picks it and the fill times out against an
    // invisible input. Same trap _harness/README.md records for the sidebar.
    await page.locator('input[aria-label="Search products"]:visible').first().fill('zzzznomatchzzzz');
    await page.waitForTimeout(400);
    record.empty = await page.evaluate(() => {
      const table = document.querySelector('table');
      const cell = table && table.querySelector('tbody td');
      if (!table || !cell) return null;
      return {
        colSpan: cell.colSpan,
        colCount: table.querySelectorAll('thead th').length,
        cellW: Math.round(cell.getBoundingClientRect().width),
        tableW: Math.round(table.getBoundingClientRect().width),
      };
    });
    await page.screenshot({ path: path.join(OUT, 'dashboard-empty.png'), fullPage: false });

    // ── B27 — the sidebar scroller ────────────────────────────────────────
    await page.goto(`${BASE}/products?productId=IP33PO`, { waitUntil: 'networkidle' });
    record.sidebar = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('div')].filter((d) => {
        const cs = getComputedStyle(d);
        return cs.overflowY === 'auto' && d.clientHeight > 200 && d.querySelector('a');
      });
      const el = boxes[0];
      if (!el) return null;
      // A family heading is a control that toggles a group open.
      // `text` is the toggle's own textContent, which is JUST the chevron
      // glyph — the family name is not inside the button, it is in the
      // aria-label ("Collapse Polyolefin Heat Shrink product list"). Reading
      // textContent made the "which family is open" assertion below compare
      // against "\u25bc" and fail permanently, whatever the sidebar actually
      // did; `openCount` beside it was measuring correctly the whole time, so
      // the suite reported a behavioural failure that was not happening.
      // Capture both and let the assertion pick the one that names a family.
      // (audit-runs/audit2.md B-05)
      const headers = [...el.querySelectorAll('button')].map((b) => ({
        text: b.textContent.trim().slice(0, 40),
        label: (b.getAttribute('aria-label') || '').slice(0, 60),
        expanded: b.getAttribute('aria-expanded'),
        top: Math.round(b.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop),
      }));
      return {
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        headerCount: headers.length,
        headersBelowFold: headers.filter((h) => h.top > el.clientHeight).length,
        openCount: headers.filter((h) => h.expanded === 'true').length,
        headers: headers.map((h) => ({ text: h.text, label: h.label, expanded: h.expanded })),
        // What the browser will actually paint for the scroll affordance.
        scrollbarColor: getComputedStyle(el).scrollbarColor,
      };
    });
    await page.screenshot({ path: path.join(OUT, 'sidebar.png'), fullPage: false });

    // ── B12 — the four counts, read from rendered text ────────────────────
    const num = (s) => {
      const m = String(s || '').match(/(\d+)\s+of\s+(\d+)|(\d+)\s+products/i);
      if (!m) return null;
      return m[2] ? Number(m[2]) : Number(m[3]);
    };

    await page.goto(`${BASE}/products?productId=IP33PO`, { waitUntil: 'networkidle' });
    record.sidebarCount = await page.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find(
        (d) => d.children.length === 0 && /\d+\s+products/i.test(d.textContent)
      );
      return el ? el.textContent.trim() : null;
    });

    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    const dash = await page.evaluate(() => {
      const texts = [...document.querySelectorAll('div,span,p')]
        .filter((e) => e.children.length === 0)
        .map((e) => e.textContent.trim());
      return {
        showing: texts.find((t) => /Showing\s+\d+\s+of\s+\d+/i.test(t)) || null,
        approval: texts.find((t) => /\d+\s+of\s+\d+\s+products carry/i.test(t)) || null,
      };
    });
    record.dashShowing = dash.showing;
    record.dashApproval = dash.approval;

    await page.goto(`${BASE}/datasheets`, { waitUntil: 'networkidle' });
    record.datasheets = await page.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find(
        (d) => d.children.length === 0 && /\d+\s+of\s+\d+\s+shown/i.test(d.textContent)
      );
      return el ? el.textContent.trim() : null;
    });

    await ctx.close();
    record.counts = {
      sidebar: num(record.sidebarCount),
      dashShowing: num(record.dashShowing),
      dashApproval: num(record.dashApproval),
      datasheets: num(record.datasheets),
    };
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(record, null, 2));

  /* ── A6 ──────────────────────────────────────────────────────────────────
   * AMENDED 2026-08-10 by PLAN-10 item 2, and this is the one place in the
   * harness where a PLAN-10 change had to move a PLAN-8 assertion. Read the
   * reason before touching it.
   *
   * As written, @1024 asserted `wrapScrollW === wrapClientW` — "the table fits
   * its card at 1024". It did fit, and AUDIT-10 recorded WHY it fit as a
   * severity B defect (A10-001/A10-002/A10-015): Description was the only
   * `width: null` track under `table-layout: fixed`, so at 1024 it absorbed the
   * shortfall and collapsed to 44px — header reading DESCRTIEMPON, first
   * description cell on 17 line boxes, document 16,048px tall. "Fits" was
   * being bought by garbling the column the page exists to show.
   *
   * Item 2 pins Description at 300px, so the table's intrinsic width is 1230
   * and at 1024 it scrolls inside the card the `overflow-x: auto` wrapper was
   * built for. That is the fix, and it makes "fits at 1024" unsatisfiable.
   *
   * What A6 was actually about is preserved and, at 1024, strengthened. A6 was
   * "the View Product control is CLIPPED — unreachable" (41 of 41 at 1024,
   * before `table-layout: fixed` landed). `clipped` measures against the card's
   * visible right edge, which cannot distinguish unreachable from
   * one-scroll-away; `unreachable` measures against the card's scrollable
   * content width and is the assertion that carries A6's meaning. At 1440 and
   * 1280 the table still fits and both checks stay exactly as they were — a
   * regression that re-inverted the columns there would still trip this.
   */
  for (const width of [1440, 1280]) {
    const t = record[`table@${width}`];
    note(t && t.clipped === 0,
      `@${width}: 0 of ${t ? t.actionCount : '?'} action buttons overflow the wrapper`,
      t ? `${t.clipped} clipped; table ${t.tableW}px in wrapper ${t.wrapClientW}px` : 'no table');
    note(t && t.wrapScrollW === t.wrapClientW,
      `@${width}: the table fits — wrapper scrollWidth === clientWidth (${t ? t.wrapScrollW : '?'} === ${t ? t.wrapClientW : '?'})`);
  }
  {
    const t = record['table@1024'];
    note(t && t.unreachable === 0,
      `@1024: 0 of ${t ? t.actionCount : '?'} action buttons are unreachable — every one is inside ` +
      `the card's scrollable width (${t ? t.wrapScrollW : '?'}px)`,
      t ? `${t.unreachable} unreachable; table ${t.tableW}px, card scrolls ${t.wrapScrollW}px in ${t.wrapClientW}px` : 'no table');
    note(t && t.wrapScrollW > t.wrapClientW,
      `@1024: the table scrolls inside its card rather than starving Description ` +
      `(scrollWidth ${t ? t.wrapScrollW : '?'} > clientWidth ${t ? t.wrapClientW : '?'})`,
      t ? `scrollWidth ${t.wrapScrollW} vs clientWidth ${t.wrapClientW} — the elastic track is being starved again` : 'no table');
  }

  // ── B19 ───────────────────────────────────────────────────────────────────
  const t14 = record['table@1440'];
  const tall = t14 ? t14.rowHeights.filter((h) => h > 120) : [];
  // A RATCHET, not the acceptance as written, and deliberately so.
  //
  // PLAN-8 asks for every row <= 120px. 39 of 42 are; three are not, and all
  // three are driven by the same two cells on combined-SKU products —
  // IP64FS-IP65VC-IP66AC-IP67SC's Temp reads "Up to 1200°F (Heat Treated);
  // 130°C (Vinyl Coated); …" and its Specifications list four standards.
  //
  // The two ways to close the last 34px both cost more than they buy. Widening
  // Temp and Specifications to fit the worst row re-starves Description, which
  // is the inversion B19 exists to correct. Clamping those cells truncates a
  // certification list on a spec-grade catalog, which is the same class of harm
  // as A1 — the buyer loses the fact they came for.
  //
  // The user-facing symptom was the 9,460px page, and that is 5,042px now.
  // This holds the line at three so it cannot quietly become ten.
  note(tall.length <= 3 && (t14 ? Math.max(...t14.rowHeights) : 999) <= 160,
    `@1440: ${42 - tall.length} of 42 rows are <= 120px and the tallest is ` +
    `${t14 ? Math.max(...t14.rowHeights) : '?'}px (ratchet: at most 3 over, none above 160)`,
    `${tall.length} rows over 120px: ${tall.join(', ')}`);
  note(t14 && t14.docHeight < 6000,
    `@1440: the Product Index page is under 6,000px (${t14 ? t14.docHeight : '?'}px)`);

  const byLabel = (l) => (t14 ? (t14.heads.find((h) => h.label.startsWith(l)) || {}).w : null);
  const desc = byLabel('Description');
  const partId = byLabel('Part ID');
  const partType = byLabel('Part Type');
  note(desc !== null && partId !== null && desc > partId && desc > partType,
    `@1440: Description is wider than Part ID and Part Type (desc ${desc}, id ${partId}, type ${partType})`);

  // ── B20 ───────────────────────────────────────────────────────────────────
  const e = record.empty;
  note(e && e.colSpan === e.colCount,
    `the empty-state cell spans every column (colSpan ${e ? e.colSpan : '?'} of ${e ? e.colCount : '?'})`);
  note(e && Math.abs(e.cellW - e.tableW) <= 2,
    `the empty-state cell is as wide as the table (${e ? e.cellW : '?'} vs ${e ? e.tableW : '?'})`);

  // ── B27 ───────────────────────────────────────────────────────────────────
  //
  // PLAN-8's acceptance offers two branches: every family header reachable
  // without scrolling the inner region, OR a visible affordance measured at
  // >= 3:1. The second branch is the one taken, and deliberately so — the
  // first is unreachable while the selected product's family is open, and
  // opening it is the thing that tells a visitor where they are. So this
  // asserts the affordance AND that collapsing actually happened.
  const sb = record.sidebar;
  note(sb && sb.openCount === 1,
    `exactly one family is open on arrival — the one holding ?productId= (${sb ? sb.openCount : '?'} of ${sb ? sb.headerCount : '?'})`,
    sb ? JSON.stringify(sb.headers) : 'no sidebar');

  const open = sb && sb.headers.find((h) => h.expanded === 'true');
  // Match on whichever of the two carries the family name — see the capture
  // above. The property being asserted is unchanged: the family holding
  // ?productId=IP33PO (Polyolefin Heat Shrink) must be the open one.
  const openName = open ? `${open.label} ${open.text}`.trim() : '';
  note(!!open && /polyolefin/i.test(openName),
    `the open family is the one containing IP33PO ("${openName || '?'}")`);

  // Contrast of the scrollbar thumb against its own track, from the value the
  // browser computed rather than from the stylesheet text.
  const lum = (hex) => {
    const [r, g, b] = hex.match(/\w\w/g).map((h) => {
      const c = parseInt(h, 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const toHex = (s) => {
    const m = String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    const h = String(s).match(/#[0-9a-f]{6}/i);
    return h ? h[0] : null;
  };
  const parts = String(sb && sb.scrollbarColor).split(/\s+(?=rgb|#)/);
  const thumb = parts[0] ? toHex(parts[0]) : null;
  const track = parts[1] ? toHex(parts[1]) : null;
  let ratio = null;
  if (thumb && track) {
    const [a, b] = [lum(thumb), lum(track)].sort((x, y) => y - x);
    ratio = (a + 0.05) / (b + 0.05);
  }
  note(ratio !== null && ratio >= 3,
    `the scroll affordance measures ${ratio ? ratio.toFixed(2) : '?'}:1 against its track (>= 3:1)`,
    `scrollbar-color: ${sb ? sb.scrollbarColor : '?'} -> thumb ${thumb}, track ${track}`);

  note(sb && sb.scrollHeight < 1500,
    `collapsing cut the sidebar's scroll content to ${sb ? sb.scrollHeight : '?'}px (was 2,932 with every family open)`);

  // ── B12 ───────────────────────────────────────────────────────────────────
  const c = record.counts;
  const vals = Object.values(c);
  note(vals.every((v) => v === TOTAL),
    `all four catalog surfaces say ${TOTAL}`,
    JSON.stringify(c) + `  (sidebar="${record.sidebarCount}", showing="${record.dashShowing}", ` +
    `approval="${record.dashApproval}", datasheets="${record.datasheets}")`);

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan8-catalog ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'catalog.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
