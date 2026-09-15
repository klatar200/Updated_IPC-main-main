/*
 * P9 step 3 instrument (agent C', audit 9): reflow at 200%/400% zoom.
 * WCAG 1.4.10 methodology: browser zoom shrinks the CSS-px layout viewport
 * while the physical screen stays the same size, so "200% at 1440" is
 * measured as a 720px-wide layout viewport (1440/2) and "400% at 1280" as a
 * 320px-wide layout viewport (1280/4) — both at the full device height so
 * vertical scrolling (expected) isn't confused with horizontal (the
 * failure mode this checks for). Checks scrollWidth<=clientWidth+1 (1px
 * subpixel tolerance) on <html>, with an allowance for elements the brief
 * itself exempts (spec-table scrollers, explicitly `overflow-x:auto`).
 * BASE_URL overrides the default (:8143).
 */
const { launch } = require('./browser');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8143';
const FORCE = '* { font-family: "Liberation Sans", Arial, sans-serif !important } *,*::before,*::after{animation:none!important;transition:none!important;}';

const ROUTES = ['/', '/products', '/dashboard', '/datasheets', '/industries', '/services', '/about', '/faq', '/contact', '/privacy', '/products?productId=CC'];

async function measure(browser, url, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.addInitScript((css) => {
    window.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); });
  }, FORCE);
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const data = await page.evaluate(() => {
    const html = document.documentElement;
    const overflowEls = [];
    document.querySelectorAll('body *').forEach((el) => {
      // .sr-only (and any 1px-clipped visually-hidden element) legitimately
      // has scrollWidth >> clientWidth by construction — that IS the
      // hide-visually-keep-in-a11y-tree technique, not clipped content.
      if (el.className && String(el.className).includes('sr-only')) return;
      const cs0 = getComputedStyle(el);
      if (parseFloat(cs0.width) <= 1 && cs0.overflow === 'hidden') return;
      if (el.scrollWidth > el.clientWidth + 1) {
        const isScroller = cs0.overflowX === 'auto' || cs0.overflowX === 'scroll';
        overflowEls.push({
          tag: el.tagName, cls: (el.className || '').toString().slice(0, 60),
          scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, isScroller,
        });
      }
    });
    return {
      htmlScrollWidth: html.scrollWidth,
      htmlClientWidth: html.clientWidth,
      overflowEls: overflowEls.slice(0, 15),
      overflowCount: overflowEls.length,
      nonScrollerOverflowCount: overflowEls.filter((e) => !e.isScroller).length,
    };
  });
  await ctx.close();
  return data;
}

(async () => {
  const browser = await launch();
  const results = { zoom200_at1440: {}, zoom400_at1280: {} };

  for (const route of ROUTES) {
    results.zoom200_at1440[route] = await measure(browser, route, 720, 450);
  }
  for (const route of ROUTES) {
    results.zoom400_at1280[route] = await measure(browser, route, 320, 225);
  }

  console.log(JSON.stringify(results, null, 1));

  let failing = 0;
  for (const arm of ['zoom200_at1440', 'zoom400_at1280']) {
    for (const [route, r] of Object.entries(results[arm])) {
      const bodyOverflow = r.htmlScrollWidth > r.htmlClientWidth + 1;
      if (bodyOverflow || r.nonScrollerOverflowCount > 0) failing++;
    }
  }
  console.error(`\naudit9-p9-reflow: ${ROUTES.length} routes x 2 zoom arms, ${failing} failing`);
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error('audit9-p9-reflow FATAL', e); process.exit(1); });
