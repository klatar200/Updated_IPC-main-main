/**
 * AUDIT-10 pass-2 — the mobile drawer OPEN, on all ten public routes, at both
 * small viewports. The capture crawler only ever saw it closed.
 *
 * The drawer is gated `lg:hidden` (src/App.jsx:1231), so it is live at BOTH
 * 834 and 390 — tablet-834 is not a "desktop nav" band.
 *
 * Measures, per route x viewport x accordion state: document overflowX with
 * the drawer open, the drawer's own rect against maxHeight:calc(100vh-64px),
 * whether its content scrolls and whether the LAST item is reachable, the
 * scrim, and the scroll lock. Screenshots every open state (viewport-sized,
 * not fullPage: a position:relative drawer inside a fullPage capture paints
 * onto the expanded canvas and lies about what the visitor sees).
 *
 * Usage: node _harness/audit10-p2menu.js   (needs :8123)
 * Output: _harness/out/audit10/p2menu.json + out/audit10/menu/<vp>__<slug>__<state>.png
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10');
const SHOTS = path.join(OUT, 'menu');

const VIEWPORTS = [
  { name: 'tablet-834', width: 834, height: 1112 },
  { name: 'mobile-390', width: 390, height: 844 },
];
const ROUTES = ['/', '/products', '/services', '/industries', '/about',
  '/contact', '/dashboard', '/datasheets', '/faq', '/privacy'];
const slug = (u) => u.replace(/^\//, '').replace(/[/?&=%]+/g, '_') || 'home';

const measureDrawer = () => {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return { open: false };
  const r = dlg.getBoundingClientRect();
  const cs = getComputedStyle(dlg);
  const scrim = [...document.querySelectorAll('div')].find((d) => {
    const c = getComputedStyle(d);
    const rr = d.getBoundingClientRect();
    return c.position === 'fixed' && /rgba\(0, 0, 0/.test(c.backgroundColor) &&
      rr.width >= vw - 1 && rr.height > vh * 0.6;
  });
  const items = [...dlg.querySelectorAll('a[href], button')].map((el) => {
    const b = el.getBoundingClientRect();
    return {
      text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 32),
      w: +b.width.toFixed(1), h: +b.height.toFixed(1),
      top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1),
      right: +b.right.toFixed(1),
      // visible in the drawer's own scroll window AND in the viewport
      inDrawer: b.top >= r.top - 0.5 && b.bottom <= r.bottom + 0.5,
      inViewport: b.top >= 0 && b.bottom <= vh + 0.5,
    };
  });
  const last = items[items.length - 1] || null;
  return {
    open: true,
    drawer: {
      top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1), w: +r.width.toFixed(1),
      maxHeight: cs.maxHeight, overflowY: cs.overflowY, position: cs.position, zIndex: cs.zIndex,
      scrollHeight: dlg.scrollHeight, clientHeight: dlg.clientHeight,
      scrolls: dlg.scrollHeight - dlg.clientHeight > 1,
      hiddenBelow: Math.max(0, dlg.scrollHeight - dlg.clientHeight),
      pastViewport: +Math.max(0, r.bottom - vh).toFixed(1),
    },
    scrim: !!scrim,
    scrimRect: scrim ? (() => { const s = scrim.getBoundingClientRect(); return { top: +s.top.toFixed(1), bottom: +s.bottom.toFixed(1), h: +s.height.toFixed(1) }; })() : null,
    bodyOverflow: getComputedStyle(document.body).overflow,
    bodyPosition: getComputedStyle(document.body).position,
    overflowX: Math.round(Math.max(document.documentElement.scrollWidth - vw, document.body.scrollWidth - vw)),
    itemCount: items.length,
    itemsOutOfView: items.filter((i) => !i.inViewport).length,
    tinyItems: items.filter((i) => i.w < 24 || i.h < 24).map((i) => `${i.w}x${i.h} "${i.text}"`),
    itemsPastRight: items.filter((i) => i.right > vw + 1).map((i) => `"${i.text}" right=${i.right}`),
    last,
    vh, vw,
  };
};

(async () => {
  const browser = await launch();
  fs.mkdirSync(SHOTS, { recursive: true });
  const rows = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true,
    });
    const page = await ctx.newPage();
    for (const url of ROUTES) {
      try {
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        const burgerVisible = await page.locator('button[aria-label="Open menu"]').isVisible().catch(() => false);
        if (!burgerVisible) { rows.push({ url, viewport: vp.name, burgerVisible: false }); continue; }
        await page.click('button[aria-label="Open menu"]');
        await page.waitForTimeout(450);
        const collapsed = await page.evaluate(measureDrawer);
        await page.screenshot({ path: path.join(SHOTS, `${vp.name}__${slug(url)}__collapsed.png`) });

        // both accordions expanded — the tallest state the drawer ever has
        for (const label of ['Products', 'Company']) {
          const b = page.locator(`[role="dialog"] button:has-text("${label}")`).first();
          if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(300); }
        }
        const expanded = await page.evaluate(measureDrawer);
        await page.screenshot({ path: path.join(SHOTS, `${vp.name}__${slug(url)}__expanded.png`) });

        // can the drawer actually be scrolled to its last item?
        const scrolled = await page.evaluate(() => {
          const dlg = document.querySelector('[role="dialog"]');
          if (!dlg) return null;
          dlg.scrollTop = dlg.scrollHeight;
          const items = [...dlg.querySelectorAll('a[href], button')];
          const last = items[items.length - 1];
          const r = last ? last.getBoundingClientRect() : null;
          const d = dlg.getBoundingClientRect();
          return {
            scrollTop: Math.round(dlg.scrollTop),
            lastText: last ? (last.textContent || '').trim().slice(0, 30) : null,
            lastVisibleInViewport: r ? (r.top >= 0 && r.bottom <= window.innerHeight + 0.5) : null,
            lastVisibleInDrawer: r ? (r.top >= d.top - 0.5 && r.bottom <= d.bottom + 0.5) : null,
            drawerBottom: +d.bottom.toFixed(1), vh: window.innerHeight,
          };
        });
        await page.screenshot({ path: path.join(SHOTS, `${vp.name}__${slug(url)}__expanded-scrolled.png`) });
        rows.push({ url, viewport: vp.name, burgerVisible: true, collapsed, expanded, scrolled });
      } catch (e) {
        rows.push({ url, viewport: vp.name, error: String(e).slice(0, 250) });
      }
      process.stdout.write('.');
    }
    await ctx.close();
    console.log(` ${vp.name} done`);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'p2menu.json'), JSON.stringify(rows, null, 1));

  console.log('\n== drawer summary (expanded = both accordions open) ==');
  for (const r of rows) {
    if (r.error) { console.log(`  ERR ${r.viewport} ${r.url} ${r.error}`); continue; }
    if (r.burgerVisible === false) { console.log(`  ${r.viewport} ${r.url}: hamburger NOT visible`); continue; }
    const e = r.expanded || {};
    const d = e.drawer || {};
    console.log(`  ${r.viewport} ${r.url}: items=${e.itemCount} h=${d.h}/${d.maxHeight} scrolls=${d.scrolls} hiddenBelow=${d.hiddenBelow} outOfView=${e.itemsOutOfView} pastVp=${d.pastViewport} scrim=${e.scrim} overflowX=${e.overflowX} bodyOverflow=${e.bodyOverflow} tiny=${(e.tinyItems || []).length} lastReachable=${r.scrolled ? r.scrolled.lastVisibleInViewport : '?'}`);
    if ((e.tinyItems || []).length) console.log(`      tiny: ${e.tinyItems.join(' | ')}`);
    if ((e.itemsPastRight || []).length) console.log(`      pastRight: ${e.itemsPastRight.join(' | ')}`);
  }
  console.log(`-> ${path.join(OUT, 'p2menu.json')}, screenshots -> ${SHOTS}`);
})();
