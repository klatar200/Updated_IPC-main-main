/**
 * Lows batch D — the admin's JavaScript: NEW-N2-5, N2-6, N2-7, N2-14
 * (audit-runs/audit-2026-09-27.md).
 *
 * Own `php -S` on :8720 over the mirror, a real browser signed in to the
 * admin, JavaScript on (these are all JS-side defects). 7 checks:
 *   N2-5   a size table whose header colspan is wider than its sub labels,
 *          and one whose rows are wider than its header, both survive an
 *          ordinary Save with every cell (they were cut to the header width)
 *   N2-6   "Paste from Excel" keeps a quoted cell with a line break as ONE
 *          cell; control: a plain tab-separated paste is unchanged
 *   N2-7   removing a column arms the unsaved-changes guard
 *   N2-14  the Products search finds a name with a capital non-ASCII letter
 *          from a lower- or upper-case query
 * Restores the mirror's catalog from pristine/ in a finally.
 *
 *   node _harness/lowsD-admin.js
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { launch } = require('./browser');

const SITE = path.join(__dirname, 'site');
const DATA = path.join(SITE, 'data');
const PRISTINE = path.join(__dirname, 'pristine');
const PORT = 8720;
const BASE = `http://127.0.0.1:${PORT}`;

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};
const catalog = () => JSON.parse(fs.readFileSync(path.join(DATA, 'products-all.json'), 'utf8'));
const restore = () => {
  fs.copyFileSync(path.join(PRISTINE, 'products-all.json'), path.join(DATA, 'products-all.json'));
  for (const x of fs.readdirSync(DATA)) if (/\.backup\./.test(x)) fs.rmSync(path.join(DATA, x));
};
const withProduct = (sku, patch) => {
  const p = JSON.parse(fs.readFileSync(path.join(PRISTINE, 'products-all.json'), 'utf8'));
  Object.assign(p.find((x) => x.sku === sku), patch);
  fs.writeFileSync(path.join(DATA, 'products-all.json'), JSON.stringify(p, null, 4));
};

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`lowsD-admin: port ${PORT} is already in use — stop that server first`);
    process.exit(2);
  }
  restore();
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, '-c', path.join(__dirname, 'php-mail.ini'),
    path.join(__dirname, 'router.php')], { cwd: SITE, stdio: 'ignore' });
  let browser = null;
  try {
    browser = await launch();
    await new Promise((r) => setTimeout(r, 800));
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept().catch(() => {}));
    await page.goto(`${BASE}/admin/auth.php`);
    await page.fill('input[type="password"]', 'audit-pass-123');
    await Promise.all([page.waitForLoadState('networkidle'), page.locator('button[type="submit"]').first().click()]);
    const saveEdit = async () => Promise.all([page.waitForLoadState('networkidle'),
      page.locator('form:has(input[name="orig_sig"]) button[type="submit"]').first().click()]);

    // ── N2-5 ──
    for (const [label, table] of [
      ['a header colspan wider than its sub labels', { columnSpans: [{ label: 'Size' }, { label: 'Dims', colspan: 3, sub: ['ID', 'OD'] }], rows: [['1', 'a', 'b', 'c'], ['2', 'd', 'e', 'f']] }],
      ['rows wider than the header', { columnSpans: [{ label: 'Size' }, { label: 'ID' }], rows: [['1', 'a', 'extra1'], ['2', 'b', 'extra2']] }],
    ]) {
      withProduct('CC', { specTable2: table });
      await page.goto(`${BASE}/admin/edit.php?sku=CC`, { waitUntil: 'networkidle' });
      await saveEdit();
      const st = catalog().find((p) => p.sku === 'CC').specTable2 || {};
      const cells = JSON.stringify(st.rows || []);
      const want = table.rows.flat();
      note(want.every((c) => cells.includes(`"${c}"`)), `N2-5: ${label} — every cell survives an ordinary Save`, `rows now ${cells}`);
      restore();
    }

    // ── N2-6 ──
    const pasteAndRead = async (tsv) => {
      await page.goto(`${BASE}/admin/edit.php?sku=CC`, { waitUntil: 'networkidle' });
      await page.locator('button[data-a="paste"]').first().click();
      await page.locator('.ste-pastebox').first().fill(tsv);
      await page.locator('[data-p="fill"]').first().click();
      await page.waitForTimeout(150);
      return JSON.parse(await page.locator('#specTable2_json').inputValue());
    };
    const t1 = await pasteAndRead('Size\t"Wall\nThickness"\tColor\n1/8"\t0.02\tBlack\n1/4"\t0.03\tRed');
    const heads = (t1.columnSpans || []).map((c) => c.label);
    note(heads.length === 3 && heads[1] === 'Wall\nThickness' && (t1.rows || []).length === 2 && t1.rows[1][2] === 'Red',
      'N2-6: a quoted cell with a line break stays ONE cell and the rows stay aligned', JSON.stringify(t1).slice(0, 160));
    const t2 = await pasteAndRead('A\tB\n1\t2\n3\t4');
    note(JSON.stringify((t2.columnSpans || []).map((c) => c.label)) === '["A","B"]' && JSON.stringify(t2.rows) === '[["1","2"],["3","4"]]',
      'N2-6: control — a plain tab-separated paste is unchanged', JSON.stringify(t2));

    // ── N2-7 ── fresh page, no typing: only the column removal
    await page.goto(`${BASE}/admin/edit.php?sku=IP35KY`, { waitUntil: 'networkidle' });
    const rm = page.locator('[data-act="delgrp"]').first();
    const hasCol = (await rm.count()) > 0;
    if (hasCol) await rm.click();
    let prompted = false;
    const onDialog = (d) => { if (d.type() === 'beforeunload') prompted = true; };
    page.on('dialog', onDialog);
    await page.close({ runBeforeUnload: true });
    await new Promise((r) => setTimeout(r, 500));
    note(hasCol && prompted, 'N2-7: removing a spec-table column arms the unsaved-changes guard', `column found ${hasCol}, prompted ${prompted}`);
    const page2 = await ctx.newPage();

    // ── N2-14 ──
    withProduct('CC', { name: 'Ölbeständig Conduit Connector' });
    await page2.goto(`${BASE}/admin/index.php`, { waitUntil: 'networkidle' });
    const box = page2.locator('input[type="search"], #product-search, input[placeholder*="earch"]').first();
    const visibleRows = () => page2.$$eval('tr[data-search]', (trs) => trs.filter((t) => t.offsetParent !== null && getComputedStyle(t).display !== 'none').length);
    for (const q of ['ölbest', 'ÖLBEST']) {
      await box.fill(q);
      await page2.waitForTimeout(200);
      note((await visibleRows()) === 1, `N2-14: the Products search finds "Ölbeständig…" from "${q}"`, `${await visibleRows()} rows shown`);
    }
    restore();
  } finally {
    if (browser) await browser.close();
    srv.kill();
    restore();
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nlowsD-admin ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
