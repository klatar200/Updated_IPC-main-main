/** 2026-08-09 audit probe — what a wrong-case siteImages path paints for a
 *  visitor. The typing risk is the recorded 3b open item; this measures the
 *  visitor-facing consequence: product photos have an onError fallback (T2.7),
 *  the five PLAN-7 slots have none. */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');
const BASE = 'http://127.0.0.1:8123';
const PRISTINE = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine', 'content.json'), 'utf8'));

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**/data/content.json*', (r) => {
    const json = JSON.parse(JSON.stringify(PRISTINE));
    json.copy = json.copy || {};
    // wrong case, exactly the class of typo that shipped four times in photoUrl
    json.copy.siteImages = { ...(json.copy.siteImages || {}), bandTeamPhoto: 'images/site/Staff.jpg' };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(async () => { window.scrollTo(0, 1800); await new Promise((r) => setTimeout(r, 800)); });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const img = [...document.querySelectorAll('img')].find((i) => /Staff\.jpg/.test(i.src));
    if (!img) return { found: false };
    const b = img.getBoundingClientRect();
    const fig = img.closest('figure');
    const fb = fig ? fig.getBoundingClientRect() : null;
    return {
      found: true, complete: img.complete, naturalWidth: img.naturalWidth,
      paintedBox: { w: Math.round(b.width), h: Math.round(b.height) },
      figureBox: fb ? { w: Math.round(fb.width), h: Math.round(fb.height) } : null,
      alt: img.alt.slice(0, 60),
    };
  });
  console.log(JSON.stringify(r, null, 1));
  fs.mkdirSync(path.join(__dirname, 'out', 'aud9'), { recursive: true });
  await page.screenshot({ path: path.join(__dirname, 'out', 'aud9', 'typo-band-1440.png'), fullPage: false });
  console.log('screenshot: _harness/out/aud9/typo-band-1440.png');
  await browser.close();
})();
