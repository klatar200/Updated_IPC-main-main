/**
 * Full-page homepage screenshots at 1440 and 375, plus a hero-only crop.
 *
 * Exists for the PLAN-7 imagery mockups: a design decision about where photos
 * go has to be argued against the page as it really renders, not against a
 * drawing of it. Same reason `mockup-brandtext.js` and `navyshot.js` exist.
 *
 * Usage: node _harness/homeshot.js <label> [route]
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const label = process.argv[2] || 'home';
const route = process.argv[3] || '/';
const OUT = path.join(__dirname, 'out', 'plan7');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();

  for (const width of [1440, 375]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    // Lazy images below the fold never decode unless the page is scrolled.
    await page.evaluate(async () => {
      await new Promise((res) => {
        let y = 0;
        const step = () => {
          window.scrollTo(0, y);
          y += 600;
          if (y < document.body.scrollHeight) setTimeout(step, 40);
          else { window.scrollTo(0, 0); setTimeout(res, 250); }
        };
        step();
      });
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `${label}-${width}.png`), fullPage: true });

    if (width === 1440) {
      const hero = await page.$('section');
      if (hero) await hero.screenshot({ path: path.join(OUT, `${label}-hero.png`) });
    }
    await ctx.close();
  }

  await browser.close();
  console.log('wrote', OUT + `/${label}-{1440,375,hero}.png`);
})();
