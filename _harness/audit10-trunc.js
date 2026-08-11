/**
 * AUDIT-10 pass-4 step 4.7 — truncation and slicing artifacts.
 *
 * Two halves:
 *  (1) from the dump — every rendered string that ends in "…", classified as
 *      cut-at-a-space or cut MID-WORD, plus the orphaned-open-bracket case;
 *  (2) in the browser — every element actually clipped by CSS (line-clamp or
 *      text-overflow:ellipsis), with the hidden character count, so a clip
 *      that changes meaning can be told from one that merely shortens.
 *
 * Usage: node _harness/audit10-trunc.js [url ...]   (default: the four pages
 *        that carry the JS slices — /products, /dashboard, a product page)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const DUMP = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'plans', 'audit10', 'state', 'textdump.json'), 'utf8'));

/* ---------- (1) dump half: mid-word cuts ---------- */
const midword = new Map();
const atspace = new Map();
for (const [url, entries] of Object.entries(DUMP)) {
  for (const e of entries) {
    if (e.kind === 'link-href') continue;
    const t = e.text.trim();
    if (!t.endsWith('…')) continue;
    const body = t.slice(0, -1);
    const tail = body.slice(-24);
    /* mid-word: the char before the ellipsis is a letter AND the token it ends
       is not a whole word (no trailing space, and the fragment is not itself a
       complete word bounded by punctuation). Report the fragment either way. */
    const lastTok = (body.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*$/u) || [''])[0];
    const key = JSON.stringify({ tail, kind: e.kind });
    const bucket = lastTok.length > 0 ? midword : atspace;
    if (!bucket.has(key)) bucket.set(key, { tail, kind: e.kind, frag: lastTok, urls: new Set(), full: t });
    bucket.get(key).urls.add(url.replace(/^\/products\?productId=.*/, '/products?productId=<42>'));
  }
}
const orphan = [];
for (const [url, entries] of Object.entries(DUMP)) {
  for (const e of entries) {
    if (e.kind === 'link-href') continue;
    const t = e.text.trim();
    if (!t.endsWith('…')) continue;
    const o = (t.match(/\(/g) || []).length - (t.match(/\)/g) || []).length;
    if (o !== 0) orphan.push({ url, text: t, kind: e.kind });
  }
}

console.log(`### ellipsis cuts that land INSIDE a word: ${midword.size} distinct`);
for (const v of [...midword.values()].sort((a, b) => b.urls.size - a.urls.size)) {
  console.log(`  …${JSON.stringify(v.tail)}   fragment=${JSON.stringify(v.frag)}  [${v.kind}]  ${v.urls.size} url(s)`);
  console.log(`      e.g. ${JSON.stringify(v.full.slice(0, 130))}`);
}
console.log(`\n### ellipsis cuts that land at a word boundary: ${atspace.size} distinct`);
for (const v of [...atspace.values()].slice(0, 10)) {
  console.log(`  …${JSON.stringify(v.tail)}  [${v.kind}]  ${v.urls.size} url(s)`);
}
console.log(`\n### truncations leaving an unclosed "(": ${orphan.length}`);
const oseen = new Set();
for (const o of orphan) {
  if (oseen.has(o.text)) continue; oseen.add(o.text);
  console.log(`  ${o.url} [${o.kind}] ${JSON.stringify(o.text)}`);
}

/* ---------- (2) browser half: CSS clipping ---------- */
const URLS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['/', '/products', '/dashboard', '/datasheets', '/faq',
     '/products?productId=IP29CG', '/products?productId=IP13SP'];

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  console.log('\n### CSS-clipped elements at desktop-1440 (hidden chars estimated by px)');
  for (const url of URLS) {
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(400);
    const clipped = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        if (!el.textContent || !el.textContent.trim()) continue;
        if (el.children.length && [...el.children].some((c) => c.textContent.trim())) continue;
        const cs = getComputedStyle(el);
        const clampY = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
        const ellipsisX = cs.textOverflow === 'ellipsis' && cs.overflow !== 'visible';
        if (!clampY && !ellipsisX) continue;
        const hidY = el.scrollHeight - el.clientHeight;
        const hidX = el.scrollWidth - el.clientWidth;
        if (hidY <= 1 && hidX <= 1) continue;
        out.push({
          tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
            ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
          clampY: clampY ? cs.webkitLineClamp : null,
          ellipsisX,
          hiddenPx: clampY ? hidY : hidX,
          lineHeight: parseFloat(cs.lineHeight) || null,
          text: el.textContent.trim().slice(0, 90),
        });
      }
      return out;
    });
    const byTag = new Map();
    for (const c of clipped) {
      const k = c.tag + '|' + (c.clampY || 'x');
      if (!byTag.has(k)) byTag.set(k, { ...c, n: 0, max: 0 });
      const r = byTag.get(k); r.n++; r.max = Math.max(r.max, c.hiddenPx);
    }
    console.log(`  ${url}: ${clipped.length} clipped element(s)`);
    for (const r of byTag.values()) {
      console.log(`      ${r.tag}  clamp=${r.clampY || '-'} ellipsisX=${r.ellipsisX}  n=${r.n}  maxHidden=${r.max}px  e.g. ${JSON.stringify(r.text)}`);
    }
  }
  await browser.close();
})();
