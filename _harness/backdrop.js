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
  /* PLAN-7 item 1a — the skip is loud now.
   *
   * The layer walk below did \`if (!g) continue;\` on any layer parseLinear
   * could not read, which is every url(), radial-gradient, conic-gradient and
   * image-set(). It then composited whatever layers it DID understand over
   * whatever sat BELOW the unreadable one, and returned a confident number for
   * a background no visitor ever sees.
   *
   * Unreachable when this was found — nothing on the site has a raster
   * background — and PLAN-7 item 2 was about to put one on the highest-traffic
   * element there is. A silent skip in the one file three contrast suites
   * trust is the same failure mode as the box-versus-ink error that produced
   * WHATS_LEFT §2's false "nothing passes AA in the page header" claim.
   *
   * Deliberately NOT a third element on the returned array: plan5c-eyebrow
   * does \`back.map((bg) => __ipcOver(fg, bg))\`, so an appended flag would be
   * composited as if it were a colour. A separate accumulator cannot be
   * destructured into by accident, and survives the page.evaluate boundary as
   * plain data.
   */
  window.__ipcBackdropSkips = [];

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
          if (!g) {
            // Loud, not silent. Anything that is not a linear-gradient cannot
            // be evaluated by gradient maths at all — score it with
            // worstPixel() instead (item 1b).
            window.__ipcBackdropSkips.push({
              tag: n.tagName.toLowerCase(),
              cls: (typeof n.className === 'string' ? n.className : '').slice(0, 60),
              layer: layer.slice(0, 80),
              forText: (el.textContent || '').trim().slice(0, 40),
            });
            continue;
          }
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

  /* PLAN-7 item 1b — the pixel primitive.
   *
   * Gradient maths cannot answer "what is behind this glyph" over a
   * photograph. These two halves let a suite read the REAL painted pixels
   * instead: __ipcInkBox gives the ink rect in PAGE coordinates so Node can
   * clip a screenshot to it, and __ipcWorstFromDataUri hands the resulting PNG
   * back to Chromium to decode on a canvas.
   *
   * Round-tripping the image sounds wasteful and is not: the clips are ink
   * rects, a few thousand pixels, and it means no PNG decoder dependency in a
   * repo with a $0 budget — decoded by the same engine that painted it. */

  /** The ink rect in PAGE coordinates (viewport rect + scroll offset). */
  window.__ipcInkBox = function (el) {
    const r = inkRect(el);
    return {
      x: Math.max(0, Math.floor(r.left + window.scrollX)),
      y: Math.max(0, Math.floor(r.top + window.scrollY)),
      width: Math.max(1, Math.ceil(r.right - r.left)),
      height: Math.max(1, Math.ceil(r.bottom - r.top)),
    };
  };

  /**
   * Decode a PNG data URI and return the WORST pixel in it.
   *
   * "Worst" is relative to the ink being scored: for light ink the worst
   * background pixel is the LIGHTEST one, for dark ink the darkest. The mean
   * is the wrong statistic and quietly passes the real failure — a white
   * headline over a photo that is 90% dark and 10% chrome highlight averages
   * to a comfortable pass and is illegible exactly where the highlight is.
   */
  window.__ipcWorstFromDataUri = function (uri, mode) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const rel = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
        let worst = null, worstL = mode === 'light' ? -1 : 2;
        for (let i = 0; i < d.length; i += 4) {
          const px = [d[i], d[i + 1], d[i + 2]];
          const L = 0.2126 * rel(px[0]) + 0.7152 * rel(px[1]) + 0.0722 * rel(px[2]);
          if (mode === 'light' ? L > worstL : L < worstL) { worstL = L; worst = px; }
        }
        resolve({ px: worst, lum: worstL, w: c.width, h: c.height });
      };
      img.onerror = () => reject(new Error('could not decode the screenshot'));
      img.src = uri;
    });
  };
})();`;

const lum = ([r, g, b]) => {
  const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

/**
 * PLAN-7 item 1b, Node half — the worst pixel actually painted under an
 * element's ink.
 *
 * Screenshots the ink rect and hands the PNG back to the page to decode. Use
 * this instead of __ipcBackdrop wherever __ipcBackdropSkips is non-empty:
 * that flag means the gradient walk could not see a layer, and its answer is
 * for a background the visitor never sees.
 *
 *   mode 'light'  worst = the LIGHTEST pixel   (scoring light ink)
 *   mode 'dark'   worst = the DARKEST pixel    (scoring dark ink)
 *
 * Returns { px:[r,g,b], lum, w, h } or null when the element has no ink.
 */
async function worstPixel(page, handle, mode = 'light') {
  const box = await page.evaluate((el) => window.__ipcInkBox(el), handle);
  if (!box || box.width < 1 || box.height < 1) return null;
  // Clip to the viewport-independent page box. fullPage so a rect below the
  // fold is still captured rather than silently clamped to the viewport.
  const buf = await page.screenshot({ clip: box, fullPage: true });
  const uri = 'data:image/png;base64,' + buf.toString('base64');
  return page.evaluate(
    ([u, m]) => window.__ipcWorstFromDataUri(u, m),
    [uri, mode]
  );
}

/** Every background layer the gradient walk could not evaluate, this page. */
async function skippedLayers(page) {
  return page.evaluate(() => (window.__ipcBackdropSkips || []).slice());
}

module.exports = { SOURCE, lum, ratio, worstPixel, skippedLayers };
