/**
 * One-shot: which spec tables actually overflow their column at 1440, and what
 * distinguishes them in the DATA? C49 needs a trigger the render can compute,
 * and column counts read straight out of products-all.json showed nothing —
 * every table looked the same shape.
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const over = [];
  for (const p of products) {
    await page.goto(`${BASE}/products?productId=${encodeURIComponent(p.id)}`, { waitUntil: 'networkidle' });
    const r = await page.evaluate(() => {
      const out = [];
      for (const t of document.querySelectorAll('main table')) {
        let wrap = t.parentElement;
        while (wrap && getComputedStyle(wrap).overflowX !== 'auto' && wrap !== document.body) wrap = wrap.parentElement;
        const tw = Math.round(t.getBoundingClientRect().width);
        const cw = wrap ? wrap.clientWidth : null;
        out.push({
          tableW: tw, wrapW: cw,
          overflow: cw !== null && tw > cw + 1,
          cols: t.querySelectorAll('thead th').length || (t.querySelector('tr') ? t.querySelector('tr').children.length : 0),
          rows: t.querySelectorAll('tbody tr').length,
        });
      }
      return out;
    });
    const bad = r.filter((x) => x.overflow);
    if (bad.length) over.push({ id: p.id, tables: r });
  }
  console.log(`${over.length} of ${products.length} product pages have a horizontally scrolling spec table at 1440`);
  for (const o of over) {
    console.log(' ', o.id.padEnd(30), JSON.stringify(o.tables));
  }
  await browser.close();
})();
