/**
 * AUDIT-10 pass-1 /dashboard column-fit probe.
 *
 * pass-1 specific_attention: "/dashboard table at 1024: column fit without
 * horizontal scroll (font caveat applies)".
 *
 * DASHBOARD_COLS declares fixed widths for five of seven columns (190+105+115
 * +150+215 = 775px) and leaves Description and Action to share what is left,
 * on a `table-layout: fixed` table at `width: 100%`. At 1440 the leftovers are
 * comfortable; at 1024 they are not, and `table-layout: fixed` does not clip —
 * a word wider than its cell simply PAINTS OVER the next column.
 *
 * Measured here per viewport:
 *   - the resolved width of every column
 *   - every cell whose own content is wider than the cell (paint overflow)
 *   - every pair of horizontally adjacent cells whose painted text rectangles
 *     actually intersect (the visible overprint)
 *   - the wrapper's horizontal scroll
 * ...twice: as shipped (DejaVu Sans on this box) and with the document forced
 * to Liberation Sans, which is metric-compatible with Arial. An overprint that
 * survives the narrow face is structural, not the C49 font artifact.
 *
 * Output: _harness/out/audit10/p1dash.json  (gitignored)
 * Usage:  node _harness/audit10-p1dash.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10');
const URLS = [
  '/dashboard',
  '/dashboard?family=Tape',
  '/dashboard?family=' + encodeURIComponent('Heat Shrink Tubing'),
  '/dashboard?family=Adhesive',
];
const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
];

/* eslint-disable no-undef */
function measureTable() {
  const R = (n) => Math.round(n * 10) / 10;
  const table = document.querySelector('table');
  if (!table) return { noTable: true, bodyText: (document.body.textContent || '').replace(/\s+/g, ' ').slice(0, 200) };
  const wrap = table.parentElement;
  const wr = wrap.getBoundingClientRect();
  const headRow = table.querySelector('thead tr');
  const cols = headRow ? [...headRow.children].map((th) => {
    const r = th.getBoundingClientRect();
    return { label: (th.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24), w: R(r.width), x: R(r.left) };
  }) : [];

  // paint overflow: a cell whose content box is narrower than what it draws
  const overflowing = [];
  const overprints = [];
  const rows = [...table.querySelectorAll('tr')];
  for (const tr of rows) {
    const cells = [...tr.children];
    // painted extent of each cell = union of its own text/child rects
    const extents = cells.map((c) => {
      const cr = c.getBoundingClientRect();
      let right = cr.left, left = cr.right;
      const rng = document.createRange();
      for (const n of c.childNodes) {
        try {
          rng.selectNodeContents(n);
          for (const b of rng.getClientRects()) {
            if (b.width < 1) continue;
            if (b.right > right) right = b.right;
            if (b.left < left) left = b.left;
          }
        } catch (e) { /* non-selectable node */ }
      }
      for (const k of c.querySelectorAll('*')) {
        const b = k.getBoundingClientRect();
        if (b.width < 1) continue;
        if (b.right > right) right = b.right;
        if (b.left < left) left = b.left;
      }
      const csPad = getComputedStyle(c);
      return {
        cell: cr, paintedRight: right, paintedLeft: left,
        padR: parseFloat(csPad.paddingRight) || 0,
        text: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32),
      };
    });
    for (let i = 0; i < extents.length; i++) {
      const e = extents[i];
      const over = e.paintedRight - (e.cell.right - e.padR);
      if (over > 1 && overflowing.length < 60) {
        overflowing.push({
          col: i, cellW: R(e.cell.width), overflowPx: R(over),
          text: e.text, y: R(e.cell.top + window.scrollY),
        });
      }
      if (i + 1 < extents.length) {
        const n = extents[i + 1];
        const gap = n.paintedLeft - e.paintedRight;
        if (gap < 0 && overprints.length < 60) {
          overprints.push({
            colA: i, colB: i + 1, overlapPx: R(-gap),
            a: e.text, b: n.text, y: R(e.cell.top + window.scrollY),
          });
        }
      }
    }
  }
  return {
    wrapW: R(wr.width), tableW: R(table.getBoundingClientRect().width),
    scrollW: R(wrap.scrollWidth), cutX: R(wrap.scrollWidth - wrap.clientWidth),
    cols,
    rowCount: table.querySelectorAll('tbody tr').length,
    overflowingCells: overflowing.length, overflowSample: overflowing.slice(0, 8),
    overprintPairs: overprints.length, overprintSample: overprints.slice(0, 8),
    font: getComputedStyle(table).fontFamily.slice(0, 36),
  };
}
/* eslint-enable no-undef */

const FORCE = `*, *::before, *::after { font-family: "Liberation Sans", sans-serif !important; }`;

(async () => {
  const browser = await launch();
  const out = [];
  for (let pass = 0; pass < 2; pass++) {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      for (const url of URLS) {
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(500);
        const shipped = await page.evaluate(measureTable);
        await page.addStyleTag({ content: FORCE });
        await page.waitForTimeout(400);
        const narrow = await page.evaluate(measureTable);
        out.push({ pass: pass + 1, url, viewport: vp.name, shipped, narrow });
      }
      await ctx.close();
    }
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'p1dash.json'), JSON.stringify(out, null, 1));
  const p1 = out.filter((o) => o.pass === 1), p2 = out.filter((o) => o.pass === 2);
  const same = JSON.stringify(p1.map((o) => [o.url, o.viewport, o.shipped.overprintPairs, o.narrow.overprintPairs]))
    === JSON.stringify(p2.map((o) => [o.url, o.viewport, o.shipped.overprintPairs, o.narrow.overprintPairs]));
  console.log('identical across two navigations: ' + same);
  for (const o of p1) {
    console.log(`${o.viewport} ${o.url} :: shipped overprints=${o.shipped.overprintPairs} overflowCells=${o.shipped.overflowingCells} | LiberationSans overprints=${o.narrow.overprintPairs} overflowCells=${o.narrow.overflowingCells}`);
  }
  console.log('-> _harness/out/audit10/p1dash.json');
})();
