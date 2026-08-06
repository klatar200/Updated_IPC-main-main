/**
 * PLAN-2 4.13 — confirmation on the card ✕, and separation from ↑/↓.
 *
 * Before: the ✕ that removes an entire content card had no confirmation while
 * every other destructive admin action does, and it sat 6px from the reorder
 * arrows. Rick reorders far more often than he deletes, on a touch-capable
 * laptop, and a mis-click during reordering did not announce itself.
 *
 * Asserts, at 1440 and 375:
 *   - clicking ✕ raises a confirm() that NAMES the row
 *   - cancelling leaves the row, its fields, and the rest of the form intact
 *   - accepting removes the row
 *   - the measured edge-to-edge gap between ✕ and the nearest arrow is >= 24px
 *   - the touch hit target is >= 44px when the pointer is coarse
 *
 * Needs the mirror on :8123. Does not save, so data/ is never written.
 *
 * Usage: node _harness/plan2-delete.js
 */

const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const MIN_GAP = 24;
const MIN_TOUCH = 44;

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

async function signIn(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  return page;
}

/** Edge-to-edge gap between the ✕ and the nearest reorder button in the row. */
async function measureGap(page) {
  return page.$eval('.content-row', (row) => {
    const x = row.querySelector('[data-action="remove"]');
    const arrows = [...row.querySelectorAll('[data-action="up"], [data-action="down"]')];
    const xr = x.getBoundingClientRect();
    let best = Infinity;
    for (const a of arrows) {
      const ar = a.getBoundingClientRect();
      // Horizontal edge-to-edge distance; the tools row is a flex row.
      const gap = xr.left >= ar.right ? xr.left - ar.right : ar.left - xr.right;
      if (gap < best) best = gap;
    }
    return { gap: best, xWidth: xr.width, xHeight: xr.height };
  });
}

(async () => {
  const browser = await launch();

  try {
    for (const vp of [{ w: 1440, h: 900 }, { w: 375, h: 812 }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await signIn(ctx);
      await page.goto(`${BASE}/admin/content.php`, { waitUntil: 'domcontentloaded' });

      const m = await measureGap(page);
      note(m.gap >= MIN_GAP,
        `${vp.w}px: gap between ✕ and nearest reorder control is ${m.gap.toFixed(1)}px (>= ${MIN_GAP})`,
        `measured ${m.gap.toFixed(1)}px`);

      // ── the prompt names the row ──────────────────────────────────────────
      const rowName = await page.$eval('.content-row',
        (row) => { const f = row.querySelector('input.ci[type=text], textarea.ci'); return f ? f.value.trim() : ''; });

      let prompt = null;
      page.on('dialog', async (d) => { prompt = d.message(); await d.dismiss(); });

      const rowsBefore = await page.$$eval('.content-row', (r) => r.length);
      await page.click('.content-row [data-action="remove"]');
      await page.waitForTimeout(150);

      note(prompt !== null, `${vp.w}px: clicking ✕ raises a confirmation`);
      note(prompt !== null && rowName !== '' && prompt.includes(rowName),
        `${vp.w}px: the confirmation names the row ("${rowName}")`,
        `prompt was: ${JSON.stringify(prompt)}`);
      note(prompt !== null && !/^\s*Are you sure\??\s*$/i.test(prompt),
        `${vp.w}px: the confirmation is not a bare "Are you sure?"`);
      note(prompt !== null && /Backup/i.test(prompt),
        `${vp.w}px: the confirmation points at Backups as the undo path`,
        `prompt was: ${JSON.stringify(prompt)}`);

      // ── cancelling leaves everything alone ────────────────────────────────
      const rowsAfterCancel = await page.$$eval('.content-row', (r) => r.length);
      note(rowsAfterCancel === rowsBefore,
        `${vp.w}px: cancelling leaves the row in place (${rowsBefore} rows before, ${rowsAfterCancel} after)`);

      const nameAfterCancel = await page.$eval('.content-row',
        (row) => { const f = row.querySelector('input.ci[type=text], textarea.ci'); return f ? f.value.trim() : ''; });
      note(nameAfterCancel === rowName,
        `${vp.w}px: cancelling leaves the row's fields untouched`,
        `"${rowName}" -> "${nameAfterCancel}"`);

      // ── accepting removes it ──────────────────────────────────────────────
      page.removeAllListeners('dialog');
      page.on('dialog', async (d) => { await d.accept(); });
      await page.click('.content-row [data-action="remove"]');
      await page.waitForTimeout(150);
      const rowsAfterAccept = await page.$$eval('.content-row', (r) => r.length);
      note(rowsAfterAccept === rowsBefore - 1,
        `${vp.w}px: accepting removes exactly one row (${rowsBefore} -> ${rowsAfterAccept})`);

      await ctx.close();
    }

    // ── touch hit target ────────────────────────────────────────────────────
    // hasTouch makes (pointer: coarse) match, which is what the 44px rule keys on.
    const tctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const tpage = await signIn(tctx);
    await tpage.goto(`${BASE}/admin/content.php`, { waitUntil: 'domcontentloaded' });
    const t = await measureGap(tpage);
    note(t.xWidth >= MIN_TOUCH && t.xHeight >= MIN_TOUCH,
      `touch: ✕ hit target is ${t.xWidth}×${t.xHeight}px (>= ${MIN_TOUCH}×${MIN_TOUCH})`,
      `measured ${t.xWidth}×${t.xHeight}`);
    note(t.gap >= MIN_GAP,
      `touch: gap is ${t.gap.toFixed(1)}px (>= ${MIN_GAP})`);
    await tctx.close();
  } catch (e) {
    note(false, 'suite ran without throwing', e.message);
  } finally {
    await browser.close();
  }

  const failing = results.filter((r) => !r.ok).length;
  console.log(`\nplan2-delete ${results.length - failing}/${results.length}`);
  process.exit(failing === 0 ? 0 : 1);
})();
