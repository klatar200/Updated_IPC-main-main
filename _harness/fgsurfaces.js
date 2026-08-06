/**
 * Where does brand-colored TEXT actually sit?
 *
 * Before swapping `color: var(--brand-primary)` for a text-safe variant at 49
 * call sites, check the assumption behind that variant: that the text is on
 * white or a near-white tint. A site on a DARK background would need the
 * opposite adjustment, and `--brand-primary-text` (darkened for white) would
 * make it worse — a regression the palette-diff auditor could miss, because it
 * would fail under BOTH palettes and land in the "pre-existing" bucket.
 *
 * Runs under the shipped navy palette, where --brand-primary is rgb(0, 93, 163)
 * and --brand-accent-2 is rgb(17, 158, 200).
 *
 * Usage: node _harness/fgsurfaces.js
 */
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const ROUTES = ['/', '/products', '/industries', '/services', '/about', '/faq', '/contact', '/privacy'];

const PROBE = function (targets) {
  function parseColor(s) {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || '');
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
  }
  function firstOpaque(el, depth) {
    if (!el || depth > 40) return 'rgb(255, 255, 255)';
    const cs = getComputedStyle(el);
    if (cs.backgroundImage && cs.backgroundImage !== 'none' && cs.backgroundImage.indexOf('gradient') >= 0) {
      return 'GRADIENT';
    }
    const bc = parseColor(cs.backgroundColor);
    if (bc && bc[3] >= 1) return `rgb(${bc[0]}, ${bc[1]}, ${bc[2]})`;
    return firstOpaque(el.parentElement, depth + 1);
  }
  function paintsOwnText(el) {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  }
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!paintsOwnText(el) || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    const which = targets[cs.color];
    if (!which) continue;
    out.push({ which, bg: firstOpaque(el, 0), tag: el.tagName, text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 34) });
  }
  return out;
};

const TARGETS = {
  'rgb(0, 93, 163)': '--brand-primary',
  'rgb(17, 158, 200)': '--brand-accent-2',
};

(async () => {
  const browser = await launch();
  const byBg = new Map();
  for (const route of ROUTES) {
    for (const w of [1440, 375]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      for (const r of await page.evaluate(PROBE, TARGETS)) {
        const key = `${r.which} on ${r.bg}`;
        if (!byBg.has(key)) byBg.set(key, { count: 0, samples: [] });
        const e = byBg.get(key);
        e.count++;
        if (e.samples.length < 3) e.samples.push(`<${r.tag}> "${r.text}"`);
      }
      await ctx.close();
    }
  }
  await browser.close();

  const LIGHT = (bg) => {
    const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(bg);
    if (!m) return null;
    const l = (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) / 255;
    return l > 0.5;
  };

  console.log('brand-colored TEXT, grouped by the background it sits on:\n');
  for (const [key, v] of [...byBg.entries()].sort((a, b) => b[1].count - a[1].count)) {
    const bg = key.split(' on ')[1];
    const verdict = bg === 'GRADIENT' ? '  <-- GRADIENT, check by hand'
      : LIGHT(bg) ? '' : '  <-- DARK BACKGROUND, needs the opposite adjustment';
    console.log(`  ${key.padEnd(46)} ${String(v.count).padStart(4)}${verdict}`);
    for (const s of v.samples) console.log(`       ${s}`);
  }
})();
