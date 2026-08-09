/**
 * PLAN-7 item 2 — the marketing photographs are on the page.
 *
 * Before this, src/App.jsx held four <img> elements in 9,900 lines and three
 * of them were the logo. `grep -n 'images/' src/App.jsx` returned nothing,
 * while public/images/site/ held 22 files, ~1 MB, referenced by nothing and
 * shipping to the server on every deploy.
 *
 * The four things this guards, in order of how badly each has gone wrong
 * before:
 *
 *  1. NO CONTRAST DEBT. The 2026-08-07 amendment rejected three full-bleed
 *     hero treatments; the one that survived puts the photograph where no ink
 *     crosses it, so the hero's scrim ramp is untouched. That is only true
 *     while it stays true — so this asserts backdrop.js recorded ZERO
 *     unscorable layers behind text (PLAN-7 item 1a) on every route carrying
 *     an image.
 *  2. A HIDDEN IMAGE IS STILL DOWNLOADED. The mockup hid the hero photo on
 *     mobile with a class, which costs the bytes and shows nothing. Asserted
 *     by intercepting requests at 390, not by reading the markup.
 *  3. Dimensions and lazy-loading, so nothing shifts and nothing competes with
 *     the LCP element.
 *  4. Every file referenced actually resolves — a 404 here is invisible,
 *     because the SPA rewrite answers a missing image with index.html at 200.
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan7-imagery.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');
const { SOURCE, skippedLayers } = require('./backdrop');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan7');

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const ROUTES = ['/', '/about', '/services', '/industries', '/contact'];

const READ = () => [...document.querySelectorAll('img[src*="images/site/"]')].map((i) => {
  const r = i.getBoundingClientRect();
  return {
    file: (i.getAttribute('src') || '').split('/').pop(),
    src: i.getAttribute('src'),
    alt: i.getAttribute('alt'),
    lazy: i.getAttribute('loading'),
    w: i.getAttribute('width'),
    h: i.getAttribute('height'),
    natW: i.naturalWidth,
    natH: i.naturalHeight,
    paintW: Math.round(r.width),
    paintH: Math.round(r.height),
    visible: r.width > 0 && r.height > 0,
    complete: i.complete,
  };
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();

  // ── desktop ────────────────────────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const failed = [];
  page.on('response', (r) => {
    if (/images\/site\//.test(r.url()) && r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  // The SPA rewrite answers a missing file with index.html at 200, so status
  // alone cannot detect a bad path — check the content type too.
  const htmlForImage = [];
  page.on('response', async (r) => {
    if (!/images\/site\//.test(r.url())) return;
    const ct = (r.headers()['content-type'] || '');
    if (/text\/html/.test(ct)) htmlForImage.push(`${r.url()} -> ${ct}`);
  });

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
  const home = await page.evaluate(READ);

  note(home.length >= 3,
    'the homepage paints marketing photography (it painted none — 4 <img> in 9,900 lines, 3 of them the logo)',
    `${home.length} site images: ${home.map((i) => i.file).join(', ')}`);

  note(home.every((i) => i.complete && i.natW > 0),
    'every marketing image actually loaded',
    JSON.stringify(home.filter((i) => !i.complete || !i.natW).map((i) => i.file)));

  note(failed.length === 0 && htmlForImage.length === 0,
    'no marketing image 404s or is answered with the SPA shell',
    [...failed, ...htmlForImage].slice(0, 3).join(' | '));

  note(home.every((i) => i.w && i.h),
    'every marketing image declares width and height (no layout shift)',
    JSON.stringify(home.filter((i) => !i.w || !i.h).map((i) => i.file)));

  // The declared dimensions must be the FILE's real ones, or the reserved box
  // is the wrong shape and the attribute is worse than no attribute.
  const wrongDims = home.filter((i) => Number(i.w) !== i.natW || Number(i.h) !== i.natH);
  note(wrongDims.length === 0,
    'declared width/height match the real file dimensions',
    wrongDims.map((i) => `${i.file}: declared ${i.w}x${i.h}, file ${i.natW}x${i.natH}`).join(' | '));

  note(home.every((i) => i.lazy === 'lazy'),
    'every marketing image is lazy — none competes with the product photo as LCP',
    JSON.stringify(home.filter((i) => i.lazy !== 'lazy').map((i) => i.file)));

  const noAlt = home.filter((i) => !i.alt || i.alt.trim().length < 10);
  note(noAlt.length === 0,
    'every marketing image has a descriptive alt (these are content, not decoration)',
    noAlt.map((i) => `${i.file}: ${JSON.stringify(i.alt)}`).join(' | '));

  // Density: a file must at least approach its paint box, or it is visibly
  // soft. staff.jpg is knowingly at its source ceiling and under 1x.
  const soft = home.filter((i) => i.paintW > 0 && i.natW / i.paintW < 0.8);
  note(soft.length === 0,
    'no marketing image is upscaled beyond 1.25x of its own pixels',
    soft.map((i) => `${i.file}: ${i.natW}px into ${i.paintW}px = ${(i.natW / i.paintW).toFixed(2)}x`).join(' | '));

  await page.screenshot({ path: path.join(OUT, 'home-imagery-1440.png'), fullPage: false });
  await ctx.close();

  // ── no contrast debt: item 1a's flag must stay empty ───────────────────
  const cctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const cp = await cctx.newPage();
  const debt = [];
  for (const route of ROUTES) {
    await cp.goto(BASE + route, { waitUntil: 'networkidle' });
    await cp.evaluate(SOURCE);
    await cp.evaluate(() => {
      for (const el of document.querySelectorAll('h1,h2,h3,h4,p,span,a,div,li,strong')) {
        if (!el.getClientRects().length) continue;
        if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) window.__ipcBackdrop(el);
      }
    });
    for (const s of await skippedLayers(cp)) debt.push({ route, ...s });
  }
  note(debt.length === 0,
    'NO CONTRAST DEBT: no text on any route sits over a background the contrast core cannot score',
    debt.slice(0, 3).map((d) => `${d.route} <${d.tag}> ${d.layer} behind "${d.forText}"`).join('\n         '));
  await cctx.close();

  // ── mobile: a hidden image must not be DOWNLOADED ──────────────────────
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await mctx.newPage();
  const requested = [];
  mp.on('request', (r) => { if (/images\/site\//.test(r.url())) requested.push(r.url().split('/').pop()); });
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' });
  await mp.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
  });
  await mp.waitForTimeout(900);
  const mob = await mp.evaluate(READ);

  const hiddenOnMobile = mob.filter((i) => !i.visible).map((i) => i.file);
  const downloadedButHidden = hiddenOnMobile.filter((f) => requested.includes(f));
  note(downloadedButHidden.length === 0,
    'at 390 no image is downloaded only to be hidden — a hidden <img> still costs its bytes',
    `hidden: ${JSON.stringify(hiddenOnMobile)}, of which downloaded: ${JSON.stringify(downloadedButHidden)}`);

  note(mob.some((i) => i.visible),
    'the homepage still paints photography at 390 (the band is not desktop-only)',
    JSON.stringify(mob.map((i) => `${i.file}:${i.visible}`)));

  await mp.screenshot({ path: path.join(OUT, 'home-imagery-390.png'), fullPage: false });
  await mctx.close();

  await browser.close();

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nplan7-imagery ${pass}/${results.length}`);
  fs.writeFileSync(path.join(OUT, 'imagery.json'), JSON.stringify(results, null, 2));
  console.log(`record -> ${path.join(OUT, 'imagery.json')}`);
  process.exit(pass === results.length ? 0 : 1);
})();
