/**
 * C37 — before/after screenshots of the page-header band and the contact page,
 * at 1440 and 390. Paired with probe-deadspace.js, which carries the numbers.
 *
 * Usage: node _harness/shot-deadspace.js before | after
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const TAG = process.argv[2] === 'after' ? 'after' : 'before';
const OUT = path.join(__dirname, 'out', 'plan8-deadspace', TAG);
const ROUTES = ['/about', '/services', '/contact', '/faq'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  for (const [w, h, tag] of [[1440, 900, '1440'], [390, 844, '390']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    for (const r of ROUTES) {
      await page.goto(BASE + r, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `${r.slice(1)}-${tag}.png`) });
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`${TAG} screenshots -> ${OUT}`);
})();
