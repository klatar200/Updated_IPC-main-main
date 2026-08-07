/**
 * The composited-background measurement shared by every contrast suite.
 *
 * This was inlined in `brandtext.js`. It moved here the moment a second suite
 * (`plan5c-eyebrow.js`) needed the same answer, because the alternative is a
 * second implementation of gradient sampling and alpha compositing that agrees
 * with the first only until one of them is fixed. `contrastparity.js` exists
 * precisely because two implementations of contrast maths had already drifted
 * once; this file is that lesson applied ahead of time rather than after.
 *
 * Node side: `lum()` / `ratio()` — WCAG 2.1 relative luminance.
 * Browser side: `SOURCE`, a string that installs `window.__ipcBackdrop`.
 *
 *   await page.evaluate(SOURCE);
 *   await page.evaluate(() => window.__ipcBackdrop(el));   // -> [rgbA, rgbB]
 *
 * It is a source STRING rather than a function because Playwright serialises a
 * function without its closure: helpers defined outside the evaluated function
 * are simply not there at run time.
 *
 * What it does that a naive implementation does not:
 *   - composites translucent layers down to the first opaque paint, so
 *     rgba(17,158,200,0.1) over white scores as the near-white tint it is and
 *     not as cyan (that error reported a failing chip as passing at 1.69:1)
 *   - samples a linear-gradient AT THE POSITION OF THE GLYPHS, at both ends of
 *     the text's ink, and returns both so the caller can take the worse. Not
 *     the element's box — see inkRect().
 */

/** Installs `window.__ipcBackdrop(el) -> [[r,g,b], [r,g,b]]`. */
const SOURCE = `(() => {
  const parse = (s) => {
    const m = /rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/.exec(s || '');
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
  };

  /* ── Gradient evaluation ──────────────────────────────────────────────────
   * A gradient must be sampled WHERE THE TEXT IS, not reduced to its worst
   * stop. The first draft of brandtext.js did the latter and reported the
   * homepage hero at 1.00:1 — because the brand gradient's far end happens to
   * equal the text colour, at a position the text never reaches. It also read
   * rgba(20,20,20,0.72) as opaque #141414, ignoring that the layer above the
   * brand gradient is a translucent scrim. Both made it cry wolf, which is how
   * an auditor gets ignored.                                                 */

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
    const m = /^linear-gradient\\((.*)\\)$/s.exec(layer.trim());
    if (!m) return null;
    const parts = splitTop(m[1]);
    let angle = 180;
    if (/deg\\s*$/.test(parts[0])) { angle = parseFloat(parts[0]); parts.shift(); }
    else if (/^to\\s/.test(parts[0])) { angle = KEYWORD_ANGLE[parts[0].trim()] ?? 180; parts.shift(); }
    const stops = [];
    for (const p of parts) {
      const c = /rgba?\\([^)]*\\)/.exec(p);
      if (!c) continue;
      const pos = /(-?[\\d.]+)%/.exec(p.slice(c[0].length));
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
   * Where the sampled rect's corners fall along the gradient axis of the given
   * painting box. CSS 0deg points up, 90deg right; the axis length is
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
   * The extent the GLYPHS occupy, not the element's box.
   *
   * Sampling a gradient across the box is wrong whenever the text does not fill
   * it, and it is wrong by a lot: the page-header eyebrow's <div> is 1232px wide
   * and its text ink is 83px — 7% — so 1150px of gradient the glyphs never touch
   * was governing the score. That is the whole of WHATS_LEFT §2's claim that
   * "nothing passes AA there without changing the page-header design"; measured
   * under the actual glyphs, white clears AA and the fix is one line.
   *
   * Range.getClientRects() gives a rect per line box, so wrapped text is
   * measured as the union of the lines it really paints on and not as the
   * rectangle bounding them (which would re-introduce the same error at the
   * ends of a short last line). Zero-area rects are dropped; an element whose
   * text nodes yield nothing falls back to the box.
   */
  function inkRect(el) {
    const range = document.createRange();
    let box = null;
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (!r.width || !r.height) continue;
        box = box
          ? { left: Math.min(box.left, r.left), top: Math.min(box.top, r.top),
              right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) }
          : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      }
    }
    return box || el.getBoundingClientRect();
  }

  /**
   * The real painted colour behind \`el\`, sampled at both ends of its INK.
   * Returns two rgb triples; the worse of the two governs.
   */
  window.__ipcBackdrop = function (el) {
    const rect = inkRect(el);
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
    return [0, 1].map((side) => {
      let acc = stack[stack.length - 1].pair[side];
      for (let i = stack.length - 2; i >= 0; i--) acc = composite(stack[i].pair[side], acc);
      return acc.slice(0, 3).map(Math.round);
    });
  };

  /** Composite a possibly-translucent ink over an already-opaque background. */
  window.__ipcOver = (fg, bg) => composite(fg, bg.concat(1)).slice(0, 3).map(Math.round);
  window.__ipcParse = parse;
})();`;

const lum = ([r, g, b]) => {
  const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

module.exports = { SOURCE, lum, ratio };
