/*
 * P9 step 4 instrument (agent C', audit 9): large-text check. Sets the root
 * font-size to 24px (a common user override / OS accessibility setting) and
 * looks for elements clipped by a fixed PX height (line-height or height in
 * px that no longer fits the now-larger text) — the specific failure mode
 * named in the brief, distinct from ordinary reflow.
 */
const { launch } = require('./browser');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8143';
const ROUTES = ['/', '/products', '/dashboard', '/datasheets', '/industries', '/services', '/about', '/faq', '/contact', '/privacy', '/products?productId=CC'];

(async () => {
  const browser = await launch();
  const out = {};
  for (const route of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = '* { font-family: "Liberation Sans", Arial, sans-serif !important } *,*::before,*::after{animation:none!important;transition:none!important;} html { font-size: 24px !important; }';
        document.head.appendChild(s);
      });
    });
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const clipped = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('body *').forEach((el) => {
        const cs = getComputedStyle(el);
        if ((el.className || '').toString().includes('sr-only')) return;
        // aria-hidden (honeypots, decorative glyphs) is invisible to every
        // real user by design — its own box metrics are not a UI defect.
        if (el.closest('[aria-hidden="true"]')) return;
        // a deliberately vertically-scrollable panel (styled scrollbar,
        // overflow-y auto/scroll) is a scroller, not clipped content — same
        // exemption the reflow check gives horizontal scrollers.
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') return;
        // a fixed px height smaller than the content's scrollHeight is the
        // named failure mode: text no longer fits its box at 24px root.
        const hasFixedHeight = /^\d+px$/.test(cs.height) && cs.overflow !== 'visible';
        if (hasFixedHeight && el.scrollHeight > el.clientHeight + 2 && el.textContent.trim()) {
          results.push({
            tag: el.tagName, cls: (el.className || '').toString().slice(0, 50),
            cssHeight: cs.height, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
            text: el.textContent.trim().slice(0, 50),
          });
        }
      });
      return results.slice(0, 20);
    });
    out[route] = { clippedCount: clipped.length, clipped };
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  const total = Object.values(out).reduce((n, r) => n + r.clippedCount, 0);
  console.error(`\naudit9-p9-largetext: ${ROUTES.length} routes at root font-size 24px, ${total} elements with fixed-px-height clipping`);
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error('audit9-p9-largetext FATAL', e); process.exit(1); });
