/**
 * AUDIT-10 pass-6 step 6.4 — overlay and menu behaviour.
 *
 * Mobile drawer (390 and 834): opened by a REAL Enter press on the burger, not
 * by .click(), because the question is what a keyboard user gets. Then:
 * does focus enter the drawer, does Tab stay inside it, does Shift+Tab wrap
 * backwards, does Escape close it AND return focus to the burger, is the page
 * behind it actually scroll-locked, and is the scroll offset restored on close.
 *
 * Mega-menu: PLAN-8's `hidden lg:flex` puts the desktop nav behind the lg
 * breakpoint, so at 834 there is no mega-menu to open — the drawer replaces
 * it. That is measured here rather than assumed, because "mega-menus broken on
 * touch" is a REFUTED claim (GUARDRAILS §7) and the only honest way to keep it
 * refuted is to show what the 834 viewport actually renders. At 1440 the
 * trigger is exercised by click AND by Enter/Space/ArrowDown/Escape, since
 * hover-only opening would be the real defect.
 *
 * Output: _harness/out/audit10/p6/menus.json
 * Usage:  node _harness/audit10-p6menus.js         (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10', 'p6');
const SHOTS = path.join(OUT, 'menus');

const DRAWER_VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-834', width: 834, height: 1112 },
];
const ROUTES = ['/', '/products', '/services', '/industries', '/about', '/contact',
                '/dashboard', '/datasheets', '/faq', '/privacy'];

const ACTIVE = () => {
  const a = document.activeElement;
  if (!a) return null;
  const drawer = document.querySelector('[data-ipc-drawer], nav[aria-label*="obile" i], .lg\\:hidden');
  return {
    tag: a.tagName.toLowerCase(),
    text: (a.textContent || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 46),
    isBody: a === document.body,
  };
};

/** Everything about the drawer's containment, read from the live DOM. */
const DRAWER_STATE = `
window.__dr = {
  burger: () => [...document.querySelectorAll('button')]
    .find((b) => /open menu|close menu|menu/i.test(b.getAttribute('aria-label') || '')) || null,
  /* The drawer is whatever element contains the burger's controlled content:
     find the nav-ish container that appears only when the menu is open. */
  panel: () => {
    const b = window.__dr.burger();
    if (!b) return null;
    const header = b.closest('header') || document.body;
    const cands = [...header.querySelectorAll('div,nav')]
      .filter((el) => el !== b.parentElement && el.querySelectorAll('a[href]').length >= 3)
      .filter((el) => el.getBoundingClientRect().height > 100);
    return cands.length ? cands[cands.length - 1] : null;
  },
  state: () => {
    const b = window.__dr.burger();
    const p = window.__dr.panel();
    const a = document.activeElement;
    const cs = getComputedStyle(document.body);
    return {
      burgerLabel: b ? b.getAttribute('aria-label') : null,
      burgerExpanded: b ? b.getAttribute('aria-expanded') : null,
      panelPresent: !!p,
      panelLinks: p ? p.querySelectorAll('a[href],button').length : 0,
      focusInPanel: !!(p && a && p.contains(a)),
      focusIsBurger: !!(b && a === b),
      activeText: a ? (a.textContent || a.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 44) : null,
      bodyPosition: cs.position,
      bodyOverflow: cs.overflow,
      bodyTop: cs.top,
      scrollY: Math.round(window.scrollY),
      docScrollTop: Math.round(document.documentElement.scrollTop),
    };
  },
};
`;

const results = { drawer: {}, mega: {}, notes: [] };

async function drawerRun(browser, vp, route) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const r = { route, viewport: vp.name };
  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(350);
    await page.addScriptTag({ content: DRAWER_STATE });

    // Scroll down first, so the restore-on-close assertion has something to
    // restore. A drawer tested at scrollY=0 cannot fail that check.
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(200);
    r.scrollBeforeOpen = await page.evaluate(() => Math.round(window.scrollY));
    r.closed = await page.evaluate(() => window.__dr.state());

    // ── open with a REAL Enter on the burger ──────────────────────────────
    await page.evaluate(() => { document.body.focus();
      document.documentElement.setAttribute('tabindex', '-1'); document.documentElement.focus(); });
    let tabs = 0;
    let onBurger = false;
    for (; tabs < 40; tabs++) {
      await page.keyboard.press('Tab');
      onBurger = await page.evaluate(() => window.__dr.state().focusIsBurger);
      if (onBurger) break;
    }
    r.tabsToBurger = onBurger ? tabs + 1 : null;
    if (!onBurger) { r.error = 'burger never reached by Tab'; await ctx.close(); return r; }

    await page.keyboard.press('Enter');
    await page.waitForTimeout(420);
    r.openedByEnter = await page.evaluate(() => window.__dr.state());

    // ── scroll lock ───────────────────────────────────────────────────────
    r.scrollAttempt = await page.evaluate(() => {
      const before = Math.round(window.scrollY);
      window.scrollTo(0, 1400);
      return { before, after: Math.round(window.scrollY),
               bodyPosition: getComputedStyle(document.body).position,
               bodyTop: getComputedStyle(document.body).top };
    });

    // ── Tab containment: 2 full cycles' worth of presses ──────────────────
    const n = Math.max(6, Math.min(40, (r.openedByEnter.panelLinks || 6) * 2 + 4));
    const walk = [];
    for (let i = 0; i < n; i++) {
      await page.keyboard.press('Tab');
      walk.push(await page.evaluate(() => {
        const s = window.__dr.state();
        return { inPanel: s.focusInPanel, isBurger: s.focusIsBurger, text: s.activeText };
      }));
    }
    r.tabWalkInDrawer = walk;
    r.escapedDrawer = walk.filter((w) => !w.inPanel && !w.isBurger).length;
    r.containment = r.escapedDrawer === 0 ? 'contained' : `${r.escapedDrawer}/${n} presses left the drawer`;

    // ── Shift+Tab backwards from the first item ───────────────────────────
    await page.keyboard.press('Shift+Tab');
    r.afterShiftTab = await page.evaluate(() => {
      const s = window.__dr.state();
      return { inPanel: s.focusInPanel, text: s.activeText };
    });

    await page.screenshot({ path: path.join(SHOTS, `${vp.name}__${route.replace(/[^a-z0-9]+/gi, '_')}__drawer-open.png`) });

    // ── Escape ────────────────────────────────────────────────────────────
    await page.keyboard.press('Escape');
    await page.waitForTimeout(420);
    r.afterEscape = await page.evaluate(() => window.__dr.state());
    r.focusReturnedToBurger = r.afterEscape.focusIsBurger;
    r.scrollRestored = r.afterEscape.scrollY;
    r.scrollRestoredOk = Math.abs(r.afterEscape.scrollY - r.scrollBeforeOpen) <= 2;
  } catch (e) {
    r.error = String(e).slice(0, 220);
  }
  await ctx.close();
  return r;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await launch();
  try {
    // ── drawer, both small viewports, all 10 routes ───────────────────────
    for (const vp of DRAWER_VIEWPORTS) {
      results.drawer[vp.name] = [];
      for (const route of ROUTES) {
        results.drawer[vp.name].push(await drawerRun(browser, vp, route));
        process.stdout.write('.');
      }
    }

    // ── mega-menu presence per viewport, then operation at 1440 ───────────
    for (const vp of [{ name: 'desktop-1440', width: 1440, height: 900 },
                      { name: 'tablet-834', width: 834, height: 1112 },
                      { name: 'mobile-390', width: 390, height: 844 }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(350);
      const rec = { viewport: vp.name };
      rec.presence = await page.evaluate(() => {
        const trig = [...document.querySelectorAll('button[aria-haspopup]')].map((b) => {
          const r = b.getBoundingClientRect();
          return { text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24),
                   expanded: b.getAttribute('aria-expanded'),
                   visible: r.width > 0 && r.height > 0,
                   rect: { w: Math.round(r.width), h: Math.round(r.height) } };
        });
        const nav = document.querySelector('nav.hidden.lg\\:flex');
        return { triggers: trig,
                 desktopNavDisplay: nav ? getComputedStyle(nav).display : 'absent',
                 burgerVisible: [...document.querySelectorAll('button')]
                   .filter((b) => /menu/i.test(b.getAttribute('aria-label') || ''))
                   .map((b) => getComputedStyle(b).display) };
      });

      if (rec.presence.triggers.some((t) => t.visible)) {
        // open by CLICK
        const trig = page.locator('button[aria-haspopup]').first();
        await trig.click();
        await page.waitForTimeout(300);
        rec.byClick = await page.evaluate(() => {
          const b = document.querySelector('button[aria-haspopup]');
          const panel = document.querySelector('.ipc-dropdown-panel');
          const r = panel ? panel.getBoundingClientRect() : null;
          return { expanded: b.getAttribute('aria-expanded'),
                   panelVisible: !!(r && r.width > 0 && r.height > 0),
                   panelLinks: panel ? panel.querySelectorAll('a[href]').length : 0 };
        });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
        rec.escapeAfterClick = await page.evaluate(() =>
          document.querySelector('button[aria-haspopup]').getAttribute('aria-expanded'));

        // open by real keyboard: Tab to the trigger, then Enter / ArrowDown
        await page.evaluate(() => { document.body.focus();
          document.documentElement.setAttribute('tabindex', '-1'); document.documentElement.focus(); });
        let hit = false, t = 0;
        for (; t < 30; t++) {
          await page.keyboard.press('Tab');
          hit = await page.evaluate(() => document.activeElement.hasAttribute('aria-haspopup'));
          if (hit) break;
        }
        rec.tabsToTrigger = hit ? t + 1 : null;
        if (hit) {
          await page.keyboard.press('Enter');
          await page.waitForTimeout(300);
          rec.byEnter = await page.evaluate(() => {
            const b = document.activeElement;
            const panel = document.querySelector('.ipc-dropdown-panel');
            const r = panel ? panel.getBoundingClientRect() : null;
            return { expanded: b.getAttribute('aria-expanded'),
                     panelVisible: !!(r && r.width > 0 && r.height > 0),
                     focusStillOnTrigger: b.hasAttribute('aria-haspopup') };
          });
          // Does Tab from the open trigger enter the panel?
          await page.keyboard.press('Tab');
          await page.waitForTimeout(200);
          rec.tabFromOpenTrigger = await page.evaluate(() => {
            const a = document.activeElement;
            const panel = document.querySelector('.ipc-dropdown-panel');
            return { inPanel: !!(panel && panel.contains(a)),
                     text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
                     panelStillOpen: !!panel };
          });
          await page.keyboard.press('Escape');
          await page.waitForTimeout(250);
          rec.escapeAfterEnter = await page.evaluate(() => {
            const b = document.querySelector('button[aria-haspopup]');
            return { expanded: b.getAttribute('aria-expanded'),
                     panelPresent: !!document.querySelector('.ipc-dropdown-panel'),
                     focusIsTrigger: document.activeElement === b };
          });
        }
        await page.screenshot({ path: path.join(SHOTS, `${vp.name}__mega-open.png`) });
      }
      results.mega[vp.name] = rec;
      await ctx.close();
      process.stdout.write('m');
    }
  } finally { await browser.close(); }

  fs.writeFileSync(path.join(OUT, 'menus.json'), JSON.stringify(results, null, 1));

  console.log('\n\n══ 6.4 mobile drawer ══');
  for (const [vpn, list] of Object.entries(results.drawer)) {
    console.log(`\n── ${vpn}`);
    for (const r of list) {
      if (r.error) { console.log(`  ${r.route}: ERROR ${r.error}`); continue; }
      console.log(`  ${r.route.padEnd(12)} burger@Tab${String(r.tabsToBurger).padStart(3)} · opened=${r.openedByEnter.burgerExpanded} · focusInPanel=${r.openedByEnter.focusInPanel} · ${r.containment} · shiftTabInPanel=${r.afterShiftTab.inPanel} · esc→burger=${r.focusReturnedToBurger} · scrollLock ${r.scrollAttempt.before}→${r.scrollAttempt.after} (body ${r.scrollAttempt.bodyPosition}) · restored ${r.scrollRestored}/${r.scrollBeforeOpen} ${r.scrollRestoredOk ? 'ok' : 'MISMATCH'}`);
    }
  }
  console.log('\n══ 6.4 mega-menu ══');
  for (const [vpn, r] of Object.entries(results.mega)) {
    console.log(`\n── ${vpn}`);
    console.log(`  desktop nav display: ${r.presence.desktopNavDisplay} · burger display: ${r.presence.burgerVisible.join(',')}`);
    console.log(`  triggers: ${JSON.stringify(r.presence.triggers)}`);
    if (r.byClick) console.log(`  by CLICK: ${JSON.stringify(r.byClick)}  escape→expanded=${r.escapeAfterClick}`);
    if (r.byEnter) console.log(`  by ENTER (Tab x${r.tabsToTrigger}): ${JSON.stringify(r.byEnter)}`);
    if (r.tabFromOpenTrigger) console.log(`  Tab from open trigger: ${JSON.stringify(r.tabFromOpenTrigger)}`);
    if (r.escapeAfterEnter) console.log(`  Escape after Enter: ${JSON.stringify(r.escapeAfterEnter)}`);
  }
  console.log(`\nrecord -> ${path.join(OUT, 'menus.json')}`);
})();
