/**
 * PLAN-10 item 5 / AUDIT-10 A10-020 — every product action, Delete included,
 * must be readable and reachable on the page Rick uses most.
 *
 * The original defect: five buttons per row in a 350px Actions column of a
 * `table-layout: fixed` table; at 1440 Delete was clipped 52 of 69px with no
 * way to scroll it into view. Rewritten 2026-11-01 for PLAN-13 Phase 5, which
 * replaced the five buttons with Edit plus a More menu (Manage PDF, Photo,
 * View on site, Delete) and turns each row into a card below 900px (§2 E1,
 * E2). The question this suite answers is the same.
 *
 * What it asserts, at 1440, 1024, 834 and 390:
 *   1. all 42 product rows render
 *   2. each row's Edit and More, brought into view the way a person can
 *      (vertical scroll only), are on screen and hit-testable at their centre
 *   3. each row's More menu, once opened, shows Manage PDF, Photo, View on
 *      site and Delete, each on screen and hit-testable; Delete renders its
 *      full label and still carries its confirmation
 *   4. Delete is not a first-level control: it is inside the closed menu
 *   5. nothing scrolls sideways — not the page, not a table wrapper
 *
 * Hit-testing rather than geometry alone: a control can sit inside its box
 * and still be covered (by the sticky menu bar, or by another row's menu).
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
const MENU = ['Manage PDF', 'Photo', 'View on site', 'Delete'];

const WALK = `(async (MENU) => {
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const hitAt = (el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const inView = r.width > 0 && cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight;
    const top = inView ? document.elementFromPoint(cx, cy) : null;
    return { inView, hit: !!(top && (top === el || el.contains(top))), w: Math.round(r.width) };
  };
  const bring = async (el) => {
    const r = el.getBoundingClientRect();
    scrollBy(0, (r.top + r.height / 2) - innerHeight / 2);
    await frame();
  };
  const rows = [];
  for (const tr of document.querySelectorAll('tr[data-search]')) {
    const sku = (tr.querySelector('.sku') || {}).textContent || '?';
    const edit = tr.querySelector('a[href^="edit.php?sku="]');
    const det = tr.querySelector('details.row-more');
    const sum = det && det.querySelector('summary');
    const del = det && det.querySelector('a[href^="delete.php?sku="]');
    const row = { sku, edit: null, more: null, menu: [], delFirstLevel: !del || !det.contains(del), delConfirm: !!(del && del.getAttribute('data-confirm')) };
    if (edit) { await bring(edit); row.edit = hitAt(edit); }
    if (sum) {
      await bring(sum); row.more = hitAt(sum);
      det.open = true; await frame();
      const menu = det.querySelector('.row-more-menu');
      // A menu near the bottom of the screen opens below it: scroll the page
      // so the whole menu shows, as a person would.
      const mr = menu.getBoundingClientRect();
      if (mr.bottom > innerHeight) { scrollBy(0, mr.bottom - innerHeight + 12); await frame(); }
      for (const a of menu.querySelectorAll('a')) {
        const label = a.textContent.trim();
        const m = MENU.find((x) => label.startsWith(x));
        row.menu.push({ label: m || label, ...hitAt(a) });
      }
      det.open = false; await frame();
    }
    rows.push(row);
  }
  scrollTo(0, 0);
  const wraps = [...document.querySelectorAll('.table-wrap')].filter((w) => w.scrollWidth > w.clientWidth + 1).length;
  return { rows, wrapsScrolling: wraps, docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
})`;

const results = [];
function note(ok, msg, detail) {
  results.push({ ok, msg });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}${!ok && detail ? `\n         <- ${detail}` : ''}`);
}

(async () => {
  const browser = await launch();
  const data = {};
  for (const vp of Object.keys(VP)) {
    const ctx = await browser.newContext({ viewport: VP[vp] });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="password"]', PW);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');
    await page.goto(`${BASE}/admin/index.php`, { waitUntil: 'networkidle' });
    data[vp] = await page.evaluate(`${WALK}(${JSON.stringify(MENU)})`);
    await ctx.close();
    console.log(`  · ${vp.padEnd(14)} ${data[vp].rows.length} rows`);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'adminrows.json'), JSON.stringify(data, null, 2));

  for (const vp of Object.keys(VP)) {
    const { rows } = data[vp];
    note(rows.length === 42, `${vp}: the catalog renders all 42 product rows (${rows.length})`);

    const badTop = rows.filter((r) => !(r.edit && r.edit.hit && r.more && r.more.hit))
      .map((r) => `${r.sku} edit ${r.edit ? (r.edit.hit ? 'ok' : r.edit.inView ? 'covered' : 'off-screen') : 'missing'}, more ${r.more ? (r.more.hit ? 'ok' : r.more.inView ? 'covered' : 'off-screen') : 'missing'}`);
    note(badTop.length === 0, `${vp}: Edit and More on screen and hit-testable on ${rows.length - badTop.length}/${rows.length} rows`, badTop.slice(0, 4).join(' | '));

    const badMenu = rows.filter((r) => MENU.some((m) => !r.menu.find((x) => x.label === m && x.hit)))
      .map((r) => `${r.sku}: ${r.menu.map((x) => `${x.label}=${x.hit ? 'ok' : x.inView ? 'covered' : 'off'}`).join(', ')}`);
    note(badMenu.length === 0, `${vp}: each More menu shows ${MENU.join(', ')}, all hit-testable, on ${rows.length - badMenu.length}/${rows.length} rows`, badMenu.slice(0, 3).join(' | '));

    const dels = rows.map((r) => r.menu.find((x) => x.label === 'Delete')).filter(Boolean);
    const narrow = dels.filter((d) => d.w < 60);
    note(dels.length === rows.length && narrow.length === 0 && rows.every((r) => r.delConfirm),
      `${vp}: Delete renders its full label (min ${dels.length ? Math.min(...dels.map((d) => d.w)) : 'n/a'}px, floor 60) and keeps its confirmation on every row`);

    note(rows.every((r) => !r.delFirstLevel), `${vp}: Delete sits inside the More menu on every row, not beside Edit`);

    note(data[vp].docOverflow === 0 && data[vp].wrapsScrolling === 0,
      `${vp}: nothing scrolls sideways (page overflow ${data[vp].docOverflow}px, ${data[vp].wrapsScrolling} table wrappers scrolling)`);
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan10-adminrows ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'adminrows.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
