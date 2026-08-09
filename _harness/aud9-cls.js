/**
 * 2026-08-09 audit probe — §7A hypothesis 1: does pointing an owner-editable
 * image slot at a differently-shaped file move the layout (CLS)?
 *
 * The slots declare width/height from HERO_PHOTO / BAND_TEAM / BAND_BUILDING
 * (App.jsx:1731-1733), which describe the shipped defaults — but every slot
 * also pins its box with a CSS aspect-ratio + object-fit:cover, so the
 * intrinsic shape of the override should never reach layout. Measure it.
 *
 * Method: CDP Network.emulateNetworkConditions (slow) + PerformanceObserver
 * on layout-shift, summed over the full load + a programmatic scroll so the
 * lazy images actually load. Three runs each: default content.json vs one
 * overriding bandTeamPhoto (16:9 slot) with Front-Cover.jpg (773x1000,
 * portrait — the most differently-shaped usable file in images/site/).
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PRISTINE = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine', 'content.json'), 'utf8'));

async function measure(browser, patch, runs) {
  const out = [];
  for (let i = 0; i < runs; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    if (patch) {
      await page.route('**/data/content.json*', (r) => {
        const json = JSON.parse(JSON.stringify(PRISTINE));
        json.copy = json.copy || {};
        json.copy.siteImages = { ...(json.copy.siteImages || {}), ...patch };
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
      });
    }
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 150, downloadThroughput: 400 * 1024, uploadThroughput: 100 * 1024,
    });
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => ({
      cls: window.__cls,
      band: (() => {
        const f = [...document.querySelectorAll('figure img')].find((i) => /staff|Front-Cover/.test(i.src));
        if (!f) return null;
        const b = f.getBoundingClientRect();
        return { src: f.src.split('/').pop(), w: Math.round(b.width), h: Math.round(b.height) };
      })(),
    }));
    out.push(r);
    await ctx.close();
  }
  return out;
}

(async () => {
  const browser = await launch();
  const dflt = await measure(browser, null, 3);
  const over = await measure(browser, { bandTeamPhoto: 'images/site/Front-Cover.jpg' }, 3);
  console.log('default  :', JSON.stringify(dflt));
  console.log('override :', JSON.stringify(over));
  const avg = (a) => a.reduce((s, x) => s + x.cls, 0) / a.length;
  console.log(`avg CLS default=${avg(dflt).toFixed(4)} override=${avg(over).toFixed(4)}`);
  await browser.close();
})();
