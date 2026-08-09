/**
 * PLAN-8 C37 — measure the empty regions the audit named, BEFORE changing any
 * of them. C37 is explicitly not a licence to redesign, so this exists to find
 * which of the four claims are real and how big each one is, so the change can
 * be the smallest one that moves a real number.
 *
 * The four claims:
 *   1. the homepage hero right column is empty below the four stat cards (~280px)
 *   2. the page-header band is empty on its right half on all nine inner pages
 *   3. the contact page left rail ends ~320px above the form
 *   4. the Industries cards gap between certification chips and CTAs
 *
 * Measured against LEAF text elements, not wrappers: the band's inner
 * container is full-width by construction, so measuring children reports zero
 * slack on a band that is visibly half empty.
 *
 * Usage: node _harness/probe-deadspace.js [--after]
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-deadspace');
const TAG = process.argv.includes('--after') ? 'after' : 'before';

const INNER = ['/products', '/dashboard', '/datasheets', '/industries', '/services',
  '/about', '/faq', '/contact', '/privacy'];

/**
 * Union rect of the actual GLYPHS under `root`, measured with a Range over
 * each text node.
 *
 * Not element boxes: a block-level <h1> is as wide as its container whatever
 * its text says, so an element-box measurement reports a band that is visibly
 * half empty as 100% full. This is the same mistake backdrop.js was written to
 * fix — the page eyebrow box is 1232px wide and its text is 83px, and that
 * difference was the whole of one wrong finding in WHATS_LEFT §2.
 */
const INK = `
window.__ink = function (root) {
  var best = null;
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  var n;
  while ((n = walker.nextNode())) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    var p = n.parentElement;
    if (!p) continue;
    var cs = getComputedStyle(p);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    var range = document.createRange();
    range.selectNodeContents(n);
    var rects = range.getClientRects();
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (r.width <= 0 || r.height <= 0) continue;
      if (!best) best = { l: r.left, t: r.top, r: r.right, b: r.bottom };
      else {
        best.l = Math.min(best.l, r.left); best.t = Math.min(best.t, r.top);
        best.r = Math.max(best.r, r.right); best.b = Math.max(best.b, r.bottom);
      }
    }
  }
  return best;
};
`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const out = {};

  for (const [w, h, tag] of [[1440, 900, '1440'], [390, 844, '390']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.addInitScript(INK);

    out[`header-${tag}`] = {};
    for (const r of INNER) {
      await page.goto(BASE + r, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      out[`header-${tag}`][r] = await page.evaluate(() => {
        const band = document.querySelector('.ipc-page-header');
        if (!band) return null;
        const br = band.getBoundingClientRect();
        const ink = window.__ink(band);
        const inner = band.firstElementChild;
        const cs = inner ? getComputedStyle(inner) : null;
        return {
          bandH: Math.round(br.height),
          inkW: ink ? Math.round(ink.r - ink.l) : 0,
          // How much of the band's width is right of the widest text.
          emptyRight: ink ? Math.round(br.right - ink.r) : null,
          emptyRightPct: ink ? Math.round(((br.right - ink.r) / br.width) * 100) : null,
          padTop: cs ? cs.paddingTop : null,
          padBottom: cs ? cs.paddingBottom : null,
        };
      });
    }

    // The contact rail: does its CONTENT end above the form's content?
    await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    out[`contact-rail-${tag}`] = await page.evaluate(() => {
      const form = document.querySelector('form[action="/contact.php"]');
      if (!form) return null;
      // Walk out until the ancestor has a sibling column that is NOT the form
      // and actually carries text — B26 reordered these, so the rail is after
      // the form in the DOM rather than before it.
      let formCol = form, row = form.parentElement, rail = null;
      while (row) {
        const sibs = [...row.children].filter((c) => c !== formCol && (c.textContent || '').trim().length > 40);
        if (sibs.length) { rail = sibs[sibs.length - 1]; break; }
        formCol = row; row = row.parentElement;
      }
      if (!rail || !formCol) return null;
      const ri = window.__ink(rail), fi = window.__ink(formCol);
      const rr = rail.getBoundingClientRect();
      return {
        railColH: Math.round(rr.height),
        railInkH: ri ? Math.round(ri.b - ri.t) : null,
        // The audit's claim: the rail's CONTENT stops this far above the
        // bottom of the form column.
        railInkEndsAboveForm: (ri && fi) ? Math.round(fi.b - ri.b) : null,
        railTrailingSlack: ri ? Math.round(rr.bottom - ri.b) : null,
      };
    });

    await ctx.close();
  }

  fs.writeFileSync(path.join(OUT, `deadspace-${TAG}.json`), JSON.stringify(out, null, 2));

  for (const tag of ['1440', '390']) {
    console.log(`\n── page-header band @${tag} (${TAG}) ──`);
    for (const [r, m] of Object.entries(out[`header-${tag}`])) {
      if (!m) { console.log(`  ${r.padEnd(13)} (no band)`); continue; }
      console.log(`  ${r.padEnd(13)} h ${String(m.bandH).padStart(4)}  pad ${String(m.padTop).padStart(5)}/${String(m.padBottom).padStart(5)}  inkW ${String(m.inkW).padStart(4)}  emptyRight ${String(m.emptyRight).padStart(4)} (${m.emptyRightPct}%)`);
    }
    const c = out[`contact-rail-${tag}`];
    console.log(`  contact rail @${tag}: colH=${c && c.railColH} inkH=${c && c.railInkH} endsAboveForm=${c && c.railInkEndsAboveForm} trailingSlack=${c && c.railTrailingSlack}`);
  }
  console.log(`\nrecord -> ${path.join(OUT, `deadspace-${TAG}.json`)}`);
  await browser.close();
})();
