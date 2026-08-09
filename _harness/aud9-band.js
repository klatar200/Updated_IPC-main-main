/** 2026-08-09 audit probe — default homepage band: does the building card
 *  stretch past its image, leaving an empty bordered region? (No content
 *  interception — this is the shipped default render.) */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');
const BASE = 'http://127.0.0.1:8123';

(async () => {
  const browser = await launch();
  for (const width of [1440, 1024, 768]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => { window.scrollTo(0, 1600); await new Promise((r) => setTimeout(r, 600)); });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const out = [];
      for (const img of document.querySelectorAll('figure img')) {
        if (!/staff|IPC-Building/.test(img.src)) continue;
        const fig = img.closest('figure');
        const ib = img.getBoundingClientRect();
        const fb = fig.getBoundingClientRect();
        out.push({
          src: img.src.split('/').pop(),
          img: { w: Math.round(ib.width), h: Math.round(ib.height) },
          fig: { w: Math.round(fb.width), h: Math.round(fb.height) },
          emptyBelow: Math.round(fb.height - ib.height),
        });
      }
      return out;
    });
    console.log(width, JSON.stringify(r));
    if (width === 1440) {
      const fig = await page.$('figure:has(img[src*="IPC-Building"])');
      if (fig) {
        await page.evaluate((el) => el.scrollIntoView({ block: 'center' }), fig);
        await page.waitForTimeout(400);
        fs.mkdirSync(path.join(__dirname, 'out', 'aud9'), { recursive: true });
        await page.screenshot({ path: path.join(__dirname, 'out', 'aud9', `band-default-${width}.png`) });
        console.log(`screenshot: _harness/out/aud9/band-default-${width}.png`);
      }
    }
    await ctx.close();
  }
  await browser.close();
})();
