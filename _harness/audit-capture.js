/**
 * UI/UX audit capture — screenshots every route full-page, then slices each
 * capture into readable segments so every section of every page can actually
 * be looked at (a 1440 x 7000 full-page PNG is unreadable once scaled down).
 *
 * Also records, per route: console errors/warnings, failed network requests,
 * images that resolved to 0x0 or to the SPA shell, and horizontal overflow.
 *
 *   node _harness/audit-capture.js [--base http://127.0.0.1:8123] [--only=home,products]
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '').split('=')[1]
  || 'http://127.0.0.1:8123';
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const OUT = path.join(__dirname, 'out', 'audit');
const SHOTS = path.join(OUT, 'shots');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, slice: 1000 },
  { name: 'mobile', width: 390, height: 844, slice: 844, mobile: true },
];

const ROUTES = [
  ['home', '/'],
  ['products', '/products'],
  ['products-family', '/products?family=Polyolefin%20Heat%20Shrink'],
  ['dashboard', '/dashboard'],
  ['datasheets', '/datasheets'],
  ['industries', '/industries'],
  ['services', '/services'],
  ['about', '/about'],
  ['faq', '/faq'],
  ['contact', '/contact'],
  ['privacy', '/privacy'],
  ['unknown-route', '/quality'],
  ['product-CC', '/products?productId=CC'],
  ['product-IP33PO', '/products?productId=IP33PO'],
  ['product-IP75AD', '/products?productId=IP75AD'],
  ['product-VT-1100', '/products?productId=VT-1100'],
  ['product-VALUE-ADDED', '/products?productId=VALUE-ADDED'],
  ['product-IP44A2', '/products?productId=IP44A2%20%26%20IP45A3'],
  ['product-IP52EC', '/products?productId=IP52EC'],
  ['product-bogus', '/products?productId=NOPE123'],
];

function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }

async function capture(browser, vp, name, url) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: !!vp.mobile,
    hasTouch: !!vp.mobile,
    userAgent: vp.mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  const page = await ctx.newPage();
  const rec = { route: name, url, viewport: vp.name, console: [], failed: [], pageErrors: [] };

  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      rec.console.push({ type: m.type(), text: m.text().slice(0, 400) });
    }
  });
  page.on('pageerror', (e) => rec.pageErrors.push(String(e).slice(0, 400)));
  page.on('requestfailed', (r) => rec.failed.push({ url: r.url(), err: String(r.failure() && r.failure().errorText) }));
  page.on('response', (r) => {
    if (r.status() >= 400) rec.failed.push({ url: r.url(), status: r.status() });
  });

  await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => {
    rec.pageErrors.push('goto: ' + String(e).slice(0, 200));
  });
  // Let the catalog fetch + any entrance animation settle.
  await page.waitForTimeout(1200);

  // Freeze animations so slices line up and repeat runs are comparable.
  await page.addStyleTag({
    content: `*, *::before, *::after { animation-duration: 0s !important;
      animation-delay: 0s !important; transition-duration: 0s !important; }`,
  });
  await page.waitForTimeout(200);

  const metrics = await page.evaluate(() => {
    const de = document.documentElement;
    const imgs = [...document.images].map((i) => ({
      src: i.currentSrc || i.src,
      alt: i.alt,
      nw: i.naturalWidth, nh: i.naturalHeight,
      cw: Math.round(i.getBoundingClientRect().width),
      ch: Math.round(i.getBoundingClientRect().height),
      loading: i.loading,
      hasW: i.hasAttribute('width'), hasH: i.hasAttribute('height'),
    }));
    // Elements that stick out past the viewport on the right.
    const overflow = [];
    const vw = de.clientWidth;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1) {
        overflow.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && String(el.className).slice(0, 90)) || '',
          right: Math.round(r.right), width: Math.round(r.width),
          text: (el.textContent || '').trim().slice(0, 60),
        });
      }
    }
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .map((h) => ({ lvl: +h.tagName[1], text: (h.textContent || '').trim().slice(0, 80) }));
    return {
      title: document.title,
      metaDesc: (document.querySelector('meta[name="description"]') || {}).content || null,
      canonical: (document.querySelector('link[rel="canonical"]') || {}).href || null,
      ogUrl: (document.querySelector('meta[property="og:url"]') || {}).content || null,
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      scrollHeight: de.scrollHeight,
      imgs, overflow: overflow.slice(0, 40), headings,
      h1count: document.querySelectorAll('h1').length,
      bodyText: (document.body.innerText || '').length,
    };
  });
  rec.metrics = metrics;

  const dir = path.join(SHOTS, vp.name);
  mkdirp(dir);
  const full = path.join(dir, `${name}.png`);
  await page.screenshot({ path: full, fullPage: true });

  // Slice for readable review.
  const h = metrics.scrollHeight;
  const step = vp.slice;
  const sliceDir = path.join(dir, 'slices');
  mkdirp(sliceDir);
  const slices = [];
  let idx = 0;
  for (let y = 0; y < h; y += step) {
    const sh = Math.min(step, h - y);
    if (sh < 40) break;
    const p = path.join(sliceDir, `${name}-${String(idx).padStart(2, '0')}.png`);
    await page.screenshot({ path: p, fullPage: true, clip: { x: 0, y, width: vp.width, height: sh } });
    slices.push(path.basename(p));
    idx += 1;
    if (idx > 30) break;
  }
  rec.slices = slices;

  await ctx.close();
  return rec;
}

(async () => {
  mkdirp(OUT); mkdirp(SHOTS);
  const browser = await launch();
  const results = [];
  const routes = ONLY ? ROUTES.filter((r) => ONLY.split(',').includes(r[0])) : ROUTES;
  for (const vp of VIEWPORTS) {
    for (const [name, url] of routes) {
      process.stdout.write(`${vp.name}  ${name} … `);
      const rec = await capture(browser, vp, name, url);
      results.push(rec);
      console.log(`${rec.metrics ? rec.metrics.scrollHeight : '?'}px, ${rec.slices.length} slices, ` +
        `${rec.console.length} console, ${rec.failed.length} failed, ${rec.metrics ? rec.metrics.overflow.length : '?'} overflow`);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'capture.json'), JSON.stringify(results, null, 1));
  console.log('\nwrote ' + path.join(OUT, 'capture.json'));
})();
