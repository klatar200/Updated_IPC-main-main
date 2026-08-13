/**
 * PLAN-10 — the public-site screenshot crawl.
 *
 * Produces the committed set in `site-screenshots/<date>-after-plan10/`, which
 * exists to be diffed against the owner's own "before" set from the previous
 * version of the site. Unlike `plan10-shot.js` — whose output lives in the
 * gitignored `_harness/out/` and dies with the container — this set is a
 * tracked artifact, so the crawl that made it has to be re-runnable rather than
 * reconstructed from a shell history six months from now.
 *
 * CAPTURES, in two groups:
 *
 *   the page set    ten public routes plus one representative product detail,
 *                   at 390x844 / 834x1112 / 1440x900, full-page.
 *   the states set  the six frames where a PLAN-10 change is actually visible.
 *                   Three of those are about where the viewport sits relative
 *                   to a fixed element (the sticky header, the dropdown panel,
 *                   the drawer), so they are shot VIEWPORT-ONLY: Playwright's
 *                   fullPage compositor paints a position:fixed element once at
 *                   the top of the tall image, which would erase the very thing
 *                   the frame is evidence of. `full: false` marks those.
 *
 * Public routes only. The admin is not crawled here — see the set's README.
 *
 * Usage:
 *   node _harness/plan10-crawl.js                 # everything
 *   node _harness/plan10-crawl.js pages           # the page set only
 *   node _harness/plan10-crawl.js states          # the states set only
 *
 * Env:
 *   CRAWL_BASE=http://127.0.0.1:8123   server to crawl
 *   CRAWL_OUT=<dir>                    output root (default: the committed set)
 *   CRAWL_FONT=liberation              force the metric-standard face. `fc-match
 *                                      system-ui` resolves to DejaVu Sans on
 *                                      this image, ~21% wider than the real
 *                                      face, so any width difference against
 *                                      the before-set must be re-measured this
 *                                      way before it is called a defect. Same
 *                                      FORCE rule audit10-p1font.js uses.
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = process.env.CRAWL_BASE || 'http://127.0.0.1:8123';
// DEFAULT OUT is _harness/out/ (gitignored), NOT the dated folder under
// site-screenshots/.
//
// That folder is a TRACKED historical record — 83 PNGs captured on 2026-08-11
// and referenced by name in WHATS_LEFT.md. Writing there by default meant that
// merely RUNNING this suite rewrote 40+ tracked files in place, under a date
// they were no longer from, and left the working tree dirty; anyone who then
// committed would have replaced the record with a re-shoot while keeping its
// old name. Measured 2026-08-13: one run dirtied 40 tracked screenshots.
//
// Set CRAWL_OUT explicitly when the intent really is to regenerate the record.
// (audit-runs/audit3.md C-06)
const OUT = process.env.CRAWL_OUT ||
  path.join(__dirname, 'out', 'plan10-crawl');

const FORCE = `*, *::before, *::after { font-family: "Liberation Sans", sans-serif !important; }`;
const FORCE_FONT = process.env.CRAWL_FONT === 'liberation';

// Widths are the filename suffix, so the two sets sort against each other on
// route first and viewport second.
const D = { width: 1440, height: 900 };
const T = { width: 834, height: 1112, mobile: true };
const M = { width: 390, height: 844, mobile: true };
const T1024 = { width: 1024, height: 768 };

const ROUTES = [
  { slug: 'home',           url: '/' },
  { slug: 'products',       url: '/products' },
  { slug: 'industries',     url: '/industries' },
  { slug: 'services',       url: '/services' },
  { slug: 'about',          url: '/about' },
  { slug: 'faq',            url: '/faq' },
  { slug: 'contact',        url: '/contact' },
  { slug: 'datasheets',     url: '/datasheets' },
  { slug: 'dashboard',      url: '/dashboard' },
  { slug: 'privacy',        url: '/privacy' },
  // One representative product rather than all 42. IP38FE is the same product
  // plan10-repalette.js drives.
  { slug: 'product-IP38FE', url: '/products?productId=IP38FE' },
];

const PAGE_VPS = [D, T, M];

// The opening helpers for the dropdown and the drawer are lifted from
// plan10-repalette.js STATES, which already handles the hover-then-click
// fallback and the timing.
const STATES = [
  {
    slug: 'product-IP38FE', vp: M, url: '/products?productId=IP38FE', full: true,
    note: 'item 1 — the product title used to paint on top of its own buttons',
  },
  {
    slug: 'dashboard', vp: T1024, url: '/dashboard', full: true,
    note: 'items 2 and 3 — the Description column used to collapse and garble',
  },
  {
    slug: 'dashboard', vp: T, url: '/dashboard', full: true,
    note: 'items 2 and 3 — the Description column used to collapse and garble',
  },
  {
    slug: 'contact-failed-submit', vp: M, url: '/contact', full: false,
    note: 'item 4 — the invalid field used to scroll behind the sticky header',
    // Submit the RFQ tab with everything empty: the browser then focuses the
    // first invalid control, which is input[name=name] / "Full Name *". Same
    // repro plan10-rfqscroll.js drives, so the frame and the suite agree.
    act: async (page) => {
      const submit = page.locator('form button[type="submit"]').first();
      await submit.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await submit.click().catch(() => {});
      await page.waitForTimeout(900);
      return page.evaluate(`(() => {
        const el = document.querySelector('form input[name=name]');
        return !!el && document.activeElement === el;
      })()`);
    },
  },
  {
    slug: 'home-megadropdown', vp: D, url: '/', full: false,
    note: 'phase C — the dropdown panel now follows the palette (accent tints)',
    act: async (page) => {
      const btn = page.locator('button[aria-haspopup="true"]').first();
      await btn.hover().catch(() => {});
      await page.waitForTimeout(250);
      if (!(await page.locator('.ipc-dropdown-panel').count())) await btn.click().catch(() => {});
      await page.waitForTimeout(400);
      return (await page.locator('.ipc-dropdown-panel').count()) > 0;
    },
  },
  {
    slug: 'home-drawer', vp: M, url: '/', full: false,
    note: 'phase C — the phone menu drawer surface now follows the palette',
    act: async (page) => {
      await page.click('button[aria-label="Open menu"]').catch(() => {});
      await page.waitForTimeout(500);
      return (await page.locator('[role="dialog"]').count()) > 0;
    },
  },
];

// Scroll the page so lazy/in-view content has painted before we shoot, then
// return to the top. Lifted from plan10-repalette.js settle().
async function settle(page) {
  await page.evaluate(`(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
  })()`);
  await page.waitForTimeout(400);
}

async function open(browser, vp, url) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    ...(vp.mobile ? { hasTouch: true, isMobile: true } : {}),
  });
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  if (FORCE_FONT) await page.addStyleTag({ content: FORCE });
  await page.waitForTimeout(600);
  await settle(page);
  return { ctx, page };
}

const which = process.argv[2] || 'all';
let shot = 0;

(async () => {
  const browser = await launch();
  fs.mkdirSync(OUT, { recursive: true });

  if (which === 'all' || which === 'pages') {
    for (const r of ROUTES) {
      for (const vp of PAGE_VPS) {
        const { ctx, page } = await open(browser, vp, r.url);
        const file = path.join(OUT, `${r.slug}__${vp.width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const h = await page.evaluate('document.body.scrollHeight');
        console.log(`  ${r.slug.padEnd(16)} ${String(vp.width).padStart(4)}  full-page  ${h}px tall`);
        shot++;
        await ctx.close();
      }
    }
  }

  if (which === 'all' || which === 'states') {
    const dir = path.join(OUT, 'states');
    fs.mkdirSync(dir, { recursive: true });
    for (const s of STATES) {
      const { ctx, page } = await open(browser, s.vp, s.url);
      let ok = true;
      if (s.act) ok = await s.act(page);
      const file = path.join(dir, `${s.slug}__${s.vp.width}.png`);
      await page.screenshot({ path: file, fullPage: !!s.full });
      console.log(`  states/${s.slug.padEnd(24)} ${String(s.vp.width).padStart(4)}  ` +
                  `${s.full ? 'full-page ' : 'viewport  '} ${ok ? 'state ok' : 'STATE NOT REACHED'}`);
      if (!ok) process.exitCode = 1;
      shot++;
      await ctx.close();
    }
  }

  await browser.close();
  console.log(`\n${shot} shots -> ${OUT}${FORCE_FONT ? '  [Liberation Sans forced]' : ''}`);
})();
