/**
 * AUDIT-10 pass-2 — the WCAG 2.5.8 (24x24 AA) touch-target floor at
 * tablet-834 and mobile-390, over EVERY public page and every state the
 * crawler could not reach (drawer open, FAQ open).
 *
 * plan8-mobile.js already holds five routes at 390 green with hasTouch:true.
 * This is the rest of the surface: the other public routes, the three family
 * views, all 42 product pages, tablet-834, and the open states.
 *
 * The context sets hasTouch/isMobile so `@media (pointer: coarse)` matches —
 * that block in src/index.css is what grows tel:/mailto:/.ipc-touch to 44px,
 * so measuring without it measures the desktop rule and reports failures a
 * phone never has. `coarse` is asserted in the output.
 *
 * Usage: node _harness/audit10-p2tap.js   (needs :8123)
 * Output: _harness/out/audit10/p2tap.json
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10');
const AA_MIN = 24;   // WCAG 2.5.8 Level AA
const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);

const VIEWPORTS = [
  { name: 'tablet-834', width: 834, height: 1112 },
  { name: 'mobile-390', width: 390, height: 844 },
];
const ROUTES = ['/', '/products', '/services', '/industries', '/about',
  '/contact', '/dashboard', '/datasheets', '/faq', '/privacy'];
const URLS = [
  ...ROUTES,
  ...['Tape', 'Heat Shrink Tubing', 'Adhesive'].map((f) => '/dashboard?family=' + encodeURIComponent(f)),
  ...products.map((p) => '/products?productId=' + encodeURIComponent(p.id)),
];
/** plan8-mobile's known-green covered set at 390 — excluded from "new regressions". */
const PLAN8_COVERED = new Set(['/contact', '/about', '/products?productId=IP33PO', '/faq', '/dashboard']);

const measure = () => {
  const out = [];
  const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"]';
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (el.classList && el.classList.contains('ipc-skip')) continue;   // off-screen until focused
    const href = el.getAttribute && el.getAttribute('href');
    out.push({
      tag: el.tagName.toLowerCase(),
      w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      x: Math.round(r.left), y: Math.round(r.top + window.scrollY),
      tel: !!(href && /^tel:/.test(href)), mail: !!(href && /^mailto:/.test(href)),
      text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 44),
      aria: el.getAttribute('aria-label') || '',
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 48),
    });
  }
  return out;
};

(async () => {
  const browser = await launch();
  const rows = [];
  const meta = {};
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: true, isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
    meta[vp.name] = await page.evaluate(() => ({
      coarse: window.matchMedia('(pointer: coarse)').matches,
      anyCoarse: window.matchMedia('(any-pointer: coarse)').matches,
    }));

    for (const url of URLS) {
      try {
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) {
            window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 15));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(300);
        rows.push({ url, viewport: vp.name, state: 'closed', els: await page.evaluate(measure) });
      } catch (e) {
        rows.push({ url, viewport: vp.name, state: 'closed', error: String(e).slice(0, 200) });
      }
      process.stdout.write('.');
    }

    // ── the drawer OPEN, on every route (the crawler only saw it closed) ────
    for (const url of ROUTES) {
      try {
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.click('button[aria-label="Open menu"]');
        await page.waitForTimeout(400);
        // expand both accordions so their children are measured too
        for (const label of ['Products', 'Company']) {
          const b = page.locator(`[role="dialog"] button:has-text("${label}")`).first();
          if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(250); }
        }
        rows.push({ url, viewport: vp.name, state: 'drawer-open', els: await page.evaluate(measure) });
      } catch (e) {
        rows.push({ url, viewport: vp.name, state: 'drawer-open', error: String(e).slice(0, 200) });
      }
      process.stdout.write('o');
    }

    // ── the FAQ accordions open ────────────────────────────────────────────
    try {
      await page.goto(BASE + '/faq', { waitUntil: 'networkidle' });
      // NOT every [aria-expanded] button is an accordion — the hamburger
      // carries one too, and clicking it locks <body> and collapses
      // documentElement.scrollHeight to the viewport height, which silently
      // corrupts every measurement taken afterwards.
      const n = await page.evaluate(() => {
        const bs = [...document.querySelectorAll('button[aria-expanded]')]
          .filter((b) => b.getAttribute('aria-label') !== 'Open menu' && b.getAttribute('aria-label') !== 'Close menu');
        bs.forEach((b) => { if (b.getAttribute('aria-expanded') === 'false') b.click(); });
        return bs.length;
      });
      await page.waitForTimeout(600);
      rows.push({ url: '/faq', viewport: vp.name, state: 'faq-open', accordions: n, els: await page.evaluate(measure) });
    } catch (e) {
      rows.push({ url: '/faq', viewport: vp.name, state: 'faq-open', error: String(e).slice(0, 200) });
    }
    await ctx.close();
    console.log(` ${vp.name} done`);
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'p2tap.json'), JSON.stringify({ meta, rows }, null, 1));

  console.log('\ncoarse pointer:', JSON.stringify(meta));
  const tiny = [];
  for (const r of rows) {
    for (const e of (r.els || [])) {
      if (e.w < AA_MIN || e.h < AA_MIN) {
        tiny.push({ url: r.url, viewport: r.viewport, state: r.state, ...e });
      }
    }
  }
  console.log(`\n== below ${AA_MIN}x${AA_MIN}: ${tiny.length} instances across ${new Set(tiny.map((t) => t.url + t.viewport + t.state)).size} page-states`);
  const shapes = {};
  for (const t of tiny) {
    const k = `${t.viewport} ${t.state} <${t.tag}> ${t.w}x${t.h} cls=${t.cls} "${t.text || t.aria}"`;
    (shapes[k] = shapes[k] || []).push(t.url);
  }
  for (const [k, urls] of Object.entries(shapes).sort((a, b) => b[1].length - a[1].length)) {
    const news = urls.filter((u) => !(PLAN8_COVERED.has(u)));
    console.log(`  ${urls.length}x  ${k}\n        e.g. ${urls.slice(0, 3).join(', ')}${news.length !== urls.length ? `  [${urls.length - news.length} inside plan8-mobile's covered set]` : ''}`);
  }
  const between = [];
  for (const r of rows) for (const e of (r.els || [])) {
    if ((e.w >= AA_MIN && e.w < 44) || (e.h >= AA_MIN && e.h < 44)) between.push({ ...e, url: r.url, viewport: r.viewport, state: r.state });
  }
  console.log(`\n(${between.length} controls sit between 24 and 44 — above the AA floor, below AAA. Not findings.)`);
  console.log(`-> ${path.join(OUT, 'p2tap.json')}`);
})();
