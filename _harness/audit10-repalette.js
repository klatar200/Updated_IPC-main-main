/**
 * AUDIT-10 pass-5 step 5.3 — the repalette drill.
 *
 * The site is owner-repaletteable: admin → Business Details → Branding writes
 * four colors into data/site-info.json, ThemeInjector (src/App.jsx:7313) turns
 * those into fourteen --brand-* custom properties, and every brand-colored
 * surface is supposed to follow. This drill proves which ones actually do.
 *
 * Method — browser-side only, NO source edits, nothing written to data/:
 *   1. load the page, scroll it to settle lazy content, and record every
 *      painting element's computed {color, backgroundColor, borderColor,
 *      backgroundImage, fill, stroke} in document order;
 *   2. page.addStyleTag() a :root block that sets all fourteen brand vars to a
 *      deliberately non-blue test palette, with !important so it beats the
 *      inline properties ThemeInjector writes onto documentElement;
 *   3. record the same values again, and diff PER ELEMENT.
 *
 * An element whose value is byte-identical before and after AND whose value is
 * one of the pre-injection brand colors did not follow the palette: that is a
 * hardcode leak, and it is what a real owner would see if he picked a red
 * brand and half the page stayed blue.
 *
 * Two leak classes are reported separately because they are different defects:
 *   exact   — the painted value equals a --brand-* value that was just changed
 *   family  — the painted value is within sRGB distance 60 of one of them and
 *             is not in the new palette (the navy relatives: #0a2a52, #003d7a,
 *             #0e2847, #1a3a5c) — these are not any variable's value, so they
 *             could never have followed
 *
 * Screenshots: before/after full-page PNGs per route into
 * _harness/out/audit10/issues/.
 *
 * Usage: node _harness/audit10-repalette.js [--run 2]   (mirror on :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const ROOT = path.join(__dirname, '..');
const ISSUES = path.join(ROOT, '_harness', 'out', 'audit10', 'issues');
const OUTDIR = path.join(ROOT, '_harness', 'out', 'audit10', 'pass5');
const runArg = process.argv.indexOf('--run');
const RUN = runArg > -1 ? process.argv[runArg + 1] : '1';

// Five representative pages: the marketing home, the catalog landing, a
// product detail (the deepest brand-colored chrome on the site), the public
// product index (dark table header), and the lead-capture page (dark sidebar
// card). Between them they paint every brand-colored component the site has.
const ROUTES = [
  { url: '/', slug: 'home' },
  { url: '/products', slug: 'products' },
  { url: '/products?productId=IP38FE', slug: 'products_productId_IP38FE' },
  { url: '/dashboard', slug: 'dashboard' },
  { url: '/contact', slug: 'contact' },
];

// The fourteen properties ThemeInjector drives, set to a palette with no blue
// in it at all, so anything still blue afterwards is unambiguous. The ink
// variables are set by hand here rather than derived — this drill tests who
// FOLLOWS the variables, not the 4.23 ink maths (plan5c-brandink owns that).
const TEST = {
  '--brand-primary': '#8a1c5a',
  '--brand-primary-rgb': '138, 28, 90',
  '--brand-primary-hover': '#6f1648',
  '--brand-dark': '#3a1200',
  '--brand-accent': '#ff9d2e',
  '--brand-accent-2': '#d2691e',
  '--brand-primary-ink': '#ffffff',
  '--brand-dark-ink': '#ffffff',
  '--brand-header-ink': '#ffffff',
  '--brand-primary-ink-rgb': '255, 255, 255',
  '--brand-dark-ink-rgb': '255, 255, 255',
  '--brand-header-ink-rgb': '255, 255, 255',
  '--brand-primary-text': '#8a1c5a',
  '--brand-accent-text': '#a04e13',
  '--brand-accent-on-dark': '#e8873a',
  '--brand-accent-on-footer': '#e8873a',
  '--brand-accent1-on-dark': '#ff9d2e',
};
const CSS = ':root{' + Object.entries(TEST).map(([k, v]) => `${k}:${v} !important;`).join('') + '}';

const VARS = [
  '--brand-primary', '--brand-primary-hover', '--brand-dark', '--brand-accent',
  '--brand-accent-2', '--brand-primary-text', '--brand-accent-text',
  '--brand-accent-on-dark', '--brand-accent-on-footer', '--brand-accent1-on-dark',
];

/** Walk every painting element, in document order, recording its paint. */
const SNAP = () => {
  const rows = [];
  const sig = (el) => {
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + cls;
  };
  const selector = (el) => {
    const parts = []; let n = el;
    for (let d = 0; n && n !== document.body && d < 3; d++, n = n.parentElement) parts.unshift(sig(n));
    return parts.join('>');
  };
  let i = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) continue;
    let hasText = false;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { hasText = true; break; }
    rows.push({
      i: i++,
      sig: sig(el), sel: selector(el),
      text: hasText ? el.textContent.trim().slice(0, 40) : '',
      color: hasText ? cs.color : '',
      bg: cs.backgroundColor,
      bi: cs.backgroundImage === 'none' ? '' : cs.backgroundImage.slice(0, 400),
      bc: [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor]
        .filter((c, k) => parseFloat([cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth][k]) > 0)
        .join(' '),
      fill: el.namespaceURI === 'http://www.w3.org/2000/svg' && cs.fill !== 'none' ? cs.fill : '',
      stroke: el.namespaceURI === 'http://www.w3.org/2000/svg' && cs.stroke !== 'none' ? cs.stroke : '',
      outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? cs.outlineColor : '',
    });
  }
  return rows;
};

const READ_VARS = (vars) => {
  const cs = getComputedStyle(document.documentElement);
  const o = {};
  for (const v of vars) o[v] = cs.getPropertyValue(v).trim();
  return o;
};

// ── Node-side color helpers ─────────────────────────────────────────────────
function parseHex(h) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || '').trim());
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const dist = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
/** Every rgb()/rgba()/#hex triple appearing anywhere in a computed string. */
function colorsIn(s) {
  const out = [];
  for (const m of String(s || '').matchAll(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/gi))
    out.push([+m[1], +m[2], +m[3]]);
  for (const m of String(s || '').matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const c = parseHex(m[1]);
    if (c) out.push(c);
  }
  return out;
}
const FIELDS = ['color', 'bg', 'bi', 'bc', 'fill', 'stroke', 'outline'];

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  fs.mkdirSync(ISSUES, { recursive: true });
  fs.mkdirSync(OUTDIR, { recursive: true });

  const report = { run: RUN, base: BASE, viewport: 'desktop-1440', testPalette: TEST, routes: [] };

  for (const route of ROUTES) {
    await page.goto(BASE + route.url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 15)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);

    const before = await page.evaluate(SNAP);
    const oldVars = await page.evaluate(READ_VARS, VARS);
    if (RUN === '1')
      await page.screenshot({ path: path.join(ISSUES, `A10-repalette__desktop-1440__${route.slug}__before.png`), fullPage: true });

    await page.addStyleTag({ content: CSS });
    await page.waitForTimeout(400);
    const newVars = await page.evaluate(READ_VARS, VARS);
    const after = await page.evaluate(SNAP);
    if (RUN === '1')
      await page.screenshot({ path: path.join(ISSUES, `A10-repalette__desktop-1440__${route.slug}__after.png`), fullPage: true });

    // The palette that was in force before injection, as rgb triples.
    const oldPalette = Object.entries(oldVars)
      .map(([k, v]) => ({ k, c: parseHex(v) || colorsIn(v)[0] }))
      .filter((x) => x.c);
    const newPalette = Object.values(newVars).map((v) => parseHex(v) || colorsIn(v)[0]).filter(Boolean);

    const leaks = [];
    const byIndex = new Map(after.map((r) => [r.i, r]));
    for (const b of before) {
      const a = byIndex.get(b.i);
      if (!a || a.sig !== b.sig) continue;              // DOM moved — skip rather than guess
      for (const f of FIELDS) {
        if (!b[f] || b[f] !== a[f]) continue;           // changed => it followed
        for (const c of colorsIn(b[f])) {
          let best = null;
          for (const p of oldPalette) {
            const d = dist(c, p.c);
            if (!best || d < best.d) best = { d: +d.toFixed(1), varName: p.k, varHex: '#' + p.c.map((x) => x.toString(16).padStart(2, '0')).join('') };
          }
          if (!best) continue;
          const inNew = newPalette.some((p) => dist(c, p) < 1);
          if (inNew) continue;                           // it IS the new palette
          const kind = best.d < 1 ? 'exact' : best.d <= 60 ? 'family' : null;
          if (!kind) continue;
          leaks.push({
            kind, field: f, value: b[f].slice(0, 160),
            rgb: c, nearest: best, sig: b.sig, sel: b.sel, text: b.text,
          });
        }
      }
    }

    // Collapse to distinct (kind, field, value, sig) with a count.
    const grouped = {};
    for (const l of leaks) {
      const k = [l.kind, l.field, l.value, l.sig].join(' :: ');
      const g = (grouped[k] = grouped[k] || { ...l, count: 0, examples: [] });
      g.count++;
      if (g.examples.length < 3 && !g.examples.includes(l.sel)) g.examples.push(l.sel);
    }
    const rows = Object.values(grouped).sort((x, y) => (x.kind === y.kind ? y.count - x.count : x.kind === 'exact' ? -1 : 1));

    report.routes.push({
      url: route.url, slug: route.slug,
      elementsBefore: before.length, elementsAfter: after.length,
      oldVars, newVars,
      varsActuallyChanged: VARS.filter((v) => oldVars[v] !== newVars[v]).length,
      leakRows: rows.length,
      leakElements: rows.reduce((s, r) => s + r.count, 0),
      leaks: rows,
    });
    console.log(`${route.url.padEnd(34)} ${before.length} els, vars changed ${report.routes.at(-1).varsActuallyChanged}/${VARS.length}, leak rows ${rows.length} (${report.routes.at(-1).leakElements} elements)`);
    for (const r of rows) console.log(`    [${r.kind}] ${r.field} ${r.value.slice(0, 78)}  x${r.count}  ${r.sig}  ~${r.nearest.varName}`);
  }

  await browser.close();
  const f = path.join(OUTDIR, `repalette-run${RUN}.json`);
  fs.writeFileSync(f, JSON.stringify(report, null, 1));
  console.log('\n-> ' + f);
})();
