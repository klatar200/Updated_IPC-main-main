/**
 * PLAN-9 item 1 — the FIRST Page Content save must not delete the marketing
 * photographs. (Audit 2026-08-09 finding 1, severity A.)
 *
 * The shipped data/content.json predates PLAN-7 item 3a and has no
 * copy.siteImages key. Before the fix, content.php prefilled the five Site
 * Images fields with `?? ''` so they rendered EMPTY, and the save loop wrote
 * every configured field back — so Rick's first save of anything materialized
 * siteImages as five "" values, which COPY_CLEARABLE keeps as deliberate
 * deletions: every marketing photo and the homepage band section vanished
 * under a green "Saved".
 *
 * The fix is admin-side only: each of the five fields carries a 'default'
 * that prefills ONLY when the key is absent from the stored file. A stored
 * "" (a real clearing) still shows empty and stays cleared.
 *
 * Derived from _harness/aud9-clearrepro.js (which is the audit's evidence and
 * must not be edited). Needs the mirror on :8123.
 *
 * Usage: node _harness/plan9-firstsave.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const CONTENT = path.join(__dirname, 'site', 'data', 'content.json');
const PRISTINE = path.join(__dirname, 'pristine', 'content.json');
const OUT = path.join(__dirname, 'out', 'plan9');

// Byte-identical to COPY_DEFAULTS.siteImages in src/App.jsx and to the
// 'default' entries in admin/content.php's $COPY_GROUPS — the pairing that
// lint.php's photo-default drift check holds.
const DEFAULTS = {
  heroPhoto: 'images/site/Marker-Sample-2.jpg',
  bandTeamPhoto: 'images/site/staff.jpg',
  bandBuildingPhoto: 'images/site/IPC-Building.jpg',
  aboutPhoto: 'images/site/IPC-Building.jpg',
  servicesPhoto: 'images/site/Marker-Sample-2.jpg',
};

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/** What the homepage paints, in a FRESH context so no HTTP cache interferes. */
async function homeState(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?_=' + Date.now(), { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
  });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => ({
    siteImgs: [...document.querySelectorAll('img')].map((i) => i.getAttribute('src')).filter((s) => /images\/site\//.test(s || '')),
    bandSection: !!document.querySelector('figure img[src*="staff"], figure img[src*="IPC-Building"]'),
    teamPainted: !!document.querySelector('img[src*="staff"]'),
    // A cleared slot must leave no empty framed box behind (plan7-slots).
    emptyFigures: [...document.querySelectorAll('figure, picture')]
      .filter((f) => !f.querySelector('img') && f.getBoundingClientRect().height > 4).length,
  }));
  await ctx.close();
  return r;
}

async function adminPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
  if (await page.$('input[type="password"]')) {
    await page.fill('input[type="password"]', PASS);
    await Promise.all([page.waitForNavigation(), page.click('button[type="submit"], input[type="submit"]')]);
  }
  await page.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
  return { ctx, page };
}

async function saveForm(page) {
  await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]:has-text("Save")')]);
  const banner = await page.locator('.alert-success').textContent().catch(() => null);
  return banner ? banner.trim() : null;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // ── 1. the pre-3a shape: pristine content.json has NO copy.siteImages ───
  fs.copyFileSync(PRISTINE, CONTENT);
  const parsed = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
  note(!(parsed.copy && parsed.copy.siteImages),
    'pristine content.json (the first-deploy shape) has no copy.siteImages key',
    'key present: ' + JSON.stringify(parsed.copy && parsed.copy.siteImages));

  const browser = await launch();

  // ── 2. the homepage paints its three photographs ────────────────────────
  const before = await homeState(browser);
  note(before.siteImgs.length === 3 && before.bandSection,
    'before any save, / paints 3 images/site/ photos and the band section',
    JSON.stringify(before));

  // ── 3. the admin prefills the five Site Images fields with the defaults ─
  const admin = await adminPage(browser);
  const fields = await admin.page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll('input[name^="copy[siteImages]"]')]
      .map((i) => [i.name.replace(/^copy\[siteImages\]\[(.*)\]$/, '$1'), i.value])));
  const wrong = Object.entries(DEFAULTS).filter(([k, v]) => fields[k] !== v);
  note(Object.keys(fields).length === 5 && wrong.length === 0,
    'content.php prefills the five Site Images fields with the default paths, not empty',
    'saw ' + JSON.stringify(fields));

  // ── 4. Rick's smallest realistic edit: one stray space, then Save ───────
  const SEL = 'input[name="copy\\[hero\\]\\[headlineLine1\\]"]';
  const orig = await admin.page.inputValue(SEL);
  await admin.page.fill(SEL, orig + ' ');
  const banner = await saveForm(admin.page);
  note(!!banner && /saved/i.test(banner), 'the save succeeds with the green banner', JSON.stringify(banner));

  // ── 5. the photographs survive that save ────────────────────────────────
  const after = await homeState(browser);
  note(after.siteImgs.length === 3 && after.bandSection,
    'after the first save, / still paints 3 photos and the band section survives',
    JSON.stringify(after));

  // ── 6. content.json now holds the five keys with the default paths ──────
  const savedJson = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
  const si = (savedJson.copy || {}).siteImages || {};
  const bad = Object.entries(DEFAULTS).filter(([k, v]) => si[k] !== v);
  note(bad.length === 0,
    'content.json now holds the five siteImages keys with the default paths',
    'saw ' + JSON.stringify(si));

  // ── 7. clearing still clears: an emptied field is a deliberate deletion ─
  await admin.page.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
  await admin.page.fill('input[name="copy\\[siteImages\\]\\[bandTeamPhoto\\]"]', '');
  const banner2 = await saveForm(admin.page);
  const cleared = await homeState(browser);
  note(!!banner2 && !cleared.teamPainted && cleared.emptyFigures === 0,
    'clearing bandTeamPhoto removes the team figure from / and leaves no empty framed box',
    JSON.stringify({ banner: banner2, teamPainted: cleared.teamPainted, emptyFigures: cleared.emptyFigures }));
  await admin.ctx.close();
  await browser.close();

  // ── 8. leave the mirror exactly as this script found it ─────────────────
  fs.copyFileSync(PRISTINE, CONTENT);
  const restored = fs.readFileSync(CONTENT).equals(fs.readFileSync(PRISTINE));
  note(restored, 'mirror content.json restored from pristine, byte-identical');

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nplan9-firstsave ${pass}/${results.length}`);
  fs.writeFileSync(path.join(OUT, 'firstsave.json'), JSON.stringify(results, null, 2));
  process.exit(pass === results.length ? 0 : 1);
})();
