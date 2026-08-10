/**
 * PLAN-10 — visual confirmation shots for the item under work.
 *
 * The numbers are the durable evidence (screenshots are gitignored and die with
 * the container), but a header that measures correctly and still reads wrong is
 * a thing that has happened, so each item gets looked at as well as measured.
 *
 * Usage: node _harness/plan10-shot.js <slug> <url> [viewport...]
 *   node _harness/plan10-shot.js item1-cc "/products?productId=CC" mobile-390 tablet-834
 *
 * Set PLAN10_SHOT_TO=<css selector> to scroll that element into view first and
 * clip to the region around it — most of these targets are below the fold.
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan10', 'shots');
fs.mkdirSync(OUT, { recursive: true });

const VP = {
  'mobile-390': { width: 390, height: 844 },
  'tablet-834': { width: 834, height: 1112 },
  'tablet-1024': { width: 1024, height: 768 },
  'desktop-1440': { width: 1440, height: 900 },
};

const [slug, url, ...vps] = process.argv.slice(2);
if (!slug || !url) {
  console.error('usage: node _harness/plan10-shot.js <slug> <url> [viewport...]');
  process.exit(2);
}
const list = vps.length ? vps : Object.keys(VP);

(async () => {
  const browser = await launch();
  for (const vp of list) {
    if (!VP[vp]) { console.error(`unknown viewport ${vp}`); continue; }
    const ctx = await browser.newContext({ viewport: VP[vp] });
    const page = await ctx.newPage();
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const sel = process.env.PLAN10_SHOT_TO;
    let clip = null;
    if (sel) {
      clip = await page.evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        const pad = 24;
        return { x: 0, y: Math.max(0, r.top - pad), width: window.innerWidth,
                 height: Math.min(window.innerHeight - Math.max(0, r.top - pad), r.height + pad * 2 + 260) };
      })()`);
      await page.waitForTimeout(400);
    }
    const file = path.join(OUT, `${slug}__${vp}.png`);
    await page.screenshot({ path: file, fullPage: false, ...(clip ? { clip } : {}) });
    console.log(`${vp.padEnd(13)} -> ${file}`);
    await ctx.close();
  }
  await browser.close();
})();
