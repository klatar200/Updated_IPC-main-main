/**
 * Ground truth for the remaining `text-white` elements: ask the BROWSER what
 * each one's effective background actually is, instead of scanning the source
 * backwards for the nearest declaration.
 *
 * The source scan is wrong in both directions — it misses a background declared
 * AFTER the className in the same element (the two submit buttons), and it
 * happily attributes a background from 12,000 characters away. Rendering
 * settles it: under the navy palette each brand variable has a known RGB, so a
 * measured background maps to a surface exactly.
 *
 *   --brand-primary  #005DA3  rgb(0, 93, 163)
 *   --brand-dark     #0D2D52  rgb(13, 45, 82)
 *   --brand-accent-2 #119EC8  rgb(17, 158, 200)
 *
 * Usage: node _harness/whitesurfaces.js
 */
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const ROUTES = ['/', '/products', '/industries', '/services', '/about', '/faq', '/contact', '/privacy'];

const KNOWN = {
  'rgb(0, 93, 163)': 'primary',
  'rgb(13, 45, 82)': 'dark',
  'rgb(17, 158, 200)': 'header (accent-2 end)',
};

const PROBE = function () {
  function parseColor(s) {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || '');
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
  }
  function firstOpaque(el, depth) {
    if (!el || depth > 40) return { kind: 'page', value: 'rgb(255, 255, 255)' };
    const cs = getComputedStyle(el);
    if (cs.backgroundImage && cs.backgroundImage !== 'none' && cs.backgroundImage.indexOf('gradient') >= 0) {
      return { kind: 'gradient', value: cs.backgroundImage.slice(0, 120) };
    }
    const bc = parseColor(cs.backgroundColor);
    if (bc && bc[3] >= 1) return { kind: 'solid', value: `rgb(${bc[0]}, ${bc[1]}, ${bc[2]})` };
    return firstOpaque(el.parentElement, depth + 1);
  }
  const out = [];
  for (const el of document.querySelectorAll('.text-white')) {
    if (!el.getClientRects().length) continue;
    const bg = firstOpaque(el, 0);
    out.push({
      tag: el.tagName,
      cls: el.className.toString().slice(0, 55),
      text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 38),
      bgKind: bg.kind,
      bg: bg.value,
    });
  }
  return out;
};

(async () => {
  const browser = await launch();
  const seen = new Map();
  for (const route of ROUTES) {
    for (const w of [1440, 375]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      for (const r of await page.evaluate(PROBE)) {
        const key = `${r.tag}|${r.text}|${r.bg}`;
        if (!seen.has(key)) seen.set(key, { ...r, routes: new Set() });
        seen.get(key).routes.add(route);
      }
      await ctx.close();
    }
  }
  await browser.close();

  const rows = [...seen.values()];
  console.log(`${rows.length} distinct rendered .text-white elements\n`);
  for (const r of rows) {
    const surface = r.bgKind === 'gradient'
      ? 'header (gradient)'
      : (KNOWN[r.bg] || `NOT A BRAND SURFACE — ${r.bg}`);
    console.log(`  <${r.tag}> "${r.text}"`);
    console.log(`      routes: ${[...r.routes].join(', ')}`);
    console.log(`      -> ${surface}\n`);
  }
})();
