/**
 * AUDIT-10 pass-5 step 5.7 — dark-asset check.
 *
 * Image assets that carry baked-in brand color or baked-in text cannot follow
 * the repalette mechanism at all: they are pixels (or, for the SVGs, literal
 * fill attributes with no var() in them). This measures how far each shipped
 * asset's brand color sits from the live --brand-* palette, so "the logo's
 * blue is not the site's blue" is a number rather than an impression.
 *
 * Method: decode each asset in the browser onto a canvas at natural size and
 * read the pixels. Every pixel is quantised to a 16-level cube; the dominant
 * buckets are reported, and separately the share of pixels within sRGB
 * distance 24 of each live brand variable. For the two SVGs the literal fill /
 * stroke values are ALSO parsed out of the file text, because an SVG's colors
 * are authored values and quoting them exactly is better evidence than a
 * rasterised histogram.
 *
 * Alpha < 16 is treated as "not painted" and excluded, so a transparent PNG
 * does not report black.
 *
 * Reads only.
 * Usage: node _harness/audit10-assets.js     (mirror on :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const ROOT = path.join(__dirname, '..');
const OUTDIR = path.join(ROOT, '_harness', 'out', 'audit10', 'pass5');

// Everything the site can paint that carries baked-in brand colour or text.
const ASSETS = [
  '/logo.svg', '/favicon.svg', '/admin/logo.svg',
  '/images/og-card.jpg',
  '/images/site/header-logo.jpg',
  '/images/site/main-banner-1349x414.jpg',
  '/images/site/main-banner-800x414.jpg',
  '/images/site/featured-category-1.jpg',
  '/images/site/featured-category-2.jpg',
  '/images/site/featured-category-3.jpg',
  '/images/site/Front-Cover.jpg',
  '/images/site/Slide1.png',
  '/images/site/IPC-Building.jpg',
  '/images/site/staff.jpg',
  '/images/site/id-markers.png',
  '/images/site/conduit-drawing.png',
];

const VARS = ['--brand-primary', '--brand-primary-hover', '--brand-dark', '--brand-accent',
  '--brand-accent-2', '--brand-primary-text', '--brand-accent-text',
  '--brand-accent-on-dark', '--brand-accent-on-footer', '--brand-accent1-on-dark'];

// One argument: page.evaluate() passes a single serialised value, so a
// two-parameter function silently receives the whole array as `url`.
const MEASURE = async ([url, palette]) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const loaded = await new Promise((res) => {
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = url;
  });
  if (!loaded) return { url, error: 'did not load' };
  const w = img.naturalWidth || 300, h = img.naturalHeight || 300;
  // Cap the raster so a 2000px photo does not cost a second of CPU; the
  // histogram is a proportion, and downsampling preserves proportions.
  const scale = Math.min(1, 400 / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, cw, ch);
  const data = g.getImageData(0, 0, cw, ch).data;

  const buckets = {};
  const nearVar = {};
  for (const k of Object.keys(palette)) nearVar[k] = 0;
  let painted = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) continue;
    painted++;
    const r = data[i], gg = data[i + 1], b = data[i + 2];
    const key = `${r >> 4},${gg >> 4},${b >> 4}`;
    const e = (buckets[key] = buckets[key] || { n: 0, r: 0, g: 0, b: 0 });
    e.n++; e.r += r; e.g += gg; e.b += b;
    for (const [k, p] of Object.entries(palette)) {
      const d = Math.sqrt((r - p[0]) ** 2 + (gg - p[1]) ** 2 + (b - p[2]) ** 2);
      if (d <= 24) nearVar[k]++;
    }
  }
  const top = Object.values(buckets)
    .sort((a, b) => b.n - a.n).slice(0, 6)
    .map((e) => ({
      hex: '#' + [e.r / e.n, e.g / e.n, e.b / e.n].map((x) => Math.round(x).toString(16).padStart(2, '0')).join(''),
      share: +(100 * e.n / painted).toFixed(1),
    }));
  const near = {};
  for (const [k, n] of Object.entries(nearVar)) if (n) near[k] = +(100 * n / painted).toFixed(2);
  return { url, naturalWidth: w, naturalHeight: h, sampled: `${cw}x${ch}`, paintedPixels: painted, dominant: top, pixelsNearBrandVar: near };
};

const READ_VARS = (names) => {
  const cs = getComputedStyle(document.documentElement);
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;opacity:0';
  document.body.appendChild(probe);
  const out = {};
  for (const n of names) { probe.style.color = ''; probe.style.color = `var(${n})`; out[n] = getComputedStyle(probe).color; }
  probe.remove();
  return out;
};

const parseRgb = (v) => {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(v || '');
  return m ? [+m[1], +m[2], +m[3]] : null;
};
const parseHex = (h) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || '').trim());
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const dist = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(300);
  const varsRaw = await page.evaluate(READ_VARS, VARS);
  const palette = {};
  for (const [k, v] of Object.entries(varsRaw)) { const c = parseRgb(v); if (c) palette[k] = c; }

  const results = [];
  for (const a of ASSETS) results.push(await page.evaluate(MEASURE, [BASE + a, palette]).catch((e) => ({ url: a, error: String(e).slice(0, 120) })));
  await browser.close();

  // ── SVG authored colours, read from the files themselves ─────────────────
  const svgAuthored = {};
  for (const rel of ['public/logo.svg', 'public/favicon.svg', 'admin/logo.svg']) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    const counts = {};
    for (const m of txt.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
      const h = '#' + m[1].toLowerCase();
      counts[h] = (counts[h] || 0) + 1;
    }
    svgAuthored[rel] = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([h, n]) => {
      const c = parseHex(h);
      let best = null;
      for (const [k, p2] of Object.entries(palette)) {
        const d = dist(c, p2);
        if (!best || d < best.d) best = { varName: k, d: +d.toFixed(2) };
      }
      return { hex: h, occurrences: n, nearestBrandVar: best, usesVar: false };
    });
    svgAuthored[rel + ' :: contains var()'] = /var\(\s*--/.test(txt);
  }

  fs.mkdirSync(OUTDIR, { recursive: true });
  const out = { base: BASE, palette: Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, '#' + v.map((x) => x.toString(16).padStart(2, '0')).join('')])), svgAuthored, rasters: results };
  fs.writeFileSync(path.join(OUTDIR, 'assets.json'), JSON.stringify(out, null, 1));

  console.log('live palette: ' + JSON.stringify(out.palette));
  console.log('\n── SVG authored colours (no var() is reachable inside an <img> SVG) ──');
  for (const [k, v] of Object.entries(svgAuthored)) {
    if (typeof v === 'boolean') { console.log(`  ${k}: ${v}`); continue; }
    console.log(`  ${k}`);
    for (const c of v) console.log(`    ${c.hex} x${c.occurrences}   nearest ${c.nearestBrandVar.varName} d=${c.nearestBrandVar.d}`);
  }
  console.log('\n── raster assets ──');
  for (const r of results) {
    if (r.error) { console.log(`  ${r.url}  ERROR ${r.error}`); continue; }
    console.log(`  ${r.url}  ${r.naturalWidth}x${r.naturalHeight}`);
    console.log(`      dominant: ${r.dominant.map((d) => d.hex + ' ' + d.share + '%').join('  ')}`);
    const near = Object.entries(r.pixelsNearBrandVar);
    console.log(`      pixels within 24 of a brand var: ${near.length ? near.map(([k, v]) => k + ' ' + v + '%').join(', ') : 'none'}`);
  }
  console.log('\n-> ' + path.join(OUTDIR, 'assets.json'));
})();
