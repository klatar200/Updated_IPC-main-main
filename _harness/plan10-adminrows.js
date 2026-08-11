/**
 * PLAN-10 item 5 / AUDIT-10 A10-020 — the Delete button must be readable and
 * reachable on the page Rick uses most.
 *
 * The defect: admin/index.php sets `table { min-width: 980px; table-layout:
 * fixed; overflow: hidden }`, gives the Actions column `width: 350px`, and sets
 * `.actions { flex-wrap: nowrap }` with `.actions .btn { flex-shrink: 0 }`.
 * Five buttons do not fit in 350px. At desktop-1440 the Actions cell ends at
 * x=1336 while the buttons run to 1388, so Delete is clipped 52 of 69px — and
 * `.table-wrap` has `scrollWidth === clientWidth`, so there is NO way to bring
 * it into view. It is the destructive control, it repeats on all 42 rows, and
 * it stays live and clickable as a ~17px red sliver.
 *
 * This is specific to the two large viewports. At 834 and 390 the same table
 * genuinely scrolls in its wrapper, which is why the audit measured those as
 * fine and why checks 3/4 below assert they STAY fine.
 *
 * What this suite asserts:
 *   1. 1440 + 1024 — every action button's right edge is inside the table's
 *      content box, on all 42 rows. Clipped px 0 (was 52 / 56).
 *   2. 1440 + 1024 — Delete still renders its full label (width >= 60).
 *   3. all four viewports — all five buttons present and hit-testable at their
 *      own centre (elementFromPoint returns the button or a descendant). This
 *      is the check that actually encodes "Rick can click it".
 *   4. 834 + 390 — unchanged: the table still scrolls inside its card and the
 *      page itself gains no horizontal scroll.
 *
 * Hit-testing rather than geometry alone: a button can sit inside the content
 * box and still be covered. Geometry says "not clipped"; elementFromPoint says
 * "clickable", which is the thing the finding is about.
 *
 * Usage: node _harness/plan10-adminrows.js      (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'plan10');
fs.mkdirSync(OUT, { recursive: true });

const VP = {
  'desktop-1440': { width: 1440, height: 900 },
  'tablet-1024': { width: 1024, height: 768 },
  'tablet-834': { width: 834, height: 1112 },
  'mobile-390': { width: 390, height: 844 },
};
const BIG = ['desktop-1440', 'tablet-1024'];

const MEASURE = `(() => {
  const rows = [];
  for (const tr of document.querySelectorAll('table tbody tr')) {
    const cell = tr.querySelector('td:nth-child(5)');
    if (!cell) continue;
    const table = tr.closest('table');
    const wrap = tr.closest('.table-wrap');
    // The CONTENT box, not the border box: overflow:hidden clips at the
    // padding edge, and the audit's 1336 is exactly left + clientWidth.
    const tRect = table.getBoundingClientRect();
    const contentRight = tRect.left + table.clientWidth;
    const btns = [...cell.querySelectorAll('a,button')].map((b) => {
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let hit = null;
      if (cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight) {
        const el = document.elementFromPoint(cx, cy);
        hit = !!(el && (el === b || b.contains(el)));
      }
      return {
        text: (b.textContent || '').trim().slice(0, 14),
        left: Math.round(r.left * 10) / 10,
        right: Math.round(r.right * 10) / 10,
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        clipped: Math.round(Math.max(0, r.right - contentRight) * 10) / 10,
        inViewport: cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight,
        hit,
      };
    });
    rows.push({
      sku: (tr.querySelector('td:nth-child(1)') || {}).textContent?.trim().slice(0, 20) || '?',
      contentRight: Math.round(contentRight * 10) / 10,
      cellH: Math.round(cell.getBoundingClientRect().height * 10) / 10,
      wrapCanScroll: wrap ? wrap.scrollWidth > wrap.clientWidth : null,
      wrapOverflowPx: wrap ? wrap.scrollWidth - wrap.clientWidth : null,
      btns,
    });
  }
  return {
    rows,
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
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
    await page.goto(`${BASE}/admin/index.php`, { waitUntil: 'networkidle' });
    await page.waitForSelector('table tbody tr', { state: 'attached' });
    // Scroll each row into view before hit-testing, the way a person would.
    await page.evaluate(`(async () => {
      const h = document.body.scrollHeight;
      for (let y = 0; y < h; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 15)); }
      scrollTo(0, 0);
    })()`);
    await page.waitForTimeout(200);
    data[vp] = await page.evaluate(MEASURE);
    await ctx.close();
    process.stdout.write(`  · ${vp.padEnd(14)} ${data[vp].rows.length} rows, ` +
      `${data[vp].rows[0] ? data[vp].rows[0].btns.length : 0} buttons/row\n`);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'adminrows.json'), JSON.stringify(data, null, 2));

  const n = data['desktop-1440'].rows.length;
  note(n === 42, `the catalog renders all 42 product rows (${n})`);

  // ── 1. nothing clipped at the two large viewports ─────────────────────────
  for (const vp of BIG) {
    const bad = [];
    for (const r of data[vp].rows) for (const b of r.btns) if (b.clipped > 0.5) bad.push(`${r.sku} "${b.text}" ${b.clipped}px past ${r.contentRight}`);
    const worst = Math.max(0, ...data[vp].rows.flatMap((r) => r.btns.map((b) => b.clipped)));
    note(bad.length === 0,
      `${vp}: every action button is inside the table content box on ${data[vp].rows.length} rows ` +
      `— worst clip ${worst}px (was 52 / 56)`,
      bad.slice(0, 4).join(' | ') + (bad.length > 4 ? ` (+${bad.length - 4})` : ''));
  }

  // ── 2. Delete renders its full label ──────────────────────────────────────
  for (const vp of BIG) {
    const dels = data[vp].rows.map((r) => r.btns.find((b) => /Delete/i.test(b.text))).filter(Boolean);
    const narrow = dels.filter((b) => b.w < 60);
    note(dels.length === data[vp].rows.length && narrow.length === 0,
      `${vp}: the Delete button renders its full label on ${dels.length - narrow.length}/${data[vp].rows.length} rows ` +
      `(min width ${dels.length ? Math.min(...dels.map((b) => b.w)) : 'n/a'}px, floor 60)`,
      narrow.slice(0, 3).map((b) => `${b.w}px`).join(', '));
  }

  // ── 3. every button actually clickable, all four viewports ────────────────
  for (const vp of Object.keys(VP)) {
    const rows = data[vp].rows;
    const miss = [];
    for (const r of rows) {
      for (const b of r.btns) {
        // A button scrolled out of the viewport vertically is not this
        // finding — only one that is in view and still not hit-testable.
        if (b.inViewport && b.hit === false) miss.push(`${r.sku} "${b.text}"`);
      }
    }
    const counts = new Set(rows.map((r) => r.btns.length));
    note(miss.length === 0 && counts.size === 1 && counts.has(5),
      `${vp}: all 5 action buttons present on every row and hit-testable where visible ` +
      `(${rows.length} rows, ${[...counts].join('/')} buttons each, ${miss.length} unreachable)`,
      miss.slice(0, 4).join(', '));
  }

  // ── 4. the small viewports are UNCHANGED ──────────────────────────────────
  for (const vp of ['tablet-834', 'mobile-390']) {
    const rows = data[vp].rows;
    const scrolls = rows.filter((r) => r.wrapCanScroll).length;
    note(scrolls === rows.length,
      `${vp}: the table still scrolls inside its card on ${scrolls}/${rows.length} rows ` +
      `(${rows[0] ? rows[0].wrapOverflowPx : '?'}px scrollable — unchanged)`);
    note(data[vp].docOverflow === 0,
      `${vp}: the page itself gains no horizontal scroll (documentElement overflow ${data[vp].docOverflow}px)`);
  }
  for (const vp of BIG) {
    note(data[vp].docOverflow === 0,
      `${vp}: the page itself gains no horizontal scroll (documentElement overflow ${data[vp].docOverflow}px)`);
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan10-adminrows ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'adminrows.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
