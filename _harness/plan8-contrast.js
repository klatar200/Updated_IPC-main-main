/**
 * PLAN-8 B8, B9, B10 — the NEUTRAL contrast sweep.
 *
 * `brandtext.js` scores only text painted in a BRAND colour, because that is
 * what the brand-ink migration was about. So the greys and the white-alpha
 * values were never in scope, and three of the worst ratios on the site sat
 * outside every existing suite:
 *
 *   B8  rgb(196,203,212) on white, 12px bold — 1.64:1 — the part numbers in
 *       the catalog sidebar, ~80 instances. The one string a buyer scans a
 *       catalog for, and at 390px it is nearly invisible.
 *   B9  rgb(156,163,175) (Tailwind gray-400) on white and #f8fafc, 10-12px —
 *       2.37-2.54:1, ~65 instances.
 *   B10 rgba(255,255,255,0.45) on #0a2240 — 4.25:1 at 12px, 99 instances; and
 *       rgba(255,255,255,0.3) — 2.64:1, 22 instances.
 *
 * This sweeps EVERY element that paints its own text, on every route plus
 * three product pages, at 1440 and 390, and fails anything under threshold.
 *
 * It reuses backdrop.js rather than measuring its own background. That file is
 * the shared core precisely so a second implementation of gradient sampling
 * and alpha compositing cannot drift from the first — the lesson
 * contrastparity.js exists to enforce. It composites translucent layers down
 * to the first opaque paint, which is what B10 needs: rgba(255,255,255,0.45)
 * is not white, and scoring it as white is how 121 failing instances went
 * unnoticed.
 *
 * CSS `opacity` on the element or any ancestor fades the ink the same way and
 * is folded into its alpha (AUDIT-12 A12-L13-06-W5-1: the Product Index chip
 * counts at opacity 0.65 scored 10.31:1 for a real 3.77:1).
 *
 * Usage:
 *   node _harness/plan8-contrast.js            (needs :8123)
 *   node _harness/plan8-contrast.js --report   full table, no verdict
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');
const { SOURCE, ratio } = require('./backdrop');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-contrast');
const REPORT = process.argv.includes('--report');

const ROUTES = ['/', '/products', '/dashboard', '/datasheets', '/industries',
                '/services', '/about', '/faq', '/contact', '/privacy',
                // Two states this plan CREATED or rewrote, and which the first
                // version of this sweep never visited — found while auditing
                // the phases back. Both carry recoloured text:
                //   ?sent=1  the quote confirmation (B16/B17/B18), reachable
                //            only after a submit, so a plain /contact visit
                //            renders the form and never the panel
                //   /quality an unknown segment, i.e. the A5 not-found page
                '/contact?sent=1',
                '/quality'];
const PRODUCTS = ['CC', 'IP33PO', 'IP63ES'];

/**
 * What this suite judges, and what it deliberately leaves alone.
 *
 * B8, B9 and B10 are all text on a FLAT surface — white, #f8fafc, #f5f7fa, and
 * the footer's #0a2240. That is exactly the ground `brandtext.js` never
 * covered, and it is what this file owns.
 *
 * Text on a GRADIENT is a different, already-logged problem:
 * `brand-text-on-brand-surface` and `page-header-sublines-on-gradient`
 * (WHATS_LEFT §2), which `brandtext.js`, `plan5c-eyebrow.js` and
 * `plan5c-brandink.js` own between them and which PLAN-8 Phase E does not
 * list. Judging them here would make this file red for someone else's item and
 * would make a new neutral regression indistinguishable from the old brand
 * one.
 *
 * The discriminator is MEASURED, not an allow-list of colours: backdrop.js
 * samples the composited background under each END of the element's own text
 * ink, so a gradient returns two different values and a flat surface returns
 * the same one twice. An allow-list would need updating every time the owner
 * changes a brand colour in Branding; this cannot go stale.
 */
const isGradientBacked = (r) => r.back[0].join() !== r.back[1].join();

/**
 * Is the INK itself a brand colour?
 *
 * `brandtext.js` is defined as "every element painting its own text in a brand
 * colour", so a chromatic ink is its business by definition — including the
 * teal arrows on white (2.18:1) and the accent SKU on the dark product header
 * (4.46:1), both of which belong to the logged `brand-color-as-foreground` and
 * `brand-text-on-brand-surface` items. Judged here they would be counted twice
 * and this suite would go red for work it is not doing.
 *
 * Achromatic means the channels are close: pure white and black, and the
 * near-neutral greys the site actually uses — rgb(196,203,212) spans 16 and
 * rgb(156,163,175) spans 19. A brand ink is nowhere near: rgb(0,190,242)
 * spans 242.
 */
const chan = (c) => [c[0], c[1], c[2]];
// 40, not 24: Tailwind's greys are blue-tinted — gray-700 rgb(55,65,81)
// spans 26 — so at 24 the Product Index chip counts were waved through as a
// "brand colour" that brandtext.js (which scores brand VARIABLES only) never
// looks at either (AUDIT-12 A12-L13-06-W5-1). slate-400 spans 36; the
// darkest brand ink, the navy rgb(10,34,64), spans 54.
const isChromaticInk = (r) => {
  const [x, y, z] = chan(r.fg);
  return Math.max(x, y, z) - Math.min(x, y, z) > 40;
};

/**
 * The one pairing this suite measures, reports, and does not fail on.
 *
 * The spec-table sub-header paints `var(--brand-header-ink)` on
 * `var(--brand-accent-2)` — 3.11:1 at 12px/600 on the shipped palette. Both
 * sides are COMPUTED from the owner's palette by the 4.23 machinery
 * (`ipc_ink_for`, mirrored in admin/config.php), so the fix is a change to how
 * that ink is derived, across all four palettes, which is 4.23's item and not
 * a neutral-sweep item. Hardcoding a colour here would look like a fix and
 * would be overridden the moment the owner picks a different brand colour in
 * Branding.
 *
 * Held as a named exemption with a count rather than a blanket rule, so a
 * SECOND brand-surface failure cannot hide behind it. Logged in WHATS_LEFT §2b.
 *
 * NAMED by what it is, measured in the page: a <th> whose computed ink is
 * --brand-header-ink and whose computed background is --brand-accent-2 (the
 * spec-table sub-header). It was only a count, so with that header fixed any
 * other failing neutral text took the free slot and the sweep stayed green,
 * labelled as "brand ink on a brand surface" (AUDIT-12 A12-L13-13-2).
 *
 * RATCHETED TO 0 (AUDIT-12 decision 20, A12-L14-W1-G4-1, Keagan 2026-10-14).
 * The deferral rested on a mis-measurement: each spec-table heading cell
 * sits on ONE solid colour, not on the page-header gradient, and on solid
 * #119EC8 the site's own inkFor() picks the dark ink at 5.92:1. The cells now
 * take the ink derived for their own surface (--brand-accent-2-ink /
 * --brand-primary-ink), so the pairing is gone and a header-ink <th> on
 * accent-2 coming back fails here. Never raise it.
 */
const EXEMPT_BRAND_SURFACE = 0;

/**
 * Gradient-backed NEUTRAL ink outside `.ipc-page-header`. The note above says
 * brandtext / plan5c-eyebrow / plan5c-brandink own all gradient-backed text;
 * they own brand-coloured ink and the page header only. The homepage quote
 * band and the Services lead-time banner fell between all of them (AUDIT-12
 * A12-L13-06-W5-2). Not judged at AA here (same reason as above: it is the
 * gradient item), but held as a RATCHET so the count cannot grow unnoticed.
 * Lower it when one is fixed; never raise it.
 */
const UNOWNED_GRADIENT_MAX = 8;

const collect = () => {
  // The two computed brand values the named exemption is defined by.
  const probe = document.createElement('i');
  document.body.appendChild(probe);
  probe.style.color = 'var(--brand-header-ink)';
  const headerInk = getComputedStyle(probe).color;
  probe.style.color = 'var(--brand-accent-2)';
  const accent2 = getComputedStyle(probe).color;
  probe.remove();
  const paintsOwnText = (el) => {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!paintsOwnText(el) || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const size = parseFloat(cs.fontSize) || 16;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const declared = window.__ipcParse(cs.color);
    if (!declared) continue;
    // CSS opacity fades the glyphs exactly as an alpha in the colour does, and
    // it multiplies down the tree. Ignoring it scored the Product Index chip
    // counts (rgb(55,65,81) at opacity 0.65) at 10.31:1 instead of 3.77:1
    // (AUDIT-12 A12-L13-06-W5-1).
    let op = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity) || 0;
    if (op === 0) continue;
    const fg = op < 1 ? [declared[0], declared[1], declared[2], (declared.length > 3 ? declared[3] : 1) * op] : declared;
    const back = window.__ipcBackdrop(el);
    out.push({
      color: op < 1 ? `${cs.color} at opacity ${+op.toFixed(3)}` : cs.color,
      fg,
      back,
      // The INK is the foreground composited over the background it sits on.
      //
      // Without this, a translucent ink scores as if it were opaque, and B10 is
      // entirely translucent inks: rgba(255,255,255,0.45) on the footer navy
      // reported 15.96:1 — the number for pure white — when the real composited
      // value is about 4.25:1. That is a failing row reported as one of the
      // best on the site, which is precisely the error this item exists to
      // correct, reproduced inside the tool measuring it.
      //
      // backdrop.js already provides __ipcOver for this and plan5c-eyebrow.js
      // already uses it; the first draft here simply did not. Composited
      // against each END separately, because a translucent ink over a gradient
      // is a different colour at each end.
      ink: back.map((bg) => window.__ipcOver(fg, bg)),
      alpha: fg[3],
      // WCAG 2.1: large is 18pt (24px), or 14pt (18.66px) when bold.
      large: size >= 24 || (weight >= 700 && size >= 18.66),
      size, weight,
      tag: el.tagName.toLowerCase(),
      specSub: el.tagName === 'TH' && cs.color === headerInk && cs.backgroundColor === accent2,
      inPageHeader: !!el.closest('.ipc-page-header'),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 40),
      text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40),
    });
  }
  return out;
};

/**
 * The worse of the two ends of the element's own text ink.
 *
 * Scores the COMPOSITED ink against the background it was composited over —
 * not the declared colour. See the note on `ink` in collect().
 */
function score(r) {
  const [a, b] = r.back;
  const ra = ratio(r.ink[0], a);
  const rb = ratio(r.ink[1], b);
  const worst = Math.min(ra, rb);
  const on = ra <= rb ? a : b;
  return { value: worst, on: `rgb(${on.join(',')})` };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const rows = [];

  try {
    for (const width of [1440, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 } });
      const page = await ctx.newPage();
      const urls = [
        ...ROUTES,
        ...PRODUCTS.map((p) => `/products?productId=${encodeURIComponent(p)}`),
      ];
      for (const u of urls) {
        await page.goto(BASE + u, { waitUntil: 'networkidle' });
        await page.evaluate(SOURCE);
        for (const r of await page.evaluate(collect)) {
          const s = score(r);
          rows.push({ ...r, width, url: u, ratio: s.value, on: s.on });
        }
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  // Collapse to distinct (colour, background, large) combinations — the same
  // shape brandtext reports, so the two are comparable by eye.
  const combos = new Map();
  for (const r of rows) {
    // A glyph with no letter or digit in it (the ▼ menu caret) is a graphical
    // object, not text: WCAG 1.4.11's 3:1, not 1.4.3's 4.5. Scored once
    // opacity was folded in (the caret is rgba(255,255,255,0.6) inside an
    // opacity-0.7 span: 3.67:1), it would otherwise fail as body text.
    const glyph = !/[\p{L}\p{N}]/u.test(r.text);
    const key = `${r.color}|${r.on}|${r.large}|${r.specSub}|${r.inPageHeader}|${glyph}`;
    const need = r.large || glyph ? 3 : 4.5;
    const prev = combos.get(key);
    if (!prev || r.ratio < prev.ratio) {
      combos.set(key, {
        ...r, need, pass: r.ratio >= need,
        gradient: isGradientBacked(r),
        count: (prev ? prev.count : 0) + 1,
      });
    } else {
      prev.count++;
    }
  }
  const all = [...combos.values()].sort((a, b) => a.ratio - b.ratio);
  const judged = all.filter((c) => !c.gradient && !isChromaticInk(c));
  const failing = judged.filter((c) => !c.pass);
  const exempt = failing.filter((c) => c.specSub);
  const unexempt = failing.filter((c) => !c.specSub);
  const unownedGradient = all.filter((c) => c.gradient && !isChromaticInk(c) && !c.inPageHeader && !c.pass);

  fs.writeFileSync(path.join(OUT, 'contrast.json'), JSON.stringify({ combos: all, rows: rows.length }, null, 2));

  if (REPORT) {
    console.log('ratio   need  large  n    colour                     on                        text');
    for (const c of all) {
      console.log(
        `${c.ratio.toFixed(2).padStart(5)}  ${String(c.need).padStart(4)}  ` +
        `${c.large ? 'yes' : ' no'}   ${String(c.count).padStart(3)}  ` +
        `${c.color.padEnd(26)} ${c.on.padEnd(24)} ${JSON.stringify(c.text)}` +
        `${c.gradient ? "   [gradient — logged open item]" : ""}`
      );
    }
    console.log(`\n${rows.length} text elements, ${all.length} distinct combinations, ` +
      `${failing.length} neutral failing`);
    return;
  }

  console.log(`swept ${rows.length} text-painting elements over ${ROUTES.length} routes ` +
    `+ ${PRODUCTS.length} product pages, at 1440 and 390`);
  console.log(`${all.length} distinct (colour x background x size) combinations; ` +
    `${all.length - judged.length} belong to brandtext's open item and are not judged here\n`);

  for (const c of unexempt) {
    console.log(`FAIL ${c.ratio.toFixed(2)}:1 (needs ${c.need}) ${c.color} on ${c.on}` +
      `\n       ${c.size}px/${c.weight} <${c.tag}> x${c.count} — ${JSON.stringify(c.text)}`);
  }
  for (const c of exempt) {
    console.log(`exempt ${c.ratio.toFixed(2)}:1 (needs ${c.need}) ${c.color} on ${c.on} <${c.tag}> x${c.count} — ` +
      `the spec-table sub-header: computed brand ink on a computed brand surface, 4.23's item (EXEMPT_BRAND_SURFACE)`);
  }
  const unownedOk = unownedGradient.length <= UNOWNED_GRADIENT_MAX;
  console.log(`${unownedOk ? 'ok  ' : 'FAIL'} ${unownedGradient.length} gradient-backed neutral combination(s) outside the page header below AA ` +
    `(ratchet: must not exceed ${UNOWNED_GRADIENT_MAX})` +
    (unownedOk ? '' : unownedGradient.map((c) => `\n       ${c.ratio.toFixed(2)}:1 ${c.color} <${c.tag}> ${c.url}@${c.width} — ${JSON.stringify(c.text)}`).join('')));

  const ok = unexempt.length === 0 && exempt.length <= EXEMPT_BRAND_SURFACE && unownedOk;
  console.log(`\nplan8-contrast ${judged.length - failing.length}/${judged.length} neutral combinations meet WCAG AA`);
  console.log(`record -> ${path.join(OUT, 'contrast.json')}`);
  process.exit(ok ? 0 : 1);
})();
