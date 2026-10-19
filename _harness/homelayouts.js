/**
 * Home layouts — the homepage under every shape the owner can give it.
 * (Home-layouts audit 2026-10-19.)
 *
 * Each variant is made through the REAL admin — Page Content's row editor
 * (content-editor.js), Site Images & Logo's Remove Photo, Business Details —
 * from a pristine mirror, then / is rendered at 375, 834, 1440 and 1920 and
 * checked for: page/console errors, 4xx/5xx and failed requests, horizontal
 * scroll, broken images, "undefined"/"NaN"/"{datasheets}"-style leaks, empty
 * hrefs and headings, collapsed or overlapping grid items, and PHP warnings.
 *
 * Plus the three defects the audit found and fixed:
 *  - the trust ticker's seam: at the end of a cycle the track must still
 *    reach the rail's right edge (the shipped nine items ran ~400px short at
 *    2560; three items ran short at 834);
 *  - the stat and certification icons on a pale palette (#e8f4ff painted
 *    them at 1.03:1 — invisible); they take --brand-primary-text now, the
 *    footer's keep --brand-primary;
 *  - an emptied stat strip and an emptied proof-point column leave nothing
 *    behind (a 1px bordered section; 64px of dead hero below lg).
 *
 * Not asserted, on purpose: the stat strip's dividers with more than four
 * items (Page Content says "works best with exactly 4"), and a single
 * unbroken word longer than a phone card (e.g. "Polytetrafluoroethylene" as
 * a market name spills ~45px at 375). Both are recorded in WHATS_LEFT.
 *
 * Needs the mirror on :8123 and php -S logging to _harness/out/php8123.log
 * if PHP warnings are to be read (skipped when that file is absent).
 * Usage: node _harness/homelayouts.js [variant-prefix]
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const SITE = path.join(__dirname, 'site');
const PRISTINE = path.join(__dirname, 'pristine');
const OUT = path.join(__dirname, 'out', 'homelayouts');
const PHPLOG = path.join(__dirname, 'out', 'php8123.log');
const WIDTHS = [375, 834, 1440, 1920];
const LISTS = ['features', 'stats', 'markets', 'heroProofPoints', 'heroTrust'];

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

function restore() {
  for (const f of ['content.json', 'site-info.json', 'products-all.json'])
    fs.copyFileSync(path.join(PRISTINE, f), path.join(SITE, 'data', f));
}

/* ------------------------------------------------------------ admin */
async function login(page) {
  await page.goto(BASE + '/admin/auth.php');
  await page.fill('input[type="password"]', 'audit-pass-123');
  await Promise.all([page.waitForNavigation(), page.click('button[type="submit"], input[type="submit"]')]);
}
const flash = (page) => page.evaluate(() => [...document.querySelectorAll('.alert, .alert-success, .alert-error, .alert-info')]
  .map((e) => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 160)).join(' | '));
async function submitBy(page, label) {
  await Promise.all([
    page.waitForNavigation(),
    page.evaluate((label) => {
      const b = [...document.querySelectorAll('button[type="submit"]')].find((x) => new RegExp(label).test(x.textContent));
      b.form.requestSubmit(b);
    }, label),
  ]);
  return flash(page);
}
// Page Content row helpers, run inside content.php against content-editor.js.
const HELPERS = `
  const rows = (s) => [...document.querySelectorAll('[data-section="' + s + '"] .rows > *')];
  const removeAll = (s) => { for (let n = 0; n < 200; n++) { const b = document.querySelector('[data-section="' + s + '"] .rows [data-action="remove"]'); if (!b) break; b.click(); } };
  const keep = (s, k) => { while (rows(s).length > k) rows(s).at(-1).querySelector('[data-action="remove"]').click(); };
  const add = (s, vals) => {
    (document.querySelector('[data-action="add"][data-section="' + s + '"]') || document.querySelector('[data-section="' + s + '"] [data-action="add"]')).click();
    const row = rows(s).at(-1);
    for (const [k, v] of Object.entries(vals)) { const el = row.querySelector('[data-field="' + k + '"]'); if (el) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } }
  };
  const dupe = (s, n) => { const vals = {}; rows(s)[0].querySelectorAll('[data-field]').forEach((el) => { vals[el.getAttribute('data-field')] = el.value; }); for (let i = 0; i < n; i++) add(s, vals); };
  const set = (s, i, k, v) => { const el = rows(s)[i].querySelector('[data-field="' + k + '"]'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
`;
async function content(page, body) {
  await page.goto(BASE + '/admin/content.php');
  await page.evaluate(new Function(HELPERS + body));
  return submitBy(page, 'Save Content');
}
async function removePhoto(page, slot) {
  await page.goto(BASE + '/admin/site-images.php');
  await Promise.all([
    page.waitForNavigation(),
    page.evaluate((slot) => [...document.querySelectorAll('form')].find((f) =>
      f.querySelector('input[name="slot"][value="' + slot + '"]') && f.querySelector('input[name="action"][value="remove"]')).requestSubmit(), slot),
  ]);
  return flash(page);
}
async function settings(page, vals) {
  await page.goto(BASE + '/admin/settings.php');
  await page.evaluate((vals) => { for (const [k, v] of Object.entries(vals)) { const el = document.querySelector('[name="' + k + '"]'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } }, vals);
  return submitBy(page, 'Save');
}

const LONG = 'Supercalifragilisticexpialidocious Thermoplastic Elastomer Insulation Sleeving';
const PALE = { theme_primary: '#e8f4ff', theme_dark: '#f2f2f2', theme_accent: '#fff6cc', theme_accent2: '#ffe0f0' };
const VARIANTS = [
  ['00-baseline', async () => []],
  ['01-no-hero-photo', async (p) => [await removePhoto(p, 'heroPhoto')]],
  ['02-band-building-only', async (p) => [await removePhoto(p, 'bandTeamPhoto')]],
  ['03-band-team-only', async (p) => [await removePhoto(p, 'bandBuildingPhoto')]],
  ['04-no-photos', async (p) => [await removePhoto(p, 'heroPhoto'), await removePhoto(p, 'bandTeamPhoto'), await removePhoto(p, 'bandBuildingPhoto')]],
  ['05-all-lists-empty', async (p) => [await content(p, `for (const s of ${JSON.stringify(LISTS)}) removeAll(s);`)]],
  ['06-one-of-each', async (p) => [await content(p, `for (const s of ${JSON.stringify(LISTS)}) keep(s, 1);`)]],
  ['07-three-of-each', async (p) => [await content(p, `for (const s of ${JSON.stringify(LISTS)}) keep(s, 3);`)]],
  ['08-many-rows', async (p) => [await content(p, `dupe('features', 7); dupe('stats', 4); dupe('markets', 6); dupe('heroProofPoints', 4); dupe('heroTrust', 10);`)]],
  // Long text with break opportunities (spaces): a real owner sentence, not
  // the single-word case the header excludes.
  ['09-long-text', async (p) => [await content(p, `
     const L = ${JSON.stringify(LONG)};
     set('features', 0, 'title', L); set('features', 1, 'description', (L + ' ').repeat(6));
     set('stats', 0, 'value', '1,000,000,000+'); set('stats', 0, 'label', L);
     set('markets', 0, 'label', L); set('heroProofPoints', 0, 'stat', '99,999,999'); set('heroProofPoints', 0, 'label', L);
     set('heroTrust', 0, 'text', L + ' ' + L);`)]],
  ['10-reordered', async (p) => [await content(p, `
     for (const s of ['features', 'markets', 'stats', 'heroProofPoints']) { rows(s).at(-1).querySelector('[data-action="up"]').click(); rows(s)[1].querySelector('[data-action="up"]').click(); }`)]],
  ['11-pale-palette-no-min-fax-iso', async (p) => [await settings(p, { ...PALE, stats_min: '', contact_fax: '', cert_iso: '' })]],
  ['12-dark-palette', async (p) => [await settings(p, { theme_primary: '#1a1a1a', theme_dark: '#000000', theme_accent: '#ff0000', theme_accent2: '#550000' })]],
  ['13-minimal-everything', async (p) => [
    await removePhoto(p, 'heroPhoto'), await removePhoto(p, 'bandTeamPhoto'), await removePhoto(p, 'bandBuildingPhoto'),
    await content(p, `for (const s of ${JSON.stringify(LISTS)}) removeAll(s);`),
    await settings(p, { stats_min: '', contact_fax: '', cert_iso: '' })]],
];

/* ------------------------------------------------------------ public */
async function render(browser, w) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
  page.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', (r) => errs.push('failed ' + r.url()));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}

function pageChecks() {
  const vw = document.documentElement.clientWidth;
  const o = { overflow: document.documentElement.scrollWidth - vw, broken: [], bad: [], residue: [] };
  for (const img of document.images) if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) o.broken.push(img.getAttribute('src'));
  const txt = document.body.innerText;
  for (const re of [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /\bnull\b/, /Something went wrong/, /\{(datasheets|products)\}/i, /© –/, / ,/, /(order\.|^)\s+feet in stock/m]) {
    const m = txt.match(re);
    if (m) o.bad.push(String(re) + ' near "' + txt.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\n/g, ' ') + '"');
  }
  for (const a of document.querySelectorAll('a[href]')) { const h = a.getAttribute('href'); if (/^(tel|mailto):$/.test(h) || h === '' || /undefined/.test(h)) o.bad.push('href "' + h + '"'); }
  for (const h of document.querySelectorAll('h1, h2, h3')) if (!h.textContent.trim()) o.bad.push('empty ' + h.tagName);
  for (const s of document.querySelectorAll('section')) { const b = s.getBoundingClientRect(); if (b.height > 0 && b.height < 40) o.residue.push('section ' + (s.id || s.className.slice(0, 40)) + ' h=' + Math.round(b.height)); }
  // A displayed grid item with no height still takes the grid's gap.
  for (const g of document.querySelectorAll('.grid')) {
    const kids = [...g.children].filter((c) => getComputedStyle(c).display !== 'none').map((c) => c.getBoundingClientRect());
    // Side by side, the hero's empty right column (no photo, no proof points)
    // costs no height; stacked, it costs the gap.
    const sideBySide = /lg:grid-cols-2/.test(g.className) && vw >= 1024;
    kids.forEach((k, i) => {
      if (k.height < 1 && kids.length > 1 && !sideBySide) o.residue.push('empty grid item ' + i + ' in ' + g.className.slice(0, 50));
      for (let j = i + 1; j < kids.length; j++) {
        const b = kids[j];
        if (Math.min(k.right, b.right) - Math.max(k.left, b.left) > 2 && Math.min(k.bottom, b.bottom) - Math.max(k.top, b.top) > 2) o.residue.push('overlap ' + i + '/' + j + ' in ' + g.className.slice(0, 50));
      }
    });
  }
  return o;
}

// End of a marquee cycle: does the track still cover the rail?
function tickerEnd() {
  const t = document.querySelector('.ipc-marquee-track');
  if (!t) return null;
  const a = t.getAnimations()[0];
  if (!a) return { static: true };
  a.pause();
  a.currentTime = a.effect.getTiming().duration * 0.999;
  return { right: Math.round(t.getBoundingClientRect().right), rail: t.parentElement.clientWidth, items: t.children.length,
    named: [...t.children].filter((c) => !c.getAttribute('aria-hidden')).length };
}

function iconContrast() {
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  return [...document.querySelectorAll('#ipc-sec-stats svg[stroke]')].map((s) => {
    const a = lum(getComputedStyle(s).stroke), b = lum(getComputedStyle(s.parentElement.closest('.rounded-lg')).backgroundColor);
    return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2);
  });
}

(async () => {
  const only = process.argv[2];
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  try {
    for (const [name, apply] of VARIANTS) {
      if (only && !name.startsWith(only)) continue;
      restore();
      const actx = await browser.newContext();
      const ap = await actx.newPage();
      ap.on('dialog', (d) => d.accept());
      const adminErrs = [];
      ap.on('pageerror', (e) => adminErrs.push(e.message));
      await login(ap);
      const flashes = await apply(ap);
      await actx.close();
      note(flashes.every((f) => /^✅/.test(f)) && !adminErrs.length,
        `${name}: every admin change saved`, JSON.stringify({ flashes, adminErrs }));

      const logAt = fs.existsSync(PHPLOG) ? fs.statSync(PHPLOG).size : null;
      const snap = JSON.parse(fs.readFileSync(path.join(SITE, 'data/content.json'), 'utf8'));
      for (const w of WIDTHS) {
        const { ctx, page, errs } = await render(browser, w);
        const r = await page.evaluate(pageChecks);
        const problems = [
          ...(r.overflow > 0 ? [`horizontal scroll ${r.overflow}px`] : []),
          ...r.broken.map((b) => 'broken image ' + b), ...r.bad, ...r.residue, ...new Set(errs),
        ];
        note(!problems.length, `${name} @${w}: no errors, overflow, leaks or residue`, problems.join('; '));
        if (w === 375 || w === 1440) await page.screenshot({ path: path.join(OUT, `${name}-${w}.png`), fullPage: true });
        await ctx.close();
      }
      if (logAt !== null) {
        const php = fs.readFileSync(PHPLOG, 'utf8').slice(logAt).split('\n').filter((l) => /PHP (Warning|Notice|Fatal|Deprecated)/i.test(l));
        note(!php.length, `${name}: no PHP warnings`, php.slice(0, 3).join(' | '));
      }
      // Emptied lists take their section with them.
      if (name === '05-all-lists-empty') {
        const { ctx, page } = await render(browser, 375);
        const gone = await page.evaluate(() => ['ipc-sec-stats', 'ipc-sec-markets', 'ipc-sec-heroTrust'].filter((id) => document.getElementById(id)));
        note(!gone.length, '05: emptied stats, markets and ticker leave no section behind', gone.join(', '));
        await ctx.close();
      }
      // The ticker seam, for the shipped list and for a cut-down one.
      if (['00-baseline', '06-one-of-each', '07-three-of-each'].includes(name)) {
        for (const w of [375, 834, 1440, 1920, 2560]) {
          const { ctx, page } = await render(browser, w);
          const t = await page.evaluate(tickerEnd);
          const n = snap.heroTrust.length;
          note(t && t.right >= t.rail && t.named === n,
            `${name} @${w}: at the end of a ticker cycle the track still reaches the rail's edge, and ${n} item(s) are read once`,
            JSON.stringify(t));
          await ctx.close();
        }
      }
      if (name.startsWith('11-')) {
        const { ctx, page } = await render(browser, 1440);
        const cr = await page.evaluate(iconContrast);
        note(cr.length === 4 && cr.every((c) => c >= 3), '11: stat icons stay visible on a pale palette (≥3:1 on their tile)', JSON.stringify(cr));
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    restore();
  }
  const pass = results.filter((x) => x.ok).length;
  console.log(`\nhomelayouts ${pass}/${results.length}`);
  fs.writeFileSync(path.join(OUT, 'homelayouts.json'), JSON.stringify(results, null, 2));
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); restore(); process.exit(1); });
