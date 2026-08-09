/**
 * 2026-08-09 audit probe — §7D sweep: console errors, failed requests and
 * horizontal overflow on all 10 routes x 2 viewports, plus all 42 product
 * pages at 1440 (errors/banner only, so the run stays under a few minutes).
 */
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const ROUTES = ['/', '/about', '/products', '/industries', '/services', '/privacy', '/datasheets', '/faq', '/contact', '/dashboard'];
const VIEWPORTS = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];

(async () => {
  const browser = await launch();

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const errors = [];
    const failed = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 160)));
    page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    page.on('requestfailed', (r) => failed.push(`FAILED ${r.failure() && r.failure().errorText} ${r.url()}`));
    for (const route of ROUTES) {
      errors.length = 0; failed.length = 0;
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
        headerH: (() => { const h = document.querySelector('.ipc-page-header'); return h ? Math.round(h.getBoundingClientRect().height) : null; })(),
      }));
      const over = m.sw > m.iw ? `  OVERFLOW sw=${m.sw} iw=${m.iw}` : '';
      const errS = errors.length ? `  ERRORS(${errors.length}): ${errors.slice(0, 2).join(' | ')}` : '';
      const failS = failed.length ? `  FAILEDREQ(${failed.length}): ${failed.slice(0, 2).join(' | ')}` : '';
      console.log(`${vp.width} ${route.padEnd(12)} headerH=${String(m.headerH).padEnd(4)}${over}${errS}${failS}`);
    }
    await ctx.close();
  }

  // all 42 product pages at 1440
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const products = await page.evaluate(async () => (await (await fetch('/data/products-all.json')).json()));
  const list = (Array.isArray(products) ? products : products.products).map((p) => p.id);
  const errors = [];
  const failed = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 120)));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  let clean = 0;
  for (const id of list) {
    errors.length = 0; failed.length = 0;
    await page.goto(`${BASE}/products?productId=${encodeURIComponent(id)}`, { waitUntil: 'networkidle' });
    const m = await page.evaluate(() => ({
      banner: !!document.querySelector('[role="alert"]'),
      sw: document.documentElement.scrollWidth, iw: window.innerWidth,
    }));
    const bad = errors.length || failed.length || m.banner || m.sw > m.iw;
    if (!bad) { clean++; continue; }
    console.log(`PRODUCT ${id}: ${m.banner ? 'NOTFOUND-BANNER ' : ''}${m.sw > m.iw ? `OVERFLOW ${m.sw} ` : ''}${errors.slice(0, 2).join(' | ')} ${failed.slice(0, 2).join(' | ')}`);
  }
  console.log(`products clean: ${clean}/${list.length}`);
  await ctx.close();
  await browser.close();
})();
