/**
 * 4.32 measurement (one-shot, kept as evidence): what size is every image
 * actually PAINTED at, across every route and all 42 product pages, at 1440
 * and 375?
 *
 * Resizing has to be driven by the rendered box, not by a guess. Front-Cover
 * is 1700x2200 and 1.5 MB; if it is painted at 300px wide, that is the number
 * that decides the re-encode target. Reports the largest CSS box each file is
 * ever painted at, doubled for a 2x display, next to its intrinsic size.
 *
 * Usage: node _harness/imgsizes.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const ROUTES = ['/', '/products', '/industries', '/services', '/about', '/faq', '/contact', '/privacy', '/dashboard'];
const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8'));

(async () => {
  const browser = await launch();
  const seen = new Map();   // url -> {natW,natH,maxCssW,maxCssH,where,lazy,dimAttrs}

  for (const w of [1440, 375]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const urls = [...ROUTES, ...products.map((p) => `/products?productId=${encodeURIComponent(p.id)}`)];
    for (const u of urls) {
      await page.goto(BASE + u, { waitUntil: 'networkidle' });
      // Scroll the whole page so lazy images (if any) resolve.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 10));
        }
        window.scrollTo(0, 0);
      });
      const found = await page.evaluate(() =>
        [...document.querySelectorAll('img')].map((im) => {
          const r = im.getBoundingClientRect();
          return {
            src: im.currentSrc || im.src,
            natW: im.naturalWidth, natH: im.naturalHeight,
            cssW: Math.round(r.width), cssH: Math.round(r.height),
            lazy: im.getAttribute('loading') || '',
            attrW: im.getAttribute('width') || '', attrH: im.getAttribute('height') || '',
          };
        }));
      for (const f of found) {
        if (!f.src || !f.src.includes('/images/')) continue;
        const key = f.src.replace(BASE, '');
        const prev = seen.get(key) || { natW: f.natW, natH: f.natH, maxCssW: 0, maxCssH: 0, where: u, lazy: f.lazy, attrW: f.attrW, attrH: f.attrH, count: 0 };
        prev.natW = f.natW || prev.natW;
        prev.natH = f.natH || prev.natH;
        if (f.cssW > prev.maxCssW) { prev.maxCssW = f.cssW; prev.maxCssH = f.cssH; prev.where = `${u} @${w}`; }
        prev.lazy = prev.lazy || f.lazy;
        prev.attrW = prev.attrW || f.attrW;
        prev.count += 1;
        seen.set(key, prev);
      }
    }
    await ctx.close();
  }
  await browser.close();

  const rows = [...seen.entries()].sort((a, b) => b[1].maxCssW - a[1].maxCssW);
  console.log('intrinsic   painted(max)  2x-target  lazy attrs  file');
  for (const [url, v] of rows) {
    console.log(
      `${(v.natW + 'x' + v.natH).padStart(11)} ${(v.maxCssW + 'x' + v.maxCssH).padStart(11)}` +
      `  ${String(v.maxCssW * 2).padStart(6)}  ${(v.lazy || '-').padEnd(6)} ${(v.attrW ? 'yes' : 'no').padEnd(4)} ${url}`);
  }
  console.log(`\n${rows.length} distinct images painted`);
  const unreferenced = [];
  for (const dir of ['products', 'site', '_unmatched']) {
    const d = path.join(__dirname, '..', 'public', 'images', dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!rows.some(([u]) => u.endsWith('/' + f))) unreferenced.push(`images/${dir}/${f}`);
    }
  }
  console.log(`\nnever painted on any page (${unreferenced.length}):\n  ${unreferenced.join('\n  ')}`);
})();
