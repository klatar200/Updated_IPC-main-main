/**
 * Side-by-side of --brand-accent-text at the shipped #119EC8 and the derived
 * #0d7594, on the surfaces where it is actually used. Overrides the variable at
 * runtime so both halves come from the same build.
 *
 * Usage: node _harness/accentshot.js
 */
const path = require('path');
const { launch } = require('./browser');
const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'accent');

const SHOTS = [
  ['/about', 'about', '.rounded-xl.p-6.text-center'],
  ['/dashboard', 'chips', 'table tbody'],
];

(async () => {
  for (const [route, name, sel] of SHOTS) {
    for (const [tag, value] of [['revert-119EC8', '#119ec8'], ['keep-0d7594', '#0d7594']]) {
      const browser = await launch();
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: `:root{--brand-accent-text:${value} !important;}` });
      await page.waitForTimeout(400);
      const el = await page.$(sel);
      if (!el) throw new Error('selector missed: ' + sel);
      // Element screenshot, not a page clip: these sit below the fold, and a
      // clip computed from an off-screen bounding box is outside the image.
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await el.screenshot({ path: path.join(OUT, `${name}-${tag}.png`) });
      await browser.close();
    }
  }
  console.log('accent shots ->', OUT);
})();
