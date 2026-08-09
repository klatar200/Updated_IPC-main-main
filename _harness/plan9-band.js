/**
 * PLAN-9 item 4 — the homepage band's building card must not be half empty.
 * (Audit 2026-08-09 finding 4.)
 *
 * Both band <figure>s sit in md:grid-cols-3 and grid items stretch to the row
 * height by default. The team figure spans two columns, so its 16:9 image
 * sets a ~477px row at 1440; the building image is 16:9 of ONE column
 * (~231px) and its bordered figure stretched to the full row — 246px of
 * empty bordered card at 1440, 189px at 1024, 141px at 768. md:self-start
 * makes the building figure hug its image; the space below becomes plain
 * section background. Below 768 the grid is single-column and unaffected.
 *
 * Derived from _harness/aud9-band.js (the audit's evidence — not edited).
 * Needs the mirror on :8123. Usage: node _harness/plan9-band.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan9');

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  for (const width of [1440, 1024, 768, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => { window.scrollTo(0, 1600); await new Promise((r) => setTimeout(r, 600)); });
    await page.waitForTimeout(600);
    const figs = await page.evaluate(() => {
      const out = [];
      for (const img of document.querySelectorAll('figure img')) {
        if (!/staff|IPC-Building/.test(img.src)) continue;
        const fb = img.closest('figure').getBoundingClientRect();
        const ib = img.getBoundingClientRect();
        out.push({ src: img.src.split('/').pop(), slack: Math.round(fb.height - ib.height) });
      }
      return out;
    });
    const bad = figs.filter((f) => f.slack > 4);
    note(figs.length === 2 && bad.length === 0,
      `${width}: both band figures hug their image (figure height − img height ≤ 4px)`,
      JSON.stringify(figs));
    if (width === 1440) {
      const fig = await page.$('figure:has(img[src*="IPC-Building"])');
      if (fig) {
        await page.evaluate((el) => el.scrollIntoView({ block: 'center' }), fig);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT, 'band-1440.png') });
      }
    }
    await ctx.close();
  }
  await browser.close();

  const pass = results.filter((x) => x.ok).length;
  console.log(`\nplan9-band ${pass}/${results.length}`);
  fs.writeFileSync(path.join(OUT, 'band.json'), JSON.stringify(results, null, 2));
  process.exit(pass === results.length ? 0 : 1);
})();
