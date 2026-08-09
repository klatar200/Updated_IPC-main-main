/**
 * PLAN-9 item 5 — slot paths must survive a trailing-slash URL.
 * (Audit 2026-08-09 finding 5.)
 *
 * The five slot defaults are site-relative ("images/site/…"). Before the fix,
 * on /about/ (trailing slash — external links and typed URLs) the browser
 * resolved /about/images/site/IPC-Building.jpg, the SPA rewrite answered it
 * with 200 text/html, and a broken 745×496 frame painted where the photograph
 * belongs. slotSrc() now resolves owner-typed and default slot paths against
 * the site root; absolute http(s)/data: and root-relative values pass through.
 *
 * The content-type clause is the load-bearing half of check 1: the rewrite
 * answers a miss with 200, so status alone cannot fail (the VALUE-ADDED pdf
 * incident). Needs the mirror on :8123. Usage: node _harness/plan9-slots-slash.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan9');
const PRISTINE = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine', 'content.json'), 'utf8'));

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

async function measure(browser, route) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const responses = [];
  page.on('response', (r) => {
    if (/images\/site\//.test(r.url())) {
      responses.push({ url: r.url(), status: r.status(), type: (r.headers()['content-type'] || '') });
    }
  });
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
  });
  await page.waitForTimeout(800);
  const painted = await page.evaluate(() =>
    [...document.querySelectorAll('img')]
      .filter((i) => /images\/site\//.test(i.currentSrc || i.src || ''))
      .map((i) => ({ src: i.getAttribute('src'), naturalWidth: i.naturalWidth })));
  await ctx.close();
  return { responses, painted };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();

  for (const route of ['/about/', '/services/', '/', '/about']) {
    const r = await measure(browser, route);
    const badResp = r.responses.filter((x) => x.status !== 200 || !/^image\//.test(x.type));
    note(r.responses.length > 0 && badResp.length === 0,
      `${route}: every images/site/ request answers 200 with an image/* content-type`,
      JSON.stringify(badResp.length ? badResp : r.responses));
    const badPaint = r.painted.filter((x) => !(x.naturalWidth > 0));
    note(r.painted.length > 0 && badPaint.length === 0,
      `${route}: every painted images/site/ <img> decoded (naturalWidth > 0)`,
      JSON.stringify(badPaint.length ? badPaint : r.painted));
  }

  // ── an absolute https:// override passes through untouched ──────────────
  const ABS = 'https://example.invalid/x.jpg';
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**/data/content.json*', (r) => {
    const json = JSON.parse(JSON.stringify(PRISTINE));
    json.copy = json.copy || {};
    json.copy.siteImages = { ...(json.copy.siteImages || {}), bandTeamPhoto: ABS };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
  await page.route('**example.invalid**', (r) => r.abort());
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(600);
  // Assert the ATTRIBUTE, not the paint — the URL deliberately cannot load.
  const src = await page.evaluate(() => {
    const img = [...document.querySelectorAll('figure img')].find((i) => /example\.invalid/.test(i.getAttribute('src') || ''));
    return img ? img.getAttribute('src') : null;
  });
  note(src === ABS, 'an https:// override renders exactly as typed, untouched', JSON.stringify(src));
  await ctx.close();
  await browser.close();

  const pass = results.filter((x) => x.ok).length;
  console.log(`\nplan9-slots-slash ${pass}/${results.length}`);
  fs.writeFileSync(path.join(OUT, 'slots-slash.json'), JSON.stringify(results, null, 2));
  process.exit(pass === results.length ? 0 : 1);
})();
