/**
 * AUDIT-10 pass-5 step 5.6 (second half) — contrast of the ADMIN's own text.
 *
 * brandtext.js and the plan5c suites score the public site: brandtext walks
 * nine public routes looking for elements painted in a --brand-* colour, and
 * plan5c-eyebrow scores .ipc-page-header. Neither ever loads /admin/*, and the
 * admin is not brand-coloured anyway — its palette is a separate set of greys
 * declared inline in each PHP file. So the admin's grey-on-white labels, help
 * text, table captions and hint lines are measured by nothing, which is what
 * this file is for.
 *
 * The measurement is NOT re-implemented: it imports SOURCE/ratio from
 * _harness/backdrop.js, which is the single implementation on purpose (see its
 * header). That gives the same alpha compositing and the same gradient
 * sampling under the glyphs that the public suites get.
 *
 * Every element that paints its own text on all eleven admin GET pages plus
 * the signed-out login screen, at desktop-1440 and mobile-390, is scored
 * against WCAG AA: 4.5:1 for body text, 3:1 for large text (>=24px, or
 * >=18.66px at weight >=700). Disabled controls are excluded — WCAG 1.4.3
 * exempts them — and so is text with zero ink extent.
 *
 * Reads only. Nothing is written to data/ and no form is submitted.
 *
 * Usage: node _harness/audit10-admincontrast.js [--verbose] [--run N]
 *        (mirror on :8123, password audit-pass-123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');
const { SOURCE, ratio, skippedLayers } = require('./backdrop');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const ROOT = path.join(__dirname, '..');
const OUTDIR = path.join(ROOT, '_harness', 'out', 'audit10', 'pass5');
const VERBOSE = process.argv.includes('--verbose');
const runArg = process.argv.indexOf('--run');
const RUN = runArg > -1 ? process.argv[runArg + 1] : '1';

const PAGES = [
  '/admin/index.php', '/admin/content.php', '/admin/settings.php', '/admin/add.php',
  '/admin/edit.php?id=CC', '/admin/backups.php', '/admin/password.php',
  '/admin/inquiries.php', '/admin/audit-log.php', '/admin/help.php',
];
const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const PROBE = function () {
  const paintsOwnText = (el) => {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  };
  const sig = (el) => {
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + cls;
  };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!paintsOwnText(el) || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.opacity === '0') continue;
    // WCAG 1.4.3 exempts disabled controls.
    if (el.disabled || el.closest('[disabled]') || el.closest('fieldset[disabled]')) continue;
    const fg = window.__ipcParse(cs.color);
    if (!fg || fg[3] === 0) continue;
    const back = window.__ipcBackdrop(el);
    const size = parseFloat(cs.fontSize) || 16;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    out.push({
      ink: back.map((bg) => window.__ipcOver(fg, bg)),
      back,
      color: cs.color,
      size, weight,
      large: size >= 24 || (weight >= 700 && size >= 18.66),
      sig: sig(el),
      selector: (el.parentElement ? sig(el.parentElement) + '>' : '') + sig(el),
      text: (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48),
    });
  }
  return out;
};

const hexOf = (c) => '#' + c.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');

(async () => {
  const browser = await launch();
  const rows = [];
  const rasterSkips = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    const scorePage = async (url) => {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(200);
      await page.evaluate(SOURCE);
      const els = await page.evaluate(PROBE);
      const skips = await page.evaluate(() => window.__ipcBackdropSkips || []);
      if (skips.length) rasterSkips.push({ url, viewport: vp.name, skips });
      for (const e of els) {
        // Worse of the two gradient ends, exactly as the public suites do.
        const r = Math.min(...e.ink.map((ink, i) => ratio(ink, e.back[i])));
        rows.push({
          url, viewport: vp.name, ratio: +r.toFixed(2),
          required: e.large ? 3 : 4.5, pass: r >= (e.large ? 3 : 4.5),
          fg: hexOf(e.ink[0]), bg: hexOf(e.back[0]), color: e.color,
          size: e.size, weight: e.weight, large: e.large,
          sig: e.sig, selector: e.selector, text: e.text,
        });
      }
    };

    // Signed-out login first, in a context with no session.
    await scorePage('/admin/');
    if (await page.$('input[type="password"]')) {
      await page.fill('input[type="password"]', PASS);
      await Promise.all([page.waitForNavigation(), page.click('button[type="submit"], input[type="submit"]')]);
    }
    for (const url of PAGES) await scorePage(url);
    await ctx.close();
    console.log(vp.name + ' scored');
  }
  await browser.close();

  const failing = rows.filter((r) => !r.pass);
  // Group identical failures (same colour pair, size and class) so the report
  // names distinct defects rather than repeated table rows.
  const grouped = {};
  for (const f of failing) {
    const k = [f.fg, f.bg, f.size, f.weight, f.sig].join('|');
    const g = (grouped[k] = grouped[k] || { ...f, count: 0, urls: new Set(), samples: [] });
    g.count++;
    g.urls.add(f.url);
    if (g.samples.length < 3) g.samples.push(f.text);
  }
  const distinct = Object.values(grouped)
    .map((g) => ({ ...g, urls: [...g.urls] }))
    .sort((a, b) => a.ratio - b.ratio);

  fs.mkdirSync(OUTDIR, { recursive: true });
  const outFile = path.join(OUTDIR, `admincontrast-run${RUN}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    run: RUN, scored: rows.length, failing: failing.length,
    distinctFailures: distinct.length, rasterSkips, distinct,
    all: VERBOSE ? rows : undefined,
  }, null, 1));

  console.log(`\nscored ${rows.length} text-painting elements across 12 admin screens x 2 viewports`);
  console.log(`failing AA: ${failing.length} elements in ${distinct.length} distinct colour/size/class combinations`);
  if (rasterSkips.length) console.log(`RASTER SKIPS (backdrop could not read a layer): ${JSON.stringify(rasterSkips).slice(0, 400)}`);
  for (const d of distinct)
    console.log(`  ${String(d.ratio).padStart(5)}:1 (need ${d.required})  ${d.fg} on ${d.bg}  ${d.size}px/${d.weight}  x${d.count}  ${d.sig}\n        pages: ${d.urls.slice(0, 4).join(', ')}${d.urls.length > 4 ? ' +' + (d.urls.length - 4) : ''}\n        e.g. "${d.samples[0]}"`);
  console.log(`\n${rows.length - failing.length}/${rows.length} admin text elements meet AA`);
  console.log('-> ' + outFile);
})();
