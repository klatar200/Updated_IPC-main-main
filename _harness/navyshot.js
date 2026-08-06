/**
 * Screenshot the site under the SHIPPED navy palette, so the one visible change
 * brand-color-as-foreground makes to the default design can be reviewed:
 * --brand-accent-text moves #119EC8 -> #0d7594, because the shipped accent on
 * white measures 3.1:1 and AA wants 4.5:1.
 *
 * Usage: node _harness/navyshot.js <label>
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const label = process.argv[2] || 'navy';
const OUT = path.join(__dirname, 'out', label);

const ROUTES = [['/', 'home'], ['/industries', 'industries'], ['/about', 'about']];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  for (const [route, name] of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${name}-1440.png`) });
    await ctx.close();
  }
  await browser.close();
  console.log(`screenshots -> ${OUT}`);
})();
