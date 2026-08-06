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
 *   - a gradient is sampled AT THE ELEMENT'S OWN POSITION along the gradient
 *     axis, at both ends of its box, and the worse end governs
 *   - WCAG large-text is honoured (>=24px, or >=18.66px when bold), because the
 *     page-header <h1> genuinely passes at 3.11:1 and flagging it would be a
 *     false alarm that trains the reader to ignore this suite
 *
 * Usage: node _harness/brandtext.js            (needs the mirror on :8123)
 *        node _harness/brandtext.js --verbose  (list passing sites too)
 */

const { launch } = require('./browser');

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
  const parse = (s) => {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || '');
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
  };

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

  /* ── Gradient evaluation ────────────────────────────────────────────────
   * A gradient must be sampled WHERE THE TEXT IS, not reduced to its worst
   * stop. The first draft of this file did the latter and reported the
   * homepage hero at 1.00:1 — because the brand gradient's far end happens to
   * equal the text colour, at a position the text never reaches. It also read
   * `rgba(20,20,20,0.72)` as opaque #141414, ignoring that the layer above the
   * brand gradient is a translucent scrim. Both made it cry wolf, which is how
   * an auditor gets ignored.                                                */

  // Split "a, b(c, d), e" on TOP-LEVEL commas only.
  function splitTop(str) {
    const parts = []; let depth = 0, cur = '';
    for (const ch of str) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    return parts.map((x) => x.trim());
  }

  const KEYWORD_ANGLE = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270 };

  function parseLinear(layer) {
    const m = /^linear-gradient\((.*)\)$/s.exec(layer.trim());
    if (!m) return null;
    const parts = splitTop(m[1]);
    let angle = 180;
    if (/deg\s*$/.test(parts[0])) { angle = parseFloat(parts[0]); parts.shift(); }
    else if (/^to\s/.test(parts[0])) { angle = KEYWORD_ANGLE[parts[0].trim()] ?? 180; parts.shift(); }
    const stops = [];
    for (const p of parts) {
      const c = /rgba?\([^)]*\)/.exec(p);
      if (!c) continue;
      const pos = /(-?[\d.]+)%/.exec(p.slice(c[0].length));
      stops.push({ c: parse(c[0]), pos: pos ? parseFloat(pos[1]) / 100 : null });
    }
    if (!stops.length) return null;
    if (stops[0].pos === null) stops[0].pos = 0;
    if (stops[stops.length - 1].pos === null) stops[stops.length - 1].pos = 1;
    // Distribute any unpositioned stops evenly between their positioned neighbours.
    for (let i = 0; i < stops.length; i++) {
      if (stops[i].pos !== null) continue;
      let j = i; while (stops[j].pos === null) j++;
      const a = stops[i - 1].pos, b = stops[j].pos, n = j - i + 1;
      for (let k = i; k < j; k++) stops[k].pos = a + ((b - a) * (k - i + 1)) / n;
    }
    return { angle, stops };
  }

  /** Colour of a linear gradient at fraction t along its axis. */
  function gradientAt(g, t) {
    const s = g.stops;
    if (t <= s[0].pos) return s[0].c;
    if (t >= s[s.length - 1].pos) return s[s.length - 1].c;
    for (let i = 1; i < s.length; i++) {
      if (t > s[i].pos) continue;
      const a = s[i - 1], b = s[i];
      const span = b.pos - a.pos || 1;
      const f = (t - a.pos) / span;
      return [0, 1, 2, 3].map((k) => a.c[k] + (b.c[k] - a.c[k]) * f);
    }
    return s[s.length - 1].c;
  }

  /**
   * Where the element's left and right edges fall along the gradient axis of
   * the given painting box. CSS 0deg points up, 90deg right; the axis length is
   * |W sin| + |H cos| and t is measured from the box centre.
   */
  function axisFractions(box, rect, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    const dx = Math.sin(rad), dy = -Math.cos(rad);
    const L = Math.abs(box.width * dx) + Math.abs(box.height * dy);
    if (!L) return [0.5, 0.5];
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    const ts = [[rect.left, rect.top], [rect.right, rect.top], [rect.left, rect.bottom], [rect.right, rect.bottom]]
      .map(([x, y]) => 0.5 + ((x - cx) * dx + (y - cy) * dy) / L);
    return [Math.max(0, Math.min(1, Math.min(...ts))), Math.max(0, Math.min(1, Math.max(...ts)))];
  }

  const composite = (fg, bg) => {
    const a = fg[3];
    if (a >= 1) return fg;
    return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1);
  };

  /**
   * The real painted colour behind `el`, sampled at both ends of its own box.
   * Returns two rgba triples; the worse of the two governs.
   */
  function backdrop(el) {
    const rect = el.getBoundingClientRect();
    // Bottom-up accumulation: collect translucent layers, stop at the first
    // fully opaque paint, then composite back down.
    const stack = [];
    let n = el, depth = 0;
    while (n && n !== document.documentElement && depth++ < 40) {
      const cs = getComputedStyle(n);
      const box = n.getBoundingClientRect();
      const bi = cs.backgroundImage;
      if (bi && bi !== 'none') {
        // CSS paints the FIRST listed background layer on top.
        for (const layer of splitTop(bi)) {
          const g = parseLinear(layer);
          if (!g) continue;
          const [t0, t1] = axisFractions(box, rect, g.angle);
          stack.push({ pair: [gradientAt(g, t0), gradientAt(g, t1)] });
        }
      }
      const bc = parse(cs.backgroundColor);
      if (bc && bc[3] > 0) {
        stack.push({ pair: [bc, bc] });
        if (bc[3] >= 1) break;
      }
      n = n.parentElement;
    }
    stack.push({ pair: [[255, 255, 255, 1], [255, 255, 255, 1]] });
    // Composite from the bottom of the stack upward.
    const out = [0, 1].map((side) => {
      let acc = stack[stack.length - 1].pair[side];
      for (let i = stack.length - 2; i >= 0; i--) acc = composite(stack[i].pair[side], acc);
      return acc.slice(0, 3).map(Math.round);
    });
    return out;
  }

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
      fg: parse(cs.color),
      back: backdrop(el),
      // WCAG 2.1: 18pt (24px), or 14pt (18.66px) when bold.
      large: size >= 24 || (weight >= 700 && size >= 18.66),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 34),
    });
  }
  return out;
};

const lum = ([r, g, b]) => {
  const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

/**
 * backdrop() returns the composited colour under each END of the element's own
 * box. The worse of the two governs — that is the point of sampling
 * positionally rather than taking the gradient's worst stop, which blamed text
 * for a colour on the far side of a banner it never touches.
 */
function score(r) {
  const [a, b] = r.back;
  const ra = ratio(r.fg, a), rb = ratio(r.fg, b);
  const same = a.join() === b.join();
  return {
    value: Math.min(ra, rb),
    on: same ? `rgb(${a.join(',')})` : `rgb(${a.join(',')}) → rgb(${b.join(',')}) across its own box`,
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
