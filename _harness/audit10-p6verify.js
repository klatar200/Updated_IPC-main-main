/**
 * AUDIT-10 pass-6 — targeted re-verification of three things the broad probes
 * could not measure correctly.
 *
 * 1. DRAWER SCROLL RESTORE. audit10-p6menus.js recorded scrollY BEFORE tabbing
 *    to the burger, and tabbing to the skip link scrolls the page to the top
 *    on the way — so it compared the restored offset against a number that was
 *    already stale and reported a mismatch on all 20 runs. Here the offset is
 *    read in the same breath as the Enter press. B13's restore claim deserves
 *    a measurement that is actually about B13.
 *
 * 2. ESCAPE INSIDE AN OPEN MEGA-MENU. Escape is handled on the trigger's
 *    onKeyDown. Once Tab has moved focus into the panel, the trigger is no
 *    longer the event target. Measured three ways: Escape with focus on the
 *    trigger, Escape with focus on the first panel link, and Escape after
 *    opening by mouse and moving the pointer into the panel.
 *
 * 3. STICKY RFQ BAR. It renders only past `scrollY > headerHeight + 40`, so
 *    every probe that measured the product page at rest measured a bar that
 *    was not in the DOM. Scrolled into existence here, then swept for its
 *    entrance animation, hover state and focus ring — in both motion modes.
 *
 * Output: _harness/out/audit10/p6/verify.json
 * Usage:  node _harness/audit10-p6verify.js       (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10', 'p6');
const SHOTS = path.join(OUT, 'verify');

const HELP = `
window.__v = {
  burger: () => [...document.querySelectorAll('button')]
    .find((b) => /menu/i.test(b.getAttribute('aria-label') || '')) || null,
  stickyBar: () => [...document.querySelectorAll('div')].find((d) => {
    const cs = getComputedStyle(d);
    return cs.position === 'fixed' && d.getBoundingClientRect().height > 40
      && /quote/i.test(d.textContent || '');
  }) || null,
  style: (el) => {
    const cs = getComputedStyle(el);
    return { backgroundColor: cs.backgroundColor, color: cs.color, filter: cs.filter,
      transform: cs.transform, boxShadow: cs.boxShadow, opacity: cs.opacity,
      outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor,
      borderTopColor: cs.borderTopColor, animationName: cs.animationName,
      transitionDuration: cs.transitionDuration, cursor: cs.cursor };
  },
};
`;

const results = { drawerRestore: [], megaEscape: [], sticky: {} };

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await launch();
  try {
    // ══ 1. drawer scroll restore ═════════════════════════════════════════
    for (const vp of [{ name: 'mobile-390', width: 390, height: 844 },
                      { name: 'tablet-834', width: 834, height: 1112 }]) {
      for (const route of ['/', '/products', '/faq', '/contact', '/privacy']) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await ctx.newPage();
        await page.goto(BASE + route, { waitUntil: 'networkidle' });
        await page.addScriptTag({ content: HELP });
        await page.waitForTimeout(250);

        // Reach the burger FIRST (this is what scrolls the page around), and
        // only then set the scroll offset whose restoration is being tested.
        await page.evaluate(() => { document.body.focus();
          document.documentElement.setAttribute('tabindex', '-1'); document.documentElement.focus(); });
        let on = false, t = 0;
        for (; t < 30; t++) {
          await page.keyboard.press('Tab');
          on = await page.evaluate(() => document.activeElement === window.__v.burger());
          if (on) break;
        }
        const rec = { viewport: vp.name, route, tabsToBurger: on ? t + 1 : null };
        if (!on) { rec.error = 'burger not reachable'; results.drawerRestore.push(rec); await ctx.close(); continue; }

        await page.evaluate(() => window.scrollTo(0, 600));
        await page.waitForTimeout(250);
        rec.scrollBeforeOpen = await page.evaluate(() => Math.round(window.scrollY));
        await page.keyboard.press('Enter');
        await page.waitForTimeout(450);
        rec.whileOpen = await page.evaluate(() => ({
          scrollY: Math.round(window.scrollY),
          bodyPosition: getComputedStyle(document.body).position,
          bodyTop: getComputedStyle(document.body).top,
        }));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        rec.afterClose = await page.evaluate(() => Math.round(window.scrollY));
        rec.restoredOk = Math.abs(rec.afterClose - rec.scrollBeforeOpen) <= 2;
        results.drawerRestore.push(rec);
        await ctx.close();
        process.stdout.write('.');
      }
    }

    // ══ 2. Escape inside an open mega-menu ═══════════════════════════════
    for (const how of ['trigger-enter', 'panel-after-tab', 'panel-after-hover']) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: HELP });
      await page.waitForTimeout(250);
      const rec = { how };
      try {
        if (how === 'panel-after-hover') {
          await page.locator('button[aria-haspopup]').first().hover();
          await page.waitForTimeout(350);
          const link = page.locator('.ipc-dropdown-panel a').first();
          await link.hover();
          await page.waitForTimeout(250);
        } else {
          await page.evaluate(() => { document.body.focus();
            document.documentElement.setAttribute('tabindex', '-1'); document.documentElement.focus(); });
          let on = false;
          for (let i = 0; i < 30 && !on; i++) {
            await page.keyboard.press('Tab');
            on = await page.evaluate(() => document.activeElement.hasAttribute('aria-haspopup'));
          }
          rec.reachedTrigger = on;
          await page.keyboard.press('Enter');
          await page.waitForTimeout(350);
          if (how === 'panel-after-tab') {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(250);
          }
        }
        rec.beforeEscape = await page.evaluate(() => {
          const b = document.querySelector('button[aria-haspopup]');
          const panel = document.querySelector('.ipc-dropdown-panel');
          const a = document.activeElement;
          return { expanded: b.getAttribute('aria-expanded'), panelPresent: !!panel,
                   panelVisible: !!(panel && panel.getBoundingClientRect().height > 0),
                   focusIsTrigger: a === b,
                   focusInPanel: !!(panel && panel.contains(a)),
                   activeText: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) };
        });
        await page.screenshot({ path: path.join(SHOTS, `mega__${how}__before-escape.png`),
                                clip: { x: 0, y: 0, width: 1000, height: 480 } });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        rec.afterEscape = await page.evaluate(() => {
          const b = document.querySelector('button[aria-haspopup]');
          const panel = document.querySelector('.ipc-dropdown-panel');
          const a = document.activeElement;
          return { expanded: b.getAttribute('aria-expanded'), panelPresent: !!panel,
                   panelVisible: !!(panel && panel.getBoundingClientRect().height > 0),
                   focusIsTrigger: a === b,
                   focusInPanel: !!(panel && panel.contains(a)),
                   activeText: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) };
        });
        rec.closedByEscape = rec.afterEscape.expanded === 'false' && !rec.afterEscape.panelVisible;
        await page.screenshot({ path: path.join(SHOTS, `mega__${how}__after-escape.png`),
                                clip: { x: 0, y: 0, width: 1000, height: 480 } });
      } catch (e) { rec.error = String(e).slice(0, 200); }
      results.megaEscape.push(rec);
      await ctx.close();
      process.stdout.write('m');
    }

    // ══ 3. sticky RFQ bar, scrolled into existence ═══════════════════════
    for (const mode of ['no-preference', 'reduce']) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: mode });
      const page = await ctx.newPage();
      await page.goto(BASE + '/products?productId=CC', { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: HELP });
      await page.waitForTimeout(400);
      const rec = { mode };
      rec.atRest = await page.evaluate(() => ({
        present: !!window.__v.stickyBar(),
        bodyClass: document.body.className,
        bodyPaddingBottom: getComputedStyle(document.body).paddingBottom,
      }));
      await page.evaluate(() => window.scrollTo(0, 900));
      const frames = [];
      for (const w of [60, 120, 240, 500, 1200, 4000]) {
        await page.waitForTimeout(w);
        frames.push(await page.evaluate(() => {
          const bar = window.__v.stickyBar();
          if (!bar) return { present: false, running: (document.getAnimations ? document.getAnimations() : []).length };
          const r = bar.getBoundingClientRect();
          const cs = getComputedStyle(bar);
          return { present: true, top: Math.round(r.top), height: Math.round(r.height),
                   transform: cs.transform, opacity: cs.opacity, transition: cs.transitionDuration,
                   animationName: cs.animationName,
                   bodyPaddingBottom: getComputedStyle(document.body).paddingBottom,
                   running: (document.getAnimations ? document.getAnimations() : []).length };
        }));
      }
      rec.frames = frames;
      // hover + focus on the bar's CTA
      rec.cta = await page.evaluate(() => {
        const bar = window.__v.stickyBar();
        if (!bar) return null;
        const a = bar.querySelector('a[href],button');
        if (!a) return null;
        a.setAttribute('data-v', '1');
        const r = a.getBoundingClientRect();
        return { text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
                 cls: (typeof a.className === 'string' ? a.className : '').slice(0, 80),
                 rect: { x: r.x, y: r.y, w: r.width, h: r.height },
                 style: window.__v.style(a) };
      });
      if (rec.cta) {
        await page.mouse.move(2, 2); await page.waitForTimeout(300);
        const before = await page.evaluate(() => window.__v.style(document.querySelector('[data-v]')));
        await page.mouse.move(rec.cta.rect.x + rec.cta.rect.w / 2, rec.cta.rect.y + rec.cta.rect.h / 2);
        await page.waitForTimeout(450);
        const hov = await page.evaluate(() => window.__v.style(document.querySelector('[data-v]')));
        rec.hoverDelta = Object.keys(before).filter((k) => before[k] !== hov[k]).map((k) => `${k}: ${before[k]} -> ${hov[k]}`);
        await page.screenshot({ path: path.join(SHOTS, `sticky__${mode}.png`),
                                clip: { x: 0, y: 900 - 110, width: 1440, height: 110 } });
      }
      results.sticky[mode] = rec;
      await ctx.close();
      process.stdout.write('s');
    }
  } finally { await browser.close(); }

  fs.writeFileSync(path.join(OUT, 'verify.json'), JSON.stringify(results, null, 1));

  console.log('\n\n══ 1. drawer scroll restore (offset read at the moment of opening) ══');
  for (const r of results.drawerRestore) {
    if (r.error) { console.log(`  ${r.viewport} ${r.route}: ${r.error}`); continue; }
    console.log(`  ${r.viewport.padEnd(12)} ${r.route.padEnd(12)} before=${r.scrollBeforeOpen} whileOpen(scrollY=${r.whileOpen.scrollY}, body ${r.whileOpen.bodyPosition} top ${r.whileOpen.bodyTop}) afterClose=${r.afterClose}  ${r.restoredOk ? 'RESTORED' : 'NOT RESTORED'}`);
  }
  console.log('\n══ 2. Escape on the mega-menu ══');
  for (const r of results.megaEscape) {
    console.log(`\n  ${r.how}`);
    console.log(`    before Escape: ${JSON.stringify(r.beforeEscape)}`);
    console.log(`    after  Escape: ${JSON.stringify(r.afterEscape)}`);
    console.log(`    closed by Escape: ${r.closedByEscape}`);
  }
  console.log('\n══ 3. sticky RFQ bar ══');
  for (const [mode, r] of Object.entries(results.sticky)) {
    console.log(`\n  prefers-reduced-motion: ${mode}`);
    console.log(`    at rest (scrollY=0): ${JSON.stringify(r.atRest)}`);
    r.frames.forEach((f, i) => console.log(`    frame ${i}: ${JSON.stringify(f)}`));
    console.log(`    CTA: ${r.cta ? JSON.stringify({ text: r.cta.text, cls: r.cta.cls, cursor: r.cta.style.cursor }) : 'none'}`);
    console.log(`    CTA hover delta: ${JSON.stringify(r.hoverDelta)}`);
  }
  console.log(`\nrecord -> ${path.join(OUT, 'verify.json')}`);
})();
