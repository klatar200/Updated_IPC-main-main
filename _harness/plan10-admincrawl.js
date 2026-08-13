/**
 * PLAN-10 — the admin dashboard screenshot crawl.
 *
 * The companion to `plan10-crawl.js`, which deliberately covers the public site
 * only. That left phase D's four fixes — A10-020, A10-021, A10-022, A10-027 —
 * with no visual record at all, which is the gap this closes. Output lands in
 * `<set>/admin/` so one directory holds the whole site and the public set's
 * filenames are untouched.
 *
 * SIGN-IN. Every page here is behind `require_auth()`, so the crawl signs in
 * once per context with the mirror credential (`audit-pass-123`, written by
 * `sh _harness/sync.sh`). If `_harness/site/admin/config.local.php` is absent
 * the sign-in silently fails and every page shoots the LOGIN FORM instead —
 * 39 screenshots that all look plausible and are all wrong. The crawl asserts
 * it reached an authenticated page and exits non-zero if it did not, rather
 * than trusting the redirect.
 *
 * CAPTURES, in two groups:
 *
 *   the page set    twelve authenticated pages at 390x844 / 834x1112 /
 *                   1440x900, full-page, plus the signed-out login form.
 *   the states set  the frames where a phase D change is actually visible.
 *                   `delete.php` and `upload-*.php` need a `?sku=`, and
 *                   `upload-image.php` is the page that carries the MOST nav
 *                   items (13 — it injects two $navExtra links, more than
 *                   edit.php or upload-pdf.php at 12), so it is the real worst
 *                   case for A10-021 and is shot deliberately.
 *
 * Read-only. Nothing here submits a form, so no `data/*.json`, `pdfs/` or
 * `uploads/` write is possible and no pristine restore is owed. The two POST
 * pages that would mutate state (`delete.php`, the upload handlers) are opened
 * at their CONFIRMATION step and never confirmed.
 *
 * Usage:
 *   node _harness/plan10-admincrawl.js            # everything
 *   node _harness/plan10-admincrawl.js pages
 *   node _harness/plan10-admincrawl.js states
 *
 * Env: CRAWL_BASE, CRAWL_OUT, CRAWL_FONT=liberation — as plan10-crawl.js.
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
  path.join(__dirname, 'out', 'plan10-crawl', 'admin');
const PW = 'audit-pass-123';

const FORCE = `*, *::before, *::after { font-family: "Liberation Sans", sans-serif !important; }`;
const FORCE_FONT = process.env.CRAWL_FONT === 'liberation';

const D = { width: 1440, height: 900 };
const T = { width: 834, height: 1112, mobile: true };
const M = { width: 390, height: 844, mobile: true };
const T1024 = { width: 1024, height: 768 };

// A representative SKU for the pages that require one. IP38FE is the product
// plan10-crawl.js and plan10-repalette.js both drive, so every set agrees.
const SKU = 'IP38FE';

// All twelve authenticated pages. `nav.php` is a partial, not a page.
const PAGES = [
  { slug: 'index',        url: '/admin/index.php',  note: 'item 5 (A10-020) — the Delete button used to be clipped to a 17px sliver on all 42 rows' },
  { slug: 'add',          url: '/admin/add.php' },
  { slug: 'edit',         url: `/admin/edit.php?sku=${SKU}` },
  { slug: 'settings',     url: '/admin/settings.php' },
  { slug: 'content',      url: '/admin/content.php', note: 'item 8 (A10-027) — the subtitle used to claim the form edits only the homepage' },
  { slug: 'inquiries',    url: '/admin/inquiries.php' },
  { slug: 'backups',      url: '/admin/backups.php' },
  { slug: 'audit-log',    url: '/admin/audit-log.php', note: 'item 8 (A10-027) — every content save used to be logged as "Homepage content updated"' },
  { slug: 'password',     url: '/admin/password.php' },
  { slug: 'help',         url: '/admin/help.php', note: 'item 7 (A10-022) — this page used to render 689px wide in a 390px viewport' },
  { slug: 'upload-pdf',   url: `/admin/upload-pdf.php?sku=${SKU}` },
  { slug: 'upload-image', url: `/admin/upload-image.php?sku=${SKU}`, note: 'item 6 (A10-021) — 13 nav items, the most of any page and the real worst case' },
];

const PAGE_VPS = [D, T, M];

const STATES = [
  {
    slug: 'index-actions', vp: D, url: '/admin/index.php', full: false,
    note: 'item 5 — Delete now sits inside the table, on a wrapped second line',
    // Put the first row's action cell in view rather than shooting the page
    // top, which is a stats bar.
    act: async (page) => {
      await page.locator('table tbody tr').first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      return (await page.locator('table tbody tr td:nth-child(5) a, table tbody tr td:nth-child(5) button').count()) >= 5;
    },
  },
  {
    slug: 'index-actions', vp: T1024, url: '/admin/index.php', full: false,
    note: 'item 5 — the width where widening the column would still have clipped Delete',
    act: async (page) => {
      await page.locator('table tbody tr').first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      return true;
    },
  },
  {
    slug: 'nav-13-items', vp: M, url: `/admin/upload-image.php?sku=${SKU}`, full: false,
    note: 'item 6 — the header containing 13 nav items at 390; it used to spill above and below the bar',
    act: async (page) => {
      await page.evaluate('window.scrollTo(0, 0)');
      await page.waitForTimeout(200);
      return (await page.locator('.ipc-admin-header nav a, .ipc-admin-header nav button').count()) === 13;
    },
  },
  {
    slug: 'help-tables', vp: M, url: '/admin/help.php', full: false,
    note: 'item 7 — a reference table with both columns readable at 390',
    act: async (page) => {
      await page.locator('table.field-ref').nth(1).scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      // >= 2, not === 11. This asserted an exact census of help.php's reference
      // tables, and the page has carried 12 since at least 40cc51b — so the
      // state was never reached and the suite CRASHED ("STATE NOT REACHED")
      // rather than reporting a soft miss, taking the whole run with it.
      // What this state actually needs is that a second table exists to scroll
      // to; the count of the others is help.php's business, not this shot's.
      // (audit-runs/audit3.md C-05)
      return (await page.locator('table.field-ref').count()) >= 2;
    },
  },
  {
    slug: 'delete-confirm', vp: D, url: `/admin/delete.php?sku=${SKU}`, full: true,
    note: 'the destructive path, at its confirmation step — never confirmed',
    act: async (page) => (await page.locator('form').count()) > 0,
  },
];

async function settle(page) {
  await page.evaluate(`(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
  })()`);
  await page.waitForTimeout(400);
}

// Sign in, then PROVE it. A failed sign-in renders the login form at every URL,
// which photographs perfectly well and is worthless.
async function signedIn(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    ...(vp.mobile ? { hasTouch: true, isMobile: true } : {}),
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  await page.goto(`${BASE}/admin/index.php`, { waitUntil: 'networkidle' });
  const authed = await page.evaluate(`!!document.querySelector('.ipc-admin-header')`);
  if (!authed) {
    await ctx.close();
    throw new Error(
      'sign-in failed — every shot would be the login form. Run `sh _harness/sync.sh` ' +
      'to recreate _harness/site/admin/config.local.php, which is deleted at the end of every session.'
    );
  }
  return { ctx, page };
}

async function go(page, url) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  if (FORCE_FONT) await page.addStyleTag({ content: FORCE });
  await page.waitForTimeout(500);
  await settle(page);
}

const which = process.argv[2] || 'all';
let shot = 0;

(async () => {
  const browser = await launch();
  fs.mkdirSync(OUT, { recursive: true });

  if (which === 'all' || which === 'pages') {
    for (const vp of PAGE_VPS) {
      const { ctx, page } = await signedIn(browser, vp);
      for (const p of PAGES) {
        await go(page, p.url);
        const stillAuthed = await page.evaluate(`!!document.querySelector('.ipc-admin-header')`);
        const file = path.join(OUT, `${p.slug}__${vp.width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const h = await page.evaluate('document.body.scrollHeight');
        console.log(`  ${p.slug.padEnd(14)} ${String(vp.width).padStart(4)}  full-page  ${String(h).padStart(6)}px  ` +
                    `${stillAuthed ? '' : 'NOT AUTHENTICATED'}`);
        if (!stillAuthed) process.exitCode = 1;
        shot++;
      }
      await ctx.close();
    }

    // The signed-out login form — the one admin page with no header, and the
    // first thing the owner sees.
    for (const vp of [D, M]) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1,
        ...(vp.mobile ? { hasTouch: true, isMobile: true } : {}),
      });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'networkidle' });
      if (FORCE_FONT) await page.addStyleTag({ content: FORCE });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `auth-signed-out__${vp.width}.png`), fullPage: true });
      console.log(`  ${'auth-signed-out'.padEnd(14)} ${String(vp.width).padStart(4)}  full-page`);
      shot++;
      await ctx.close();
    }
  }

  if (which === 'all' || which === 'states') {
    const dir = path.join(OUT, 'states');
    fs.mkdirSync(dir, { recursive: true });
    for (const s of STATES) {
      const { ctx, page } = await signedIn(browser, s.vp);
      await go(page, s.url);
      let ok = true;
      if (s.act) ok = await s.act(page);
      const file = path.join(dir, `${s.slug}__${s.vp.width}.png`);
      await page.screenshot({ path: file, fullPage: !!s.full });
      console.log(`  states/${s.slug.padEnd(20)} ${String(s.vp.width).padStart(4)}  ` +
                  `${s.full ? 'full-page ' : 'viewport  '} ${ok ? 'state ok' : 'STATE NOT REACHED'}`);
      if (!ok) process.exitCode = 1;
      shot++;
      await ctx.close();
    }
  }

  await browser.close();
  console.log(`\n${shot} shots -> ${OUT}${FORCE_FONT ? '  [Liberation Sans forced]' : ''}`);
})();
