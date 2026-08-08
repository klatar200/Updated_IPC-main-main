/**
 * Phase E acceptance screenshots — the three surfaces B8, B9 and B10 name:
 * the catalog sidebar (the 1.64:1 part numbers), the footer (the white-alpha
 * text), and /datasheets (30 certification lines at 2.54:1).
 *
 * Captured at 1440 and 390. The numbers are the real evidence and live in
 * _harness/out/plan8-contrast/contrast.json; these are so the change can also
 * be judged by eye.
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-phaseE');

const SHOTS = [
  { name: 'sidebar', url: '/products?productId=IP33PO', clip1440: { x: 40, y: 300, width: 420, height: 620 } },
  { name: 'datasheets', url: '/datasheets', clip1440: { x: 0, y: 260, width: 1440, height: 620 } },
  { name: 'footer', url: '/', full: true },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  try {
    for (const width of [1440, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 } });
      const page = await ctx.newPage();
      for (const s of SHOTS) {
        await page.goto(BASE + s.url, { waitUntil: 'networkidle' });
        if (s.name === 'footer') {
          await page.evaluate(() => {
            const f = document.querySelector('footer');
            if (f) f.scrollIntoView({ block: 'start', behavior: 'instant' });
          });
          await page.waitForTimeout(300);
          await page.screenshot({ path: path.join(OUT, `footer-${width}.png`) });
        } else if (width === 1440 && s.clip1440) {
          await page.screenshot({ path: path.join(OUT, `${s.name}-1440.png`), clip: s.clip1440 });
        } else {
          await page.screenshot({ path: path.join(OUT, `${s.name}-${width}.png`), fullPage: false });
        }
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`screenshots -> ${OUT}`);
})();
