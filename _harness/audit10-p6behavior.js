/**
 * AUDIT-10 pass-6 steps 6.5 (motion), 6.6 (scroll/anchors) and 6.7 (forms).
 *
 * 6.5  Motion is read from document.getAnimations(), not from the stylesheet.
 *      A transition that is declared and never fires, and a transition that
 *      fires once on first paint, are both invisible to a CSS grep and both
 *      are what step 6.5(c) asks for. Each page is sampled at 0.15s, 1s, 3s
 *      and 10s: anything still running at 10s on an idle page is churn.
 *      Every measurement is repeated with reducedMotion: 'reduce'.
 *
 * 6.6  Anchor landings are scored against the STICKY NAVBAR, because "the
 *      fragment scrolled" and "the visitor can see the heading" are different
 *      claims — the navbar is position:sticky and 64-72px tall, so a target
 *      that lands at y=10 is behind it. The anchor ids are read from the live
 *      page (industryAnchor() derives them from owner data; hardcoding them
 *      here would fossilise the catalog).
 *
 * 6.7  The contact form's error timing (blur vs submit), the documented
 *      focus-moves-to-the-alert behaviour, and the honeypot's two separate
 *      requirements: invisible to eyes AND absent from the tab order.
 *
 * Output: _harness/out/audit10/p6/behavior.json
 * Usage:  node _harness/audit10-p6behavior.js       (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10', 'p6');
const SHOTS = path.join(OUT, 'behavior');

const VPS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-834', width: 834, height: 1112 },
  { name: 'mobile-390', width: 390, height: 844 },
];
const MOTION_ROUTES = ['/', '/products', '/faq', '/contact', '/industries',
                       '/dashboard', '/products?productId=CC'];

const ANIMS = `
window.__an = () => {
  const list = document.getAnimations ? document.getAnimations() : [];
  const out = [];
  for (const a of list) {
    const t = a.effect && a.effect.target;
    const timing = a.effect ? a.effect.getTiming() : {};
    out.push({
      type: a.constructor.name,
      name: a.animationName || a.transitionProperty || null,
      state: a.playState,
      iterations: timing.iterations === Infinity ? 'infinite' : timing.iterations,
      duration: timing.duration,
      target: t ? (t.tagName ? t.tagName.toLowerCase() : String(t)) +
        (t.className && typeof t.className === 'string' ? '.' + t.className.trim().split(/\\s+/).slice(0, 3).join('.') : '') : null,
      text: t && t.textContent ? t.textContent.replace(/\\s+/g, ' ').trim().slice(0, 34) : null,
    });
  }
  return out;
};
window.__nav = () => {
  const n = document.querySelector('header');
  if (!n) return { h: 0, pos: 'absent' };
  const r = n.getBoundingClientRect();
  return { h: Math.round(r.height), bottom: Math.round(r.bottom), pos: getComputedStyle(n).position };
};
`;

const results = { motion: {}, anchors: {}, scrollRestore: {}, sidebar: {}, contact: {} };

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await launch();
  try {
    // ══ 6.5 motion, default and reduce ═══════════════════════════════════
    for (const mode of ['no-preference', 'reduce']) {
      results.motion[mode] = {};
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: mode });
      const page = await ctx.newPage();
      for (const route of MOTION_ROUTES) {
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.addScriptTag({ content: ANIMS });
        const samples = {};
        for (const [label, waitMs] of [['t0.15', 150], ['t1', 850], ['t3', 2000], ['t10', 7000]]) {
          await page.waitForTimeout(waitMs);
          // Re-inject after any React remount wiped the helper.
          const has = await page.evaluate(() => typeof window.__an === 'function');
          if (!has) await page.addScriptTag({ content: ANIMS });
          samples[label] = await page.evaluate(() => window.__an());
        }
        results.motion[mode][route] = samples;
        process.stdout.write('.');
      }
      await ctx.close();
    }

    // ══ 6.5 the three named interactions, at 1440 ════════════════════════
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      // FAQ collapse: open then close, and confirm the panel leaves the tree.
      await page.goto(BASE + '/faq', { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: ANIMS });
      const faqBtn = page.locator('button[aria-expanded]').first();
      await faqBtn.click();
      await page.waitForTimeout(600);
      const faqOpen = await page.evaluate(() => {
        const b = document.querySelector('button[aria-expanded]');
        const p = document.getElementById(b.getAttribute('aria-controls'));
        return { expanded: b.getAttribute('aria-expanded'),
                 panelDisplay: p ? getComputedStyle(p).display : 'absent',
                 panelHeight: p ? Math.round(p.getBoundingClientRect().height) : 0,
                 findable: !!(p && p.textContent.trim().length) };
      });
      await faqBtn.click();
      await page.waitForTimeout(900);
      const faqClosed = await page.evaluate(() => {
        const b = document.querySelector('button[aria-expanded]');
        const p = document.getElementById(b.getAttribute('aria-controls'));
        return { expanded: b.getAttribute('aria-expanded'),
                 panelDisplay: p ? getComputedStyle(p).display : 'absent',
                 panelHeight: p ? Math.round(p.getBoundingClientRect().height) : 0,
                 stillAnimating: window.__an ? window.__an().length : null };
      });
      // Enter/Space on the FAQ trigger, by real key.
      await page.goto(BASE + '/faq', { waitUntil: 'networkidle' });
      await page.evaluate(() => { document.body.focus();
        document.documentElement.setAttribute('tabindex', '-1'); document.documentElement.focus(); });
      let n = 0, on = false;
      for (; n < 40; n++) {
        await page.keyboard.press('Tab');
        on = await page.evaluate(() => document.activeElement.hasAttribute('aria-expanded'));
        if (on) break;
      }
      const faqKeys = { tabsToFirstTrigger: on ? n + 1 : null };
      if (on) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        faqKeys.afterEnter = await page.evaluate(() => document.activeElement.getAttribute('aria-expanded'));
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        await page.keyboard.press(' ');
        await page.waitForTimeout(500);
        faqKeys.afterSpace = await page.evaluate(() => document.activeElement.getAttribute('aria-expanded'));
      }
      results.motion.faq = { faqOpen, faqClosed, faqKeys };

      // Sticky RFQ bar: does it settle, and does it stop animating?
      await page.goto(BASE + '/products?productId=CC', { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: ANIMS });
      const stickySamples = [];
      for (const w of [200, 800, 2000, 5000]) {
        await page.waitForTimeout(w);
        stickySamples.push(await page.evaluate(() => {
          const bar = [...document.querySelectorAll('div')].find((d) => {
            const cs = getComputedStyle(d);
            return cs.position === 'fixed' && d.getBoundingClientRect().height > 40
              && /quote|rfq/i.test(d.textContent || '');
          });
          return { present: !!bar,
                   top: bar ? Math.round(bar.getBoundingClientRect().top) : null,
                   transform: bar ? getComputedStyle(bar).transform : null,
                   bodyPadding: getComputedStyle(document.body).paddingBottom,
                   running: (document.getAnimations ? document.getAnimations() : []).length };
        }));
      }
      results.motion.stickyRfq = stickySamples;
      await ctx.close();
    }

    // ══ 6.6 anchors + scroll restore + sidebar, at all three viewports ═══
    for (const vp of VPS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.addInitScript(ANIMS);

      // Discover the industry anchor ids from the rendered page.
      await page.goto(BASE + '/industries', { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: ANIMS });
      const ids = await page.evaluate(() =>
        [...document.querySelectorAll('[id]')].map((e) => e.id)
          .filter((id) => id && !/^(root|ipc-main)$/.test(id)));
      const anchorIds = ids.filter((id) => !/^faq-/.test(id)).slice(0, 8);

      const list = [];
      for (const id of anchorIds) {
        await page.goto(`${BASE}/industries#${id}`, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(1400);          // smooth scroll needs to finish
        await page.addScriptTag({ content: ANIMS });
        list.push(await page.evaluate((anchor) => {
          const el = document.getElementById(anchor);
          const r = el.getBoundingClientRect();
          const nav = document.querySelector('header');
          const nr = nav ? nav.getBoundingClientRect() : { bottom: 0, height: 0 };
          const navSticky = nav ? getComputedStyle(nav).position : 'absent';
          return { id: anchor, top: Math.round(r.top), navBottom: Math.round(nr.bottom),
                   navPosition: navSticky, scrollY: Math.round(window.scrollY),
                   clearsNav: r.top >= nr.bottom - 1,
                   coveredPx: Math.max(0, Math.round(nr.bottom - r.top)),
                   scrollMarginTop: getComputedStyle(el).scrollMarginTop };
        }, id));
      }
      results.anchors[vp.name] = list;

      // FAQ category anchors
      await page.goto(BASE + '/faq', { waitUntil: 'networkidle' });
      const faqIds = await page.evaluate(() =>
        [...document.querySelectorAll('[id^="faq-cat-"]')].map((e) => e.id).slice(0, 4));
      const faqList = [];
      for (const id of faqIds) {
        await page.goto(`${BASE}/faq#${id}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1400);
        faqList.push(await page.evaluate((anchor) => {
          const el = document.getElementById(anchor);
          const r = el.getBoundingClientRect();
          const nav = document.querySelector('header');
          const nr = nav ? nav.getBoundingClientRect() : { bottom: 0 };
          return { id: anchor, top: Math.round(r.top), navBottom: Math.round(nr.bottom),
                   clearsNav: r.top >= nr.bottom - 1,
                   coveredPx: Math.max(0, Math.round(nr.bottom - r.top)),
                   scrollMarginTop: getComputedStyle(el).scrollMarginTop };
        }, id));
      }
      results.anchors[vp.name + ' (faq)'] = faqList;

      // Back/forward scroll restoration
      await page.goto(BASE + '/products', { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, 1200));
      await page.waitForTimeout(400);
      const y0 = await page.evaluate(() => Math.round(window.scrollY));
      // :visible — the first matching link on /products lives in the collapsed
      // mega-menu panel, which is in the DOM and not clickable. Without the
      // filter this probe times out on an element no visitor can reach.
      await page.locator('a[href*="productId="]:visible').first().click();
      await page.waitForTimeout(900);
      const yAfterNav = await page.evaluate(() => Math.round(window.scrollY));
      await page.goBack();
      await page.waitForTimeout(1200);
      const yBack = await page.evaluate(() => Math.round(window.scrollY));
      await page.goForward();
      await page.waitForTimeout(1200);
      const yFwd = await page.evaluate(() => Math.round(window.scrollY));
      results.scrollRestore[vp.name] = { beforeNav: y0, afterNav: yAfterNav, afterBack: yBack, afterForward: yFwd,
        restoredWithin100: Math.abs(yBack - y0) <= 100 };

      // Sidebar onNavigate scrollIntoView (product pages)
      await page.goto(BASE + '/products?productId=CC', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const side = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a[href*="productId="]')]
          .filter((e) => e.getBoundingClientRect().width > 0);
        return { count: links.length };
      });
      if (side.count > 1) {
        await page.evaluate(() => window.scrollTo(0, 900));
        await page.waitForTimeout(300);
        const before = await page.evaluate(() => Math.round(window.scrollY));
        await page.locator('a[href*="productId="]:visible').nth(1).click();
        await page.waitForTimeout(1400);
        results.sidebar[vp.name] = await page.evaluate((b) => {
          const h1 = document.querySelector('h1');
          const r = h1 ? h1.getBoundingClientRect() : null;
          const nav = document.querySelector('header');
          const nr = nav ? nav.getBoundingClientRect() : { bottom: 0 };
          return { scrollBefore: b, scrollAfter: Math.round(window.scrollY),
                   h1Top: r ? Math.round(r.top) : null, navBottom: Math.round(nr.bottom),
                   h1Visible: !!(r && r.top >= 0 && r.top < window.innerHeight),
                   h1BehindNav: !!(r && r.top < nr.bottom) };
        }, before);
      }
      await ctx.close();
      process.stdout.write('s');
    }

    // ══ 6.7 contact form ═════════════════════════════════════════════════
    for (const vp of VPS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const rec = { viewport: vp.name };

      // honeypot: invisible AND unfocusable
      rec.honeypot = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('input[name="website"]')) {
          const r = el.getBoundingClientRect();
          const wrap = el.closest('[aria-hidden]');
          out.push({ id: el.id, tabindex: el.getAttribute('tabindex'),
            autocomplete: el.getAttribute('autocomplete'),
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            onScreen: r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight,
            ariaHiddenWrapper: wrap ? wrap.getAttribute('aria-hidden') : null,
            visible: typeof el.checkVisibility === 'function' ? el.checkVisibility({ checkVisibilityCSS: true }) : null });
        }
        return out;
      });
      // ...and confirm no Tab press ever lands on it
      await page.evaluate(() => { document.body.focus();
        document.documentElement.setAttribute('tabindex', '-1'); document.documentElement.focus(); });
      let hitHoney = false;
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        const h = await page.evaluate(() => document.activeElement.getAttribute('name') === 'website');
        if (h) { hitHoney = true; break; }
      }
      rec.honeypotReachedByTab = hitHoney;

      // error timing: blur an empty required field, then submit empty
      await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      const first = page.locator('input[name="name"]:visible').first();
      await first.click();
      await first.fill('x');
      await first.fill('');
      await page.locator('input[name="email"]:visible').first().click();
      await page.waitForTimeout(500);
      rec.onBlur = await page.evaluate(() => ({
        alerts: [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent.trim().slice(0, 70)),
        inlineErrors: [...document.querySelectorAll('[aria-invalid="true"]')].length,
      }));

      await page.locator('form button[type="submit"]:visible').first().click();
      await page.waitForTimeout(900);
      rec.onSubmit = await page.evaluate(() => {
        const a = document.activeElement;
        return {
          alerts: [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent.trim().slice(0, 70)),
          inlineErrors: [...document.querySelectorAll('[aria-invalid="true"]')].length,
          activeTag: a.tagName.toLowerCase(),
          activeRole: a.getAttribute('role'),
          activeName: a.getAttribute('name'),
          focusMovedToAlert: a.getAttribute('role') === 'alert',
          nativeValidationShown: !!document.querySelector('input:invalid'),
        };
      });
      await page.screenshot({ path: path.join(SHOTS, `${vp.name}__contact-submit-empty.png`), fullPage: false });
      results.contact[vp.name] = rec;
      await ctx.close();
      process.stdout.write('c');
    }
  } finally { await browser.close(); }

  fs.writeFileSync(path.join(OUT, 'behavior.json'), JSON.stringify(results, null, 1));

  // ── console ─────────────────────────────────────────────────────────────
  console.log('\n\n══ 6.5 motion — animations still running on an idle page ══');
  for (const mode of ['no-preference', 'reduce']) {
    console.log(`\n── prefers-reduced-motion: ${mode}`);
    for (const [route, s] of Object.entries(results.motion[mode])) {
      const at10 = s.t10 || [];
      const inf = at10.filter((a) => a.iterations === 'infinite');
      console.log(`  ${route.padEnd(28)} t0.15=${String(s['t0.15'].length).padStart(3)} t1=${String(s.t1.length).padStart(3)} t3=${String(s.t3.length).padStart(3)} t10=${String(at10.length).padStart(3)}  infinite@10s=${inf.length}${inf.length ? '  ' + inf.map((a) => a.name + ' on ' + a.target).join(', ') : ''}`);
    }
  }
  console.log(`\nFAQ open:  ${JSON.stringify(results.motion.faq.faqOpen)}`);
  console.log(`FAQ close: ${JSON.stringify(results.motion.faq.faqClosed)}`);
  console.log(`FAQ keys:  ${JSON.stringify(results.motion.faq.faqKeys)}`);
  console.log(`sticky RFQ: ${JSON.stringify(results.motion.stickyRfq)}`);

  console.log('\n══ 6.6 anchor landings vs the sticky navbar ══');
  for (const [k, list] of Object.entries(results.anchors)) {
    console.log(`\n── ${k}`);
    for (const a of list) {
      console.log(`  ${a.id.padEnd(30)} top=${String(a.top).padStart(5)} navBottom=${String(a.navBottom).padStart(4)} scrollMarginTop=${String(a.scrollMarginTop).padStart(6)} ${a.clearsNav ? 'clears' : `COVERED BY ${a.coveredPx}px`}`);
    }
  }
  console.log('\n══ 6.6 back/forward scroll restoration ══');
  for (const [vp, r] of Object.entries(results.scrollRestore)) {
    console.log(`  ${vp.padEnd(14)} ${JSON.stringify(r)}`);
  }
  console.log('\n══ 6.6 sidebar onNavigate ══');
  for (const [vp, r] of Object.entries(results.sidebar)) console.log(`  ${vp.padEnd(14)} ${JSON.stringify(r)}`);

  console.log('\n══ 6.7 contact form ══');
  for (const [vp, r] of Object.entries(results.contact)) {
    console.log(`\n── ${vp}`);
    console.log(`  honeypot: ${JSON.stringify(r.honeypot)}`);
    console.log(`  honeypot reached by Tab: ${r.honeypotReachedByTab}`);
    console.log(`  after BLUR of an emptied required field: ${JSON.stringify(r.onBlur)}`);
    console.log(`  after SUBMIT of an empty form:           ${JSON.stringify(r.onSubmit)}`);
  }
  console.log(`\nrecord -> ${path.join(OUT, 'behavior.json')}`);
})();
