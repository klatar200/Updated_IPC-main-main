/**
 * AUDIT-10 pass-6 — second verification round.
 *
 * Five things the broad probes measured wrongly or not at all:
 *
 * 1. FAQ ACCORDION. audit10-p6behavior.js selected `button[aria-expanded]`
 *    first-match, which on /faq is the NAVBAR's Products trigger, not a FAQ
 *    row — so its "panel absent, not findable" reading described the mega-menu.
 *    Selected here by aria-controls^="faq-panel".
 *
 * 2. DRAWER SCROLL ANCHORING. plan8-mobile.js records a 600 -> 876 shift and
 *    attributes it to Playwright scrolling the burger into view before
 *    clicking it; on that reading the restore is exactly right and there is
 *    nothing to report. But the keyboard path reproduces the same 276px with
 *    no click at all. Settled here with a REAL WHEEL SCROLL and a real Enter:
 *    if scrollY moves between "just before Enter" and "drawer open", no
 *    harness action caused it and a visitor sees it too.
 *
 * 3. BACK/FORWARD. Measured twice per viewport with a long settle, because a
 *    SPA restores scroll after its re-render and a short wait reads the
 *    intermediate state.
 *
 * 4. SIDEBAR onNavigate vs the sticky navbar at 834/390, with the h1's height
 *    so "behind the navbar" is a number of covered pixels, not a boolean.
 *
 * 5. CONTACT formError FOCUS. The native-validation path was measured already
 *    (focus goes to the first invalid field). The DOCUMENTED behaviour —
 *    focus moves to the alert — belongs to the server-error path, reached
 *    here by tripping contact.php's 5-per-10-minutes rate limit with a form
 *    that passes native validation.
 *
 * Plus: a.ipc-tap hover in the page body vs in the sticky bar, since the class
 * turns out to be two different components sharing one signature.
 *
 * Output: _harness/out/audit10/p6/verify2.json
 * Usage:  node _harness/audit10-p6verify2.js      (needs :8123)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10', 'p6');
const SHOTS = path.join(OUT, 'verify2');

const results = { faq: {}, drawerAnchor: [], backForward: [], sidebar: [], contactAlert: {}, ipcTap: [] };

const clearLimiter = () => {
  for (const f of fs.readdirSync(os.tmpdir())) {
    if (f.startsWith('ipc_rl_')) { try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch {} }
  }
};

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await launch();
  try {
    // ══ 1. FAQ accordion, correctly selected ═════════════════════════════
    for (const mode of ['no-preference', 'reduce']) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: mode });
      const page = await ctx.newPage();
      await page.goto(BASE + '/faq', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const rec = { mode };
      rec.triggers = await page.evaluate(() =>
        document.querySelectorAll('button[aria-controls^="faq-panel"]').length);

      // Reach the first FAQ trigger with real Tab presses, then Enter.
      await page.evaluate(() => { document.body.focus();
        document.documentElement.setAttribute('tabindex', '-1'); document.documentElement.focus(); });
      let on = false, t = 0;
      for (; t < 60; t++) {
        await page.keyboard.press('Tab');
        on = await page.evaluate(() => (document.activeElement.getAttribute('aria-controls') || '').startsWith('faq-panel'));
        if (on) break;
      }
      rec.tabsToFirstFaqTrigger = on ? t + 1 : null;
      const read = () => page.evaluate(() => {
        const b = document.activeElement;
        const id = b.getAttribute('aria-controls');
        const p = id ? document.getElementById(id) : null;
        return { expanded: b.getAttribute('aria-expanded'),
                 panelInDom: !!p,
                 panelDisplay: p ? getComputedStyle(p).display : 'absent',
                 panelHeight: p ? Math.round(p.getBoundingClientRect().height) : 0,
                 maxHeight: p ? getComputedStyle(p).maxHeight : null,
                 transition: p ? getComputedStyle(p).transitionDuration : null,
                 running: (document.getAnimations ? document.getAnimations() : []).length };
      });
      if (on) {
        rec.closed = await read();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(120); rec.openT120 = await read();
        await page.waitForTimeout(700); rec.openSettled = await read();
        await page.keyboard.press(' ');
        await page.waitForTimeout(120); rec.closeT120 = await read();
        await page.waitForTimeout(900); rec.closeSettled = await read();
        rec.enterToggles = rec.openSettled.expanded === 'true';
        rec.spaceToggles = rec.closeSettled.expanded === 'false';
        // 4.20: a collapsed answer must leave the a11y tree AND find-in-page
        rec.collapsedLeavesTree = rec.closeSettled.panelDisplay === 'none' || !rec.closeSettled.panelInDom;
      }
      results.faq[mode] = rec;
      await ctx.close();
      process.stdout.write('f');
    }

    // ══ 2. drawer scroll anchoring, real wheel scroll, no click ══════════
    for (const vp of [{ name: 'mobile-390', width: 390, height: 844 },
                      { name: 'tablet-834', width: 834, height: 1112 }]) {
      for (const pass of [1, 2]) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await ctx.newPage();
        await page.goto(BASE + '/products?productId=IP33PO', { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);
        // real wheel, not scrollTo
        await page.mouse.move(vp.width / 2, vp.height / 2);
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(600);
        const rec = { viewport: vp.name, pass };
        rec.afterWheel = await page.evaluate(() => Math.round(window.scrollY));
        // focus the burger WITHOUT any scrolling action
        await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')]
            .find((x) => /menu/i.test(x.getAttribute('aria-label') || ''));
          if (b) b.focus({ preventScroll: true });
        });
        await page.waitForTimeout(200);
        rec.beforeEnter = await page.evaluate(() => Math.round(window.scrollY));
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        rec.lockedAt = await page.evaluate(() => {
          const t = document.body.style.top;
          return t ? Math.abs(parseInt(t, 10)) : null;
        });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
        rec.afterClose = await page.evaluate(() => Math.round(window.scrollY));
        rec.shiftFromBeforeEnter = rec.afterClose - rec.beforeEnter;
        rec.lockMatchesBeforeEnter = rec.lockedAt === rec.beforeEnter;
        results.drawerAnchor.push(rec);
        await ctx.close();
        process.stdout.write('d');
      }
    }

    // ══ 3. back/forward, twice, long settle ══════════════════════════════
    for (const vp of [{ name: 'desktop-1440', width: 1440, height: 900 },
                      { name: 'tablet-834', width: 834, height: 1112 },
                      { name: 'mobile-390', width: 390, height: 844 }]) {
      for (const pass of [1, 2]) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await ctx.newPage();
        await page.goto(BASE + '/products', { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
        const rec = { viewport: vp.name, pass };
        rec.scrollRestoration = await page.evaluate(() => history.scrollRestoration);
        await page.evaluate(() => window.scrollTo(0, 1200));
        await page.waitForTimeout(600);
        rec.before = await page.evaluate(() => Math.round(window.scrollY));
        const href = await page.evaluate(() => {
          const a = [...document.querySelectorAll('a[href*="productId="]')]
            .find((e) => e.getBoundingClientRect().width > 0);
          return a ? a.getAttribute('href') : null;
        });
        rec.clicked = href;
        await page.locator('a[href*="productId="]:visible').first().click();
        await page.waitForTimeout(1500);
        rec.afterNav = await page.evaluate(() => Math.round(window.scrollY));
        rec.urlAfterNav = page.url().replace(BASE, '');
        await page.goBack();
        await page.waitForTimeout(2500);              // let the SPA re-render, then settle
        rec.afterBack = await page.evaluate(() => Math.round(window.scrollY));
        rec.urlAfterBack = page.url().replace(BASE, '');
        rec.restoredWithin100 = Math.abs(rec.afterBack - rec.before) <= 100;
        await page.goForward();
        await page.waitForTimeout(2500);
        rec.afterForward = await page.evaluate(() => Math.round(window.scrollY));
        results.backForward.push(rec);
        await ctx.close();
        process.stdout.write('b');
      }
    }

    // ══ 4. sidebar onNavigate vs sticky navbar ═══════════════════════════
    for (const vp of [{ name: 'desktop-1440', width: 1440, height: 900 },
                      { name: 'tablet-834', width: 834, height: 1112 },
                      { name: 'mobile-390', width: 390, height: 844 }]) {
      for (const pass of [1, 2]) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await ctx.newPage();
        await page.goto(BASE + '/products?productId=CC', { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);
        await page.evaluate(() => window.scrollTo(0, 900));
        await page.waitForTimeout(400);
        const rec = { viewport: vp.name, pass, scrollBefore: 900 };
        const links = await page.locator('a[href*="productId="]:visible').count();
        rec.visibleSidebarLinks = links;
        if (links > 1) {
          await page.locator('a[href*="productId="]:visible').nth(1).click();
          await page.waitForTimeout(2200);
          Object.assign(rec, await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            const r = h1 ? h1.getBoundingClientRect() : null;
            const nav = document.querySelector('header');
            const nr = nav ? nav.getBoundingClientRect() : { bottom: 0, height: 0 };
            return {
              scrollAfter: Math.round(window.scrollY),
              navPosition: nav ? getComputedStyle(nav).position : 'absent',
              navBottom: Math.round(nr.bottom),
              h1Text: h1 ? h1.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) : null,
              h1Top: r ? Math.round(r.top) : null,
              h1Bottom: r ? Math.round(r.bottom) : null,
              h1Height: r ? Math.round(r.height) : null,
              coveredPx: r ? Math.max(0, Math.round(Math.min(nr.bottom, r.bottom) - r.top)) : null,
              fullyBelowNav: !!(r && r.top >= nr.bottom),
            };
          }));
          if (pass === 1) {
            await page.screenshot({ path: path.join(SHOTS, `${vp.name}__sidebar-nav-landing.png`),
                                    clip: { x: 0, y: 0, width: vp.width, height: Math.min(320, vp.height) } });
          }
        }
        results.sidebar.push(rec);
        await ctx.close();
        process.stdout.write('n');
      }
    }

    // ══ 5. contact server-error alert focus ══════════════════════════════
    {
      clearLimiter();
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const rec = { attempts: [] };
      for (let i = 0; i < 7; i++) {
        await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
        await page.waitForTimeout(350);
        await page.locator('input[name="name"]:visible').first().fill('Audit Tester');
        await page.locator('input[name="email"]:visible').first().fill('audit@example.com');
        const company = page.locator('input[name="company"]:visible').first();
        if (await company.count()) await company.fill('Audit Co');
        await page.locator('form button[type="submit"]:visible').first().click();
        await page.waitForTimeout(1600);
        const s = await page.evaluate(() => {
          const a = document.activeElement;
          const alert = document.querySelector('[role="alert"]');
          return {
            alertPresent: !!alert,
            alertKind: alert ? alert.getAttribute('data-error-kind') : null,
            alertText: alert ? alert.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : null,
            activeIsAlert: !!(alert && a === alert),
            activeTag: a.tagName.toLowerCase(),
            activeRole: a.getAttribute('role'),
            success: /Received|Thank/i.test(document.body.textContent || ''),
          };
        });
        rec.attempts.push({ n: i + 1, ...s });
        if (s.alertPresent) {
          await page.screenshot({ path: path.join(SHOTS, `contact-server-error.png`) });
          break;
        }
      }
      results.contactAlert = rec;
      await ctx.close();
      clearLimiter();
      process.stdout.write('c');
    }

    // ══ 6. a.ipc-tap — page body vs sticky bar ═══════════════════════════
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + '/products?productId=CC', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      for (const where of ['body', 'sticky']) {
        if (where === 'sticky') { await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(1200); }
        const got = await page.evaluate((w) => {
          const all = [...document.querySelectorAll('a.ipc-tap')];
          const inFixed = (e) => {
            let n = e;
            while (n) { if (getComputedStyle(n).position === 'fixed') return true; n = n.parentElement; }
            return false;
          };
          const el = all.find((e) => (w === 'sticky') === inFixed(e) && e.getBoundingClientRect().width > 0);
          if (!el) return null;
          el.setAttribute('data-t', '1');
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return { text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
                   rect: { x: r.x, y: r.y, w: r.width, h: r.height },
                   base: { backgroundColor: cs.backgroundColor, color: cs.color, filter: cs.filter,
                           textDecorationLine: cs.textDecorationLine, borderTopColor: cs.borderTopColor } };
        }, where);
        if (!got) { results.ipcTap.push({ where, error: 'not found' }); continue; }
        await page.mouse.move(2, 2); await page.waitForTimeout(300);
        await page.mouse.move(got.rect.x + got.rect.w / 2, got.rect.y + got.rect.h / 2);
        await page.waitForTimeout(450);
        const hov = await page.evaluate(() => {
          const el = document.querySelector('[data-t]');
          const cs = getComputedStyle(el);
          return { backgroundColor: cs.backgroundColor, color: cs.color, filter: cs.filter,
                   textDecorationLine: cs.textDecorationLine, borderTopColor: cs.borderTopColor };
        });
        const delta = Object.keys(got.base).filter((k) => got.base[k] !== hov[k])
          .map((k) => `${k}: ${got.base[k]} -> ${hov[k]}`);
        results.ipcTap.push({ where, text: got.text, delta });
        await page.evaluate(() => { const e = document.querySelector('[data-t]'); if (e) e.removeAttribute('data-t'); });
      }
      await ctx.close();
      process.stdout.write('t');
    }
  } finally { await browser.close(); }

  fs.writeFileSync(path.join(OUT, 'verify2.json'), JSON.stringify(results, null, 1));

  console.log('\n\n══ 1. FAQ accordion (aria-controls^="faq-panel") ══');
  for (const [mode, r] of Object.entries(results.faq)) {
    console.log(`\n  reduced-motion: ${mode} — ${r.triggers} FAQ triggers, first reached at Tab x${r.tabsToFirstFaqTrigger}`);
    console.log(`    closed:      ${JSON.stringify(r.closed)}`);
    console.log(`    open t+120:  ${JSON.stringify(r.openT120)}`);
    console.log(`    open settled:${JSON.stringify(r.openSettled)}`);
    console.log(`    close t+120: ${JSON.stringify(r.closeT120)}`);
    console.log(`    close settle:${JSON.stringify(r.closeSettled)}`);
    console.log(`    Enter toggles open: ${r.enterToggles} · Space toggles closed: ${r.spaceToggles} · collapsed leaves tree: ${r.collapsedLeavesTree}`);
  }

  console.log('\n══ 2. drawer scroll anchoring (real wheel, focus without scrolling, real Enter) ══');
  for (const r of results.drawerAnchor) {
    console.log(`  ${r.viewport} pass${r.pass}: wheel->${r.afterWheel} beforeEnter=${r.beforeEnter} lockedAt=${r.lockedAt} afterClose=${r.afterClose} shift=${r.shiftFromBeforeEnter}px lockMatchesBeforeEnter=${r.lockMatchesBeforeEnter}`);
  }

  console.log('\n══ 3. back/forward scroll restoration ══');
  for (const r of results.backForward) {
    console.log(`  ${r.viewport} pass${r.pass}: history.scrollRestoration=${r.scrollRestoration} before=${r.before} -> ${r.urlAfterNav} (y=${r.afterNav}) -> BACK ${r.urlAfterBack} (y=${r.afterBack}) ${r.restoredWithin100 ? 'restored' : 'NOT RESTORED'} -> FWD y=${r.afterForward}`);
  }

  console.log('\n══ 4. sidebar onNavigate landing vs sticky navbar ══');
  for (const r of results.sidebar) {
    console.log(`  ${r.viewport} pass${r.pass}: scroll ${r.scrollBefore}->${r.scrollAfter} · nav ${r.navPosition} bottom=${r.navBottom} · h1 "${r.h1Text}" top=${r.h1Top} h=${r.h1Height} · covered=${r.coveredPx}px · fullyBelowNav=${r.fullyBelowNav}`);
  }

  console.log('\n══ 5. contact server-error alert focus ══');
  for (const a of results.contactAlert.attempts) {
    console.log(`  attempt ${a.n}: success=${a.success} alert=${a.alertPresent} kind=${a.alertKind} activeIsAlert=${a.activeIsAlert} active=<${a.activeTag}> ${a.alertText ? JSON.stringify(a.alertText) : ''}`);
  }

  console.log('\n══ 6. a.ipc-tap hover — same signature, two components ══');
  for (const r of results.ipcTap) console.log(`  ${r.where}: ${JSON.stringify(r)}`);

  console.log(`\nrecord -> ${path.join(OUT, 'verify2.json')}`);
})();
