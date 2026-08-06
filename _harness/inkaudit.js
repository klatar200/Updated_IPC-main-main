/**
 * Empirical brand-contrast audit.
 *
 * `brand-ink-translucent` is the follow-on to 4.23: text on owner-controlled
 * brand surfaces that still hardcodes rgba(255,255,255,α) and washes out when
 * the owner picks a pale color. The risk in fixing it is MIS-CLASSIFICATION —
 * deciding by source inspection which surface a given call site sits on, and
 * getting it wrong, which swaps in the wrong ink and creates a NEW contrast bug.
 * A source scan cannot catch that. This can.
 *
 * Method:
 *   - render every public route at two viewports under TWO palettes, the
 *     shipped navy and a pale one, by intercepting /data/site-info.json (no
 *     file on disk is touched, so there is nothing to restore and no cache to
 *     fight);
 *   - for every element that paints its own text, resolve the EFFECTIVE
 *     background — walk ancestors to the first opaque color, expand a
 *     linear-gradient into its stops and keep the worst, composite any
 *     translucent layer over what is behind it;
 *   - composite the (often translucent) foreground over that background and
 *     compute the WCAG ratio, with the large-text threshold where it applies.
 *
 * The report is the DIFFERENCE between the two palettes: elements that pass
 * under navy and fail under pale. Those are exactly the brand-sensitive sites.
 * Anything failing under both is a pre-existing, non-brand contrast problem and
 * is counted separately rather than mixed in — this audit is not a licence to
 * go fix the whole site.
 *
 * Needs the mirror on :8123.
 *
 * Usage: node _harness/inkaudit.js [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const ROUTES = ['/', '/products', '/industries', '/services', '/about', '/faq', '/contact', '/privacy'];
const VIEWPORTS = [{ w: 1440, h: 900 }, { w: 375, h: 812 }];

const PALETTES = {
  navy: { primaryColor: '#005DA3', darkColor: '#0D2D52', accentColor: '#00BEF2', accent2Color: '#119EC8' },
  pale: { primaryColor: '#FFE600', darkColor: '#FFF3A0', accentColor: '#FFF7C0', accent2Color: '#FFF7C0' },
};

const BASE_SITE_INFO = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine/site-info.json'), 'utf8')
);

/** Injected into the page. Returns one record per text-painting element. */
const COLLECTOR = function () {
  function parseColor(s) {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || '');
    if (!m) return null;
    return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  }

  /** rgb triples of every color stop in a linear-gradient, or [] if none. */
  function gradientStops(bgImage) {
    if (!bgImage || bgImage === 'none' || bgImage.indexOf('gradient') < 0) return [];
    const out = [];
    const re = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/g;
    let m;
    while ((m = re.exec(bgImage))) {
      const a = m[4] === undefined ? 1 : +m[4];
      // A fully transparent stop contributes nothing; a translucent scrim does,
      // but we handle that by keeping it and compositing below.
      out.push([+m[1], +m[2], +m[3], a]);
    }
    return out;
  }

  function over(fg, alpha, bg) {
    return [
      Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
      Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
      Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
    ];
  }

  /** Candidate opaque backgrounds this element's text is painted over. */
  function effectiveBackgrounds(el, depth) {
    if (!el || depth > 40) return [[255, 255, 255]];
    const cs = getComputedStyle(el);

    const stops = gradientStops(cs.backgroundImage);
    if (stops.length) {
      const behind = effectiveBackgrounds(el.parentElement, depth + 1);
      const out = [];
      for (const s of stops) {
        for (const b of behind) out.push(s[3] >= 1 ? [s[0], s[1], s[2]] : over(s, s[3], b));
      }
      return out;
    }

    const bc = parseColor(cs.backgroundColor);
    if (bc && bc[3] > 0) {
      if (bc[3] >= 1) return [[bc[0], bc[1], bc[2]]];
      const behind = effectiveBackgrounds(el.parentElement, depth + 1);
      return behind.map((b) => over(bc, bc[3], b));
    }
    return effectiveBackgrounds(el.parentElement, depth + 1);
  }

  function srgb(c) { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
  function lum(rgb) { return 0.2126 * srgb(rgb[0]) + 0.7152 * srgb(rgb[1]) + 0.0722 * srgb(rgb[2]); }
  function ratio(a, b) {
    const la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function paintsOwnText(el) {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim().length) return true;
    }
    return false;
  }

  function visible(el) {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    if (parseFloat(cs.opacity) === 0) return false;
    return true;
  }

  /** A stable-ish identity for an element, so the two runs can be diffed. */
  function keyOf(el) {
    const parts = [];
    let n = el, depth = 0;
    while (n && n.nodeName !== 'BODY' && depth < 6) {
      const p = n.parentElement;
      const idx = p ? [...p.children].indexOf(n) : 0;
      parts.unshift(n.nodeName + ':' + idx);
      n = p; depth++;
    }
    return parts.join('/');
  }

  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!paintsOwnText(el) || !visible(el)) continue;
    const cs = getComputedStyle(el);
    const fg = parseColor(cs.color);
    if (!fg) continue;

    const bgs = effectiveBackgrounds(el, 0);
    let worst = Infinity, worstBg = null;
    for (const bg of bgs) {
      const composed = fg[3] >= 1 ? [fg[0], fg[1], fg[2]] : over(fg, fg[3], bg);
      const r = ratio(composed, bg);
      if (r < worst) { worst = r; worstBg = bg; }
    }

    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);

    out.push({
      key: keyOf(el),
      tag: el.tagName,
      text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 42),
      color: cs.color,
      bg: worstBg ? `rgb(${worstBg.join(', ')})` : '?',
      ratio: Math.round(worst * 100) / 100,
      threshold: large ? 3.0 : 4.5,
      pass: worst >= (large ? 3.0 : 4.5),
    });
  }
  return out;
};

async function collect(browser, palette, route, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();

  const info = JSON.parse(JSON.stringify(BASE_SITE_INFO));
  info.theme = { ...(info.theme || {}), ...palette };

  // Intercept rather than write the mirror's data file: nothing to restore,
  // and no per-minute cache-buster / 60s TTL to fight.
  await page.route('**/site-info.json*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(info) })
  );

  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  const rows = await page.evaluate(COLLECTOR);
  await ctx.close();
  return rows;
}

(async () => {
  const verbose = process.argv.includes('--verbose');
  const browser = await launch();

  const brandSensitive = [];   // passes under navy, fails under pale
  const alwaysBad = [];        // fails under both — pre-existing, NOT this item
  let examined = 0;

  try {
    for (const route of ROUTES) {
      for (const vp of VIEWPORTS) {
        const navy = await collect(browser, PALETTES.navy, route, vp);
        const pale = await collect(browser, PALETTES.pale, route, vp);

        const navyBy = new Map(navy.map((r) => [r.key, r]));
        for (const p of pale) {
          const n = navyBy.get(p.key);
          if (!n) continue;              // element only exists in one run — skip
          examined++;
          if (n.pass && !p.pass) {
            brandSensitive.push({ route, vp: vp.w, ...p, navyRatio: n.ratio });
          } else if (!n.pass && !p.pass) {
            alwaysBad.push({ route, vp: vp.w, ...p, navyRatio: n.ratio });
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`examined ${examined} text-painting elements across ${ROUTES.length} routes × ${VIEWPORTS.length} viewports\n`);
  console.log(`BRAND-SENSITIVE (pass on navy, FAIL on pale): ${brandSensitive.length}`);
  console.log(`pre-existing, fail on both (NOT this item):    ${alwaysBad.length}\n`);

  // Group by the rendered color, which is what identifies the call site.
  const byColor = {};
  for (const r of brandSensitive) (byColor[r.color] ||= []).push(r);
  const colors = Object.keys(byColor).sort((a, b) => byColor[b].length - byColor[a].length);

  for (const c of colors) {
    const rows = byColor[c];
    console.log(`── color ${c}  (${rows.length} occurrences)`);
    const shown = verbose ? rows : rows.slice(0, 4);
    for (const r of shown) {
      console.log(`   ${r.route.padEnd(12)} @${String(r.vp).padEnd(5)} <${r.tag}> ${r.ratio}:1 (need ${r.threshold}, navy was ${r.navyRatio}) on ${r.bg}`);
      console.log(`       "${r.text}"`);
    }
    if (!verbose && rows.length > shown.length) console.log(`   … ${rows.length - shown.length} more`);
    console.log('');
  }

  console.log(`inkaudit: ${brandSensitive.length} brand-sensitive contrast failures`);
  process.exit(brandSensitive.length === 0 ? 0 : 1);
})();
