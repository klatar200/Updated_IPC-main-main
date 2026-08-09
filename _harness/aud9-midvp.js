/** 2026-08-09 audit probe — C37 check at the two viewports the sweep skipped. */
const { launch } = require('./browser');
const BASE = 'http://127.0.0.1:8123';
const ROUTES = ['/', '/about', '/products', '/industries', '/services', '/privacy', '/datasheets', '/faq', '/contact', '/dashboard'];

(async () => {
  const browser = await launch();
  for (const width of [1024, 768]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
    for (const route of ROUTES) {
      errors.length = 0;
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth, iw: window.innerWidth,
        headerH: (() => { const h = document.querySelector('.ipc-page-header'); return h ? Math.round(h.getBoundingClientRect().height) : null; })(),
      }));
      const over = m.sw > m.iw ? `  OVERFLOW sw=${m.sw}` : '';
      console.log(`${width} ${route.padEnd(12)} headerH=${String(m.headerH).padEnd(4)}${over}${errors.length ? '  ERRORS ' + errors[0] : ''}`);
    }
    await ctx.close();
  }
  await browser.close();
})();
