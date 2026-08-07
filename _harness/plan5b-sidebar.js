/**
 * sidebar-active-border — the selected product never gets its left indicator.
 *
 * `ProductSidebar`'s desktop product rows set
 *
 *     borderLeft: active ? "3px solid var(--brand-primary)" : "3px solid transparent",
 *     border: "none",
 *     borderBottom: "1px solid #f0f3f7",
 *
 * React writes style keys into `element.style` IN ORDER, so the `border`
 * shorthand three lines down resets all four sides and wipes the left border
 * that was just set. `borderBottom` survives only because it comes after.
 * The row divider therefore looks fine and the active indicator is simply
 * absent — which is why this went unnoticed.
 *
 * Pre-existing and NOT introduced by 4.21: identical at HEAD:src/App.jsx:5385
 * (`a0b07e1`), where the element was still a <button>. 4.21 only changed the
 * tag. `border: "none"` was there to drop the UA button chrome; on an <a> it
 * has nothing to reset, so it goes.
 *
 * A source scan finds this in one line, and one was run
 * (`borderLeft` followed by `border:` inside the same style object — 1 hit of
 * 11 `borderLeft` sites). But the assertions below are all COMPUTED STYLE from
 * the real browser, because the question "does the indicator paint" is not a
 * question about source order.
 *
 * Asserts at 1440 (the width the desktop sidebar exists at):
 *   - the ACTIVE row's border-left is 3px and the brand primary colour
 *   - INACTIVE rows keep a 3px TRANSPARENT left border, so selecting a row
 *     does not shift its text sideways
 *   - border-bottom is unchanged at 1px #f0f3f7
 *   - border-top and border-right stay 0 — removing the shorthand must not let
 *     a UA border back in
 *   - the indicator MOVES: click a sibling and the old row loses it
 *   - zero React style-conflict console errors, measured on a development
 *     React bundle (production strips them, so the shipped bundle cannot fail
 *     this check — same reason plan5-keys builds its own bundle)
 *
 * Reads only. Nothing under data/ is written.
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan5b-sidebar.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan5b-sidebar');
const SITE = path.join(__dirname, 'site');
const DEVDIST = path.join(__dirname, 'devdist');

// Polyolefin Heat Shrink — 12 siblings, so the group renders with plenty of rows.
const TARGET = 'IP29CG';
const SIBLING = 'IP30HS';
const BRAND_PRIMARY = 'rgb(0, 93, 163)';       // --brand-primary on the shipped palette
const ROW_DIVIDER = 'rgb(240, 243, 247)';      // #f0f3f7

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const sh = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const installBundle = (from) => {
  fs.rmSync(path.join(SITE, 'assets'), { recursive: true, force: true });
  fs.cpSync(from, SITE, { recursive: true });
};

/**
 * Every VISIBLE sidebar product row, with the border box the browser actually
 * computed.
 *
 * `:visible` matters: the same <aside> holds BOTH the desktop list and the
 * mobile grid, so every product href matches twice and at 1440 the mobile copy
 * is the hidden one — and it is first in DOM order. An unfiltered selector
 * measures the wrong element and, worse, Playwright's click times out on it.
 */
const rows = (page, selected) =>
  page.evaluate((sel) =>
    [...document.querySelectorAll('aside a[href^="/products?productId="]')]
      .filter((a) => a.getClientRects().length > 0)
      .map((a) => {
      const cs = getComputedStyle(a);
      return {
        href: a.getAttribute('href'),
        active: a.getAttribute('href') === `/products?productId=${sel}`,
        left: `${cs.borderLeftWidth} ${cs.borderLeftStyle} ${cs.borderLeftColor}`,
        leftWidth: cs.borderLeftWidth,
        leftColor: cs.borderLeftColor,
        topWidth: cs.borderTopWidth,
        rightWidth: cs.borderRightWidth,
        bottom: `${cs.borderBottomWidth} ${cs.borderBottomStyle} ${cs.borderBottomColor}`,
      };
    }), selected);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  let devBuilt = false;

  try {
    // ── the indicator itself, on the bundle that ships ─────────────────────
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/products?productId=${TARGET}`, { waitUntil: 'networkidle' });

    const all = await rows(page, TARGET);
    const act = all.filter((r) => r.active);
    const inact = all.filter((r) => !r.active);

    note(act.length === 1,
      `exactly one sidebar row is the selected product (${TARGET}) — ${all.length} rows visible`,
      JSON.stringify(all.map((r) => r.href)));

    if (act.length === 1) {
      note(act[0].leftWidth === '3px',
        `the selected row has a 3px left indicator (computed ${act[0].leftWidth})`,
        act[0].left);
      note(act[0].leftColor === BRAND_PRIMARY,
        `the indicator is the brand primary (computed ${act[0].leftColor})`,
        `expected ${BRAND_PRIMARY}, got ${act[0].left}`);
      note(act[0].topWidth === '0px' && act[0].rightWidth === '0px',
        'no UA border crept back in on the top or right edge',
        `top ${act[0].topWidth}, right ${act[0].rightWidth}`);
      note(act[0].bottom === `1px solid ${ROW_DIVIDER}`,
        `the row divider is unchanged (${act[0].bottom})`);
    }

    note(inact.length > 0 && inact.every((r) => r.leftWidth === '3px'),
      'inactive rows keep a 3px TRANSPARENT left border, so selecting one cannot shift its text',
      JSON.stringify(inact.slice(0, 3).map((r) => r.left)));
    note(inact.every((r) => /rgba\(0, 0, 0, 0\)|transparent/.test(r.leftColor)),
      'and that border really is transparent, not a visible line on every row',
      JSON.stringify([...new Set(inact.map((r) => r.leftColor))]));

    // ── it MOVES ──────────────────────────────────────────────────────────
    await page.locator(`aside a[href="/products?productId=${SIBLING}"]:visible`).first().click();
    await page.waitForTimeout(500);
    const after = await page.evaluate((sel) =>
      [...document.querySelectorAll('aside a[href^="/products?productId="]')]
        .filter((a) => a.getClientRects().length > 0)
        .map((a) => ({
          href: a.getAttribute('href'),
          w: getComputedStyle(a).borderLeftWidth,
          c: getComputedStyle(a).borderLeftColor,
        })).filter((r) => r.href.endsWith(sel[0]) || r.href.endsWith(sel[1])), [TARGET, SIBLING]);
    const nowActive = after.filter((r) => r.c === BRAND_PRIMARY).map((r) => r.href);
    note(nowActive.length === 1 && nowActive[0].endsWith(SIBLING),
      `selecting ${SIBLING} moves the indicator off ${TARGET} and onto it`,
      JSON.stringify(after));

    await page.goto(`${BASE}/products?productId=${TARGET}`, { waitUntil: 'networkidle' });
    const el = await page.locator(`aside a[href="/products?productId=${TARGET}"]:visible`).first();
    if (await el.count()) await el.screenshot({ path: path.join(OUT, 'active-row-1440.png') });
    await page.screenshot({ path: path.join(OUT, 'sidebar-1440.png'), clip: { x: 0, y: 200, width: 420, height: 700 } });
    await ctx.close();

    // ── React's own complaint, on a development bundle ─────────────────────
    {
      console.log('    (building a development-React bundle — see _harness/vite.devreact.js)');
      sh('npx', ['vite', 'build', '--config', '_harness/vite.devreact.js', '--outDir', '_harness/devdist', '--emptyOutDir']);
      devBuilt = true;
      installBundle(DEVDIST);

      const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const dpage = await dctx.newPage();
      const hits = [];
      dpage.on('console', (m) => {
        const t = m.text();
        if (/conflicting property|Updating a style property/i.test(t)) hits.push(`${m.type()}: ${t.slice(0, 160)}`);
      });
      await dpage.goto(`${BASE}/products?productId=${TARGET}`, { waitUntil: 'networkidle' });
      // The warning fires on a RE-RENDER that changes the longhand, so the
      // selection has to actually move for it to be reachable.
      await dpage.locator(`aside a[href="/products?productId=${SIBLING}"]:visible`).first().click();
      await dpage.waitForTimeout(600);
      await dpage.locator(`aside a[href="/products?productId=${TARGET}"]:visible`).first().click();
      await dpage.waitForTimeout(600);
      note(hits.length === 0,
        'zero React style-conflict console messages when the selection changes',
        `${hits.length} seen:\n         ${[...new Set(hits)].join('\n         ')}`);
      await dctx.close();
    }
  } finally {
    if (devBuilt) {
      sh('npm', ['run', 'build']);
      installBundle(path.join(ROOT, 'dist'));
      fs.rmSync(DEVDIST, { recursive: true, force: true });
    }
    await browser.close();
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan5b-sidebar: ${results.length - bad}/${results.length}`);
  console.log(`screenshots -> ${OUT}`);
  process.exit(bad ? 1 : 0);
})();
