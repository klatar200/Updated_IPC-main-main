/**
 * PLAN-7 item 3a — the image slots read owner-editable URLs.
 *
 * Item 2 put four photographs on the page at hardcoded paths, which fixes the
 * symptom and not the review item: the owner has photographs he cannot put
 * anywhere, and four fixed paths fix that for the four files *I* chose.
 *
 * The whole risk is the CLEAR case, and it is not the obvious one.
 * `mergeContent` deliberately DROPS a blank string so a cleared heading falls
 * back to its default — an empty page title is worse than a stale one, and you
 * cannot re-enter a heading you cannot see. That is right for text and exactly
 * wrong for an image: clearing a photo must REMOVE it, not silently restore
 * the one the owner just deleted. The escape hatch already exists
 * (COPY_CLEARABLE) and these keys have to be in it.
 *
 * So this suite drives three states per slot against the real merge path, by
 * serving an edited content.json:
 *
 *   default  — key absent      -> the shipped photograph
 *   override — key set         -> the owner's file
 *   cleared  — key ""          -> NO IMAGE, and no layout left behind
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan7-slots.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan7');
const PRISTINE = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine', 'content.json'), 'utf8'));

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/** slot key -> the route it paints on and the file it ships by default. */
const SLOTS = [
  { key: 'heroPhoto', route: '/', dflt: 'Marker-Sample-2.jpg', label: 'hero right column' },
  { key: 'bandTeamPhoto', route: '/', dflt: 'staff.jpg', label: 'homepage band, team' },
  { key: 'bandBuildingPhoto', route: '/', dflt: 'IPC-Building.jpg', label: 'homepage band, building' },
  { key: 'aboutPhoto', route: '/about', dflt: 'IPC-Building.jpg', label: 'About story column' },
  { key: 'servicesPhoto', route: '/services', dflt: 'Marker-Sample-2.jpg', label: 'Services band' },
];

/** Serve a content.json with `siteImages` patched, then read what painted. */
async function withCopy(browser, patch, route) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**/data/content.json*', (r) => {
    const json = JSON.parse(JSON.stringify(PRISTINE));
    json.copy = json.copy || {};
    if (patch === null) delete json.copy.siteImages;
    else json.copy.siteImages = { ...(json.copy.siteImages || {}), ...patch };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 25)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(700);
  const out = await page.evaluate(() => ({
    imgs: [...document.querySelectorAll('img')]
      .map((i) => ({ src: i.getAttribute('src') || '', w: Math.round(i.getBoundingClientRect().width) }))
      .filter((i) => /images\/site\//.test(i.src)),
    // A cleared slot must leave no empty framed box behind.
    emptyFigures: [...document.querySelectorAll('figure, picture')]
      .filter((f) => !f.querySelector('img') && f.getBoundingClientRect().height > 4).length,
  }));
  await ctx.close();
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();

  // ── default: no siteImages key at all, i.e. a fresh install ─────────────
  for (const route of ['/', '/about', '/services']) {
    const r = await withCopy(browser, null, route);
    const want = SLOTS.filter((s) => s.route === route);
    const missing = want.filter((s) => !r.imgs.some((i) => i.src.endsWith(s.dflt)));
    note(missing.length === 0,
      `3a default: with no siteImages key, ${route} still paints its shipped photographs`,
      `missing ${missing.map((m) => m.dflt).join(', ')} — saw ${r.imgs.map((i) => i.src).join(', ')}`);
  }

  // ── override: the owner points a slot at a different file ───────────────
  for (const s of SLOTS) {
    const other = s.dflt === 'staff.jpg' ? 'IPC-Building.jpg' : 'staff.jpg';
    const r = await withCopy(browser, { [s.key]: `images/site/${other}` }, s.route);
    note(r.imgs.some((i) => i.src.endsWith(other)),
      `3a override: ${s.key} (${s.label}) renders the owner's file`,
      `wanted ${other}, saw ${r.imgs.map((i) => i.src).join(', ')}`);
  }

  // ── cleared: "" must REMOVE the image, not fall back to the default ─────
  // This is the case mergeContent gets right for headings and would get
  // exactly wrong here without COPY_CLEARABLE.
  for (const s of SLOTS) {
    const r = await withCopy(browser, { [s.key]: '' }, s.route);
    const stillThere = r.imgs.filter((i) => i.src.endsWith(s.dflt));
    // Another slot on the same route may legitimately use the same file.
    const sameFileElsewhere = SLOTS.some(
      (o) => o.key !== s.key && o.route === s.route && o.dflt === s.dflt
    );
    note(sameFileElsewhere ? true : stillThere.length === 0,
      `3a CLEAR: ${s.key} (${s.label}) emptied removes the photo — no silent re-seed`,
      `${stillThere.length} still painting ${s.dflt}`);
  }

  // Clearing everything must leave no empty framed boxes behind.
  const allCleared = Object.fromEntries(SLOTS.map((s) => [s.key, '']));
  for (const route of ['/', '/about', '/services']) {
    const r = await withCopy(browser, allCleared, route);
    note(r.imgs.length === 0 && r.emptyFigures === 0,
      `3a CLEAR: with every slot emptied, ${route} paints no photo and leaves no empty frame`,
      `${r.imgs.length} images, ${r.emptyFigures} empty figures`);
  }

  await browser.close();

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nplan7-slots ${pass}/${results.length}`);
  fs.writeFileSync(path.join(OUT, 'slots.json'), JSON.stringify(results, null, 2));
  console.log(`record -> ${path.join(OUT, 'slots.json')}`);
  process.exit(pass === results.length ? 0 : 1);
})();
