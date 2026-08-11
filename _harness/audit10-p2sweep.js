/**
 * AUDIT-10 pass-2 — the numeric layout sweep at tablet-834 and mobile-390.
 *
 * Pass-1's audit10-p1sweep.js measured 1440 and 1024. This is the small-screen
 * twin, plus the failure classes that only exist below lg: horizontal document
 * overflow, element-level clipping, long unbroken tokens (compound SKUs),
 * stacking order, and fixed/sticky chrome.
 *
 * NO touch emulation here — viewports.json says historical measurements were
 * taken without it, and audit10-p2tap.js owns the coarse-pointer measurements.
 *
 * Usage: node _harness/audit10-p2sweep.js [--font "Liberation Sans"]  (needs :8123)
 * Output: _harness/out/audit10/p2sweep[.font].json
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10');

const argv = process.argv.slice(2);
const fontIdx = argv.indexOf('--font');
const FORCE_FONT = fontIdx >= 0 ? argv[fontIdx + 1] : null;

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);

const VIEWPORTS = [
  { name: 'tablet-834', width: 834, height: 1112 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const URLS = [
  '/', '/products', '/services', '/industries', '/about',
  '/contact', '/dashboard', '/datasheets', '/faq', '/privacy',
  ...['Tape', 'Heat Shrink Tubing', 'Adhesive'].map((f) => '/dashboard?family=' + encodeURIComponent(f)),
  ...products.map((p) => '/products?productId=' + encodeURIComponent(p.id)),
];

/** Runs inside the page. Everything measured here is a used value, not a rule. */
const measure = () => {
  const vw = document.documentElement.clientWidth;
  const sig = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };
  const txt = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);

  // ── 1. document-level horizontal overflow ────────────────────────────────
  const overflowX = Math.round(Math.max(
    document.documentElement.scrollWidth - vw,
    document.body ? document.body.scrollWidth - vw : 0
  ));
  const protruding = [];
  if (overflowX > 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && protruding.length < 12) {
        protruding.push({ el: sig(el), text: txt(el), left: +r.left.toFixed(1), right: +r.right.toFixed(1) });
      }
    }
  }

  // ── 2. element-level clipping: content wider than its own box ────────────
  // overflow-x auto/scroll => a scroller (intended, but report the amount);
  // overflow-x hidden/clip => genuinely lost pixels.
  const clipped = [];
  const scrollers = [];
  for (const el of document.querySelectorAll('body *')) {
    const over = el.scrollWidth - el.clientWidth;
    if (over <= 1 || !el.clientWidth) continue;
    const cs = getComputedStyle(el);
    const rec = { el: sig(el), text: txt(el), over: Math.round(over), clientWidth: el.clientWidth, overflowX: cs.overflowX };
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') scrollers.push(rec);
    else if (cs.overflowX === 'hidden' || cs.overflowX === 'clip') clipped.push(rec);
  }

  // ── 3. long unbroken tokens (compound SKUs are the stress case) ──────────
  // Every leaf element carrying a token >= 14 chars with no space in it:
  // does the token's own painted width fit inside its container's content box?
  const longTokens = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  let n;
  while ((n = walker.nextNode())) {
    const raw = (n.nodeValue || '').trim();
    if (!raw) continue;
    for (const tok of raw.split(/\s+/)) {
      if (tok.length < 14) continue;
      const host = n.parentElement;
      if (!host) continue;
      const key = tok + '|' + sig(host);
      if (seen.has(key)) continue;
      seen.add(key);
      const i = n.nodeValue.indexOf(tok);
      if (i < 0) continue;
      range.setStart(n, i);
      range.setEnd(n, i + tok.length);
      const rects = [...range.getClientRects()];
      if (!rects.length) continue;
      const hostRect = host.getBoundingClientRect();
      const hcs = getComputedStyle(host);
      const padL = parseFloat(hcs.paddingLeft) || 0;
      const padR = parseFloat(hcs.paddingRight) || 0;
      const innerL = hostRect.left + padL;
      const innerR = hostRect.right - padR;
      const tokL = Math.min(...rects.map((r) => r.left));
      const tokR = Math.max(...rects.map((r) => r.right));
      longTokens.push({
        token: tok.slice(0, 40),
        host: sig(host),
        parts: rects.length,                       // >1 => the token itself broke across lines
        pastRight: +Math.max(0, tokR - innerR).toFixed(1),
        pastLeft: +Math.max(0, innerL - tokL).toFixed(1),
        pastViewport: +Math.max(0, tokR - vw).toFixed(1),
        wordBreak: hcs.wordBreak, overflowWrap: hcs.overflowWrap, hyphens: hcs.hyphens,
      });
    }
  }
  range.detach && range.detach();

  // ── 4. fixed / sticky chrome ─────────────────────────────────────────────
  const fixedEls = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    fixedEls.push({
      el: sig(el), position: cs.position, text: txt(el),
      top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1),
      left: +r.left.toFixed(1), right: +r.right.toFixed(1),
      w: +r.width.toFixed(1), h: +r.height.toFixed(1), z: cs.zIndex,
    });
  }

  // ── 5. left-edge histogram (pass-1's alignment measure, re-applied) ──────
  const edges = {};
  for (const el of document.querySelectorAll('h1,h2,h3,h4,p,li,blockquote')) {
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 4) continue;
    if (!(el.textContent || '').trim()) continue;
    const k = Math.round(r.left);
    edges[k] = (edges[k] || 0) + 1;
  }

  return {
    vw, overflowX, protruding, clipped, scrollers, longTokens, fixedEls,
    edgeHistogram: Object.entries(edges).sort((a, b) => b[1] - a[1]).slice(0, 8),
    docHeight: document.documentElement.scrollHeight,
    bodyPaddingBottom: getComputedStyle(document.body).paddingBottom,
    bodyClass: document.body.className,
  };
};

/** After scrolling to the bottom: what does fixed chrome cover down there? */
const measureAtBottom = () => {
  const vh = window.innerHeight;
  const out = { scrollY: Math.round(window.scrollY), covered: [] };
  const fixed = [...document.querySelectorAll('body *')].filter((el) => {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.top < vh && r.bottom > 0;
  });
  out.fixedCount = fixed.length;
  for (const f of fixed) {
    const fr = f.getBoundingClientRect();
    const hits = [];
    // Sample the fixed element's band for content painted underneath it.
    for (const el of document.querySelectorAll('a,button,p,h1,h2,h3,li,td,th,span,input,label')) {
      if (f.contains(el) || el.contains(f)) continue;
      const t = (el.textContent || '').trim();
      if (!t) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (r.bottom <= fr.top || r.top >= fr.bottom) continue;
      if (r.right <= fr.left || r.left >= fr.right) continue;
      // only leaf-ish text so a wrapping <div> does not count as covered
      if (el.children.length > 2) continue;
      hits.push({
        el: el.tagName.toLowerCase(), text: t.replace(/\s+/g, ' ').slice(0, 50),
        top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1),
      });
      if (hits.length >= 8) break;
    }
    out.covered.push({
      el: f.tagName.toLowerCase() + (typeof f.className === 'string' ? '.' + f.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
      band: [+fr.top.toFixed(1), +fr.bottom.toFixed(1)], hits,
    });
  }
  return out;
};

(async () => {
  const browser = await launch();
  const rows = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    if (FORCE_FONT) {
      await page.addStyleTag({ content: `* { font-family: "${FORCE_FONT}" !important; }` }).catch(() => {});
      await page.addInitScript((f) => {
        window.addEventListener('DOMContentLoaded', () => {
          const s = document.createElement('style');
          s.textContent = `* { font-family: "${f}" !important; }`;
          document.head.appendChild(s);
        });
      }, FORCE_FONT);
    }
    for (const url of URLS) {
      try {
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 400) {
            window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 20));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(400);
        const top = await page.evaluate(measure);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(400);
        const bottom = await page.evaluate(measureAtBottom);
        rows.push({ url, viewport: vp.name, ...top, bottom });
      } catch (e) {
        rows.push({ url, viewport: vp.name, error: String(e).slice(0, 200) });
      }
      process.stdout.write('.');
    }
    await ctx.close();
    console.log(` ${vp.name} done`);
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, FORCE_FONT ? 'p2sweep.font.json' : 'p2sweep.json');
  fs.writeFileSync(file, JSON.stringify(rows, null, 1));

  // ── console summary ───────────────────────────────────────────────────────
  const ov = rows.filter((r) => r.overflowX > 1);
  console.log(`\n== document overflowX > 1px: ${ov.length} of ${rows.length} page x viewport`);
  for (const r of ov.slice(0, 20)) console.log(`   ${r.viewport} ${r.url} +${r.overflowX}px  ${JSON.stringify(r.protruding.slice(0, 3))}`);

  const clip = rows.filter((r) => (r.clipped || []).length);
  console.log(`== elements clipped by overflow:hidden: ${clip.length} pages`);
  for (const r of clip.slice(0, 20)) console.log(`   ${r.viewport} ${r.url} :: ${r.clipped.slice(0, 3).map((c) => `${c.el} +${c.over}px`).join(', ')}`);

  const tokBad = rows.map((r) => ({ ...r, bad: (r.longTokens || []).filter((t) => t.pastRight > 1 || t.pastViewport > 1) }))
    .filter((r) => r.bad.length);
  console.log(`== long tokens painting past their container: ${tokBad.length} pages`);
  for (const r of tokBad.slice(0, 25)) console.log(`   ${r.viewport} ${r.url} :: ${r.bad.slice(0, 3).map((t) => `${t.token} +${t.pastRight}px (${t.host})`).join(', ')}`);

  const tokSplit = rows.map((r) => ({ ...r, sp: (r.longTokens || []).filter((t) => t.parts > 1) })).filter((r) => r.sp.length);
  console.log(`== long tokens broken across lines: ${tokSplit.length} pages`);
  for (const r of tokSplit.slice(0, 25)) console.log(`   ${r.viewport} ${r.url} :: ${r.sp.slice(0, 3).map((t) => `${t.token} in ${t.parts} parts (wordBreak=${t.wordBreak})`).join(', ')}`);

  const cov = rows.filter((r) => r.bottom && (r.bottom.covered || []).some((c) => c.hits.length));
  console.log(`== fixed chrome covering text at max scroll: ${cov.length} pages`);
  for (const r of cov.slice(0, 20)) {
    const c = r.bottom.covered.find((x) => x.hits.length);
    console.log(`   ${r.viewport} ${r.url} :: ${c.el} band ${c.band} over ${JSON.stringify(c.hits.slice(0, 2))}`);
  }
  console.log(`\n-> ${file}`);
})();
