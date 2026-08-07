/**
 * Standing check: every element that paints its own text in a BRAND colour is
 * scored against the background it actually sits on — including gradients.
 *
 * Supersedes the reporting half of fgsurfaces.js, which classified a
 * gradient-backed element as "GRADIENT — check by hand" and left it to a human.
 * That is how page-header-eyebrow-contrast survived: the auditor DID surface
 * four gradient-backed sites, printed them for manual follow-up, and the
 * follow-up never happened. A finding a tool defers is a finding a tool loses,
 * so this one scores the gradient instead of describing it.
 *
 * What it does differently from a naive check:
 *   - targets are read from the LIVE custom properties, not hardcoded, so the
 *     suite keeps working at any palette and after any change to how the
 *     text-safe variants are derived
 *   - translucent backgrounds are composited down to the first opaque ancestor
 *     (rgba(17,158,200,0.1) over white is a near-white tint, not cyan — scoring
 *     it as opaque reported a passing chip at 1.69:1)
 *   - a gradient is sampled AT THE POSITION OF THE GLYPHS along the gradient
 *     axis, at both ends of the text's ink, and the worse end governs. Not the
 *     element's box: see inkRect() for the 1232px-box / 83px-text case that
 *     made this file report a passing colour as failing.
 *   - WCAG large-text is honoured (>=24px, or >=18.66px when bold), because the
 *     page-header <h1> genuinely passes at 3.11:1 and flagging it would be a
 *     false alarm that trains the reader to ignore this suite
 *
 * Usage: node _harness/brandtext.js            (needs the mirror on :8123)
 *        node _harness/brandtext.js --verbose  (list passing sites too)
 */

const { launch } = require('./browser');
const { SOURCE, ratio } = require('./backdrop');

const BASE = 'http://127.0.0.1:8123';
const ROUTES = ['/', '/products', '/dashboard', '/industries', '/services', '/about', '/faq', '/contact', '/privacy'];
const VERBOSE = process.argv.includes('--verbose');

// Custom properties whose value can legitimately end up as a text colour.
const BRAND_VARS = [
  '--brand-primary', '--brand-dark', '--brand-accent', '--brand-accent-2',
  '--brand-primary-text', '--brand-accent-text', '--brand-accent-on-dark',
  '--brand-accent-on-footer', '--brand-accent1-on-dark',
];

const PROBE = function (varNames) {
  // Resolve each brand var to the rgb string the browser would compute, by
  // parking it on a throwaway element and reading it back.
  const probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.opacity = '0';
  document.body.appendChild(probe);
  const targets = {};
  for (const v of varNames) {
    probe.style.color = `var(${v})`;
    const c = getComputedStyle(probe).color;
    if (c) (targets[c] = targets[c] || []).push(v);
  }
  probe.remove();

  function paintsOwnText(el) {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  }

  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!paintsOwnText(el) || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    const names = targets[cs.color];
    if (!names) continue;
    const size = parseFloat(cs.fontSize) || 16;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    out.push({
      vars: names,
      fg: window.__ipcParse(cs.color),
      back: window.__ipcBackdrop(el),
      // WCAG 2.1: 18pt (24px), or 14pt (18.66px) when bold.
      large: size >= 24 || (weight >= 700 && size >= 18.66),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 34),
    });
  }
  return out;
};


/**
 * backdrop() returns the composited colour under each END of the element's own
 * TEXT INK. The worse of the two governs — that is the point of sampling
 * positionally rather than taking the gradient's worst stop, which blamed text
 * for a colour on the far side of a banner it never touches. Sampling the box
 * instead of the ink is a smaller version of the same error and cost this file
 * a wrong conclusion; see inkRect().
 */
function score(r) {
  const [a, b] = r.back;
  const ra = ratio(r.fg, a), rb = ratio(r.fg, b);
  const same = a.join() === b.join();
  return {
    value: Math.min(ra, rb),
    on: same ? `rgb(${a.join(',')})` : `rgb(${a.join(',')}) → rgb(${b.join(',')}) under its own text`,
  };
}

(async () => {
  const browser = await launch();
  const seen = new Map();
  for (const route of ROUTES) {
    for (const w of [1440, 375]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      await page.evaluate(SOURCE);
      for (const r of await page.evaluate(PROBE, BRAND_VARS)) {
        const s = score(r);
        const need = r.large ? 3.0 : 4.5;
        const key = `${r.vars.join('/')}|${s.on}|${r.large}`;
        if (!seen.has(key)) seen.set(key, { ...r, s, need, count: 0, routes: new Set(), samples: [] });
        const e = seen.get(key);
        e.count++;
        e.routes.add(route);
        if (e.samples.length < 2) e.samples.push(`<${r.tag}> "${r.text}"`);
      }
      await ctx.close();
    }
  }
  await browser.close();

  const rows = [...seen.values()].sort((a, b) => a.s.value - b.s.value);
  const failing = rows.filter((r) => r.s.value < r.need);

  console.log('brand-coloured TEXT scored against its real background (gradients included):\n');
  for (const r of rows) {
    const bad = r.s.value < r.need;
    if (!bad && !VERBOSE) continue;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${r.vars.join('/')}  ${r.s.value.toFixed(2)}:1  (needs ${r.need}${r.large ? ', large text' : ''})`);
    console.log(`     on ${r.s.on}`);
    console.log(`     ${r.count} element(s) on ${[...r.routes].join(', ')}`);
    for (const s of r.samples) console.log(`       ${s}`);
  }

  console.log(`\nscored ${rows.length} distinct (colour × background) combinations`);
  console.log(`brandtext: ${rows.length - failing.length}/${rows.length} combinations meet WCAG AA`);
  process.exit(failing.length === 0 ? 0 : 1);
})();
