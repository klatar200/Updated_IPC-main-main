/**
 * PLAN-8 B24 — touch-target size on a coarse pointer.
 *
 * Measured by the audit at 390px:
 *   Product "Download PDF"        140x28
 *   Product "Request Quote"       125x28
 *   inline tel:/mailto: links        x14-19
 *   dashboard approval chips         x25
 *   FAQ category chips               x30
 *   footer social icons, hero CTAs 40x40
 *
 * The two 28px ones are the primary actions on the most important page, and
 * the tel:/mailto: links are the other conversion path — those are the ones
 * this fixes to 44. WCAG 2.5.5 (AAA) asks 44x44; 2.5.8 (AA) asks 24x24, and
 * everything on the site clears 24 already, so the 40px items are reported
 * rather than forced.
 *
 * The context sets hasTouch, because `@media (pointer: coarse)` is what the
 * fix keys on and a desktop-pointer context would measure the unfixed rule.
 *
 * B13 is asserted here as of Phase F. B26 (form-first ordering) is still
 * logged open in WHATS_LEFT §2b and is NOT asserted — a suite that silently
 * covers two of three named items reads like it covers all three.
 *
 * B13 is driven with real clicks and real Escape presses. A drawer whose
 * close-on-Escape is wired to a handler that never receives the key looks
 * identical, from the source, to one that works.
 *
 * Usage: node _harness/plan8-mobile.js        (needs :8123)
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-mobile');

/** The routes the acceptance names, plus the two catalog views. */
const ROUTES = ['/contact', '/about', '/products?productId=IP33PO', '/faq', '/dashboard'];

const AA_MIN = 24;   // WCAG 2.5.8, Level AA
const TARGET = 44;   // WCAG 2.5.5, and what the conversion paths are held to

/** Elements whose size is governed by the CONVERSION paths this item is about. */
const CRITICAL = /^(a\[href\^="tel:"\]|a\[href\^="mailto:"\])$/;

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const measure = () => {
  const out = [];
  const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;                       // not rendered
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    // The skip link is off-screen by design until focused; it is not a touch
    // target on a phone at all.
    if (el.classList && el.classList.contains('ipc-skip')) continue;
    const href = el.getAttribute && el.getAttribute('href');
    out.push({
      tag: el.tagName.toLowerCase(),
      w: Math.round(r.width),
      h: Math.round(r.height),
      tel: !!(href && /^tel:/.test(href)),
      mail: !!(href && /^mailto:/.test(href)),
      text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 36),
    });
  }
  return out;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const rec = {};

  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 3,
    });
    const page = await ctx.newPage();
    // Confirm the emulation actually produced a coarse pointer — otherwise
    // every assertion below measures the desktop rule and passes for the
    // wrong reason.
    await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
    rec.coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);

    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      rec[route] = await page.evaluate(measure);
      await page.screenshot({
        path: path.join(OUT, `${route.replace(/[^a-z0-9]+/gi, '_')}.png`),
        fullPage: false,
      });
    }
    // ── B13 — the mobile drawer ───────────────────────────────────────────
    {
      const dctx = await browser.newContext({
        viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
      });
      const p = await dctx.newPage();
      await p.goto(BASE + '/products?productId=IP33PO', { waitUntil: 'networkidle' });

      // Scroll down first: the lock must preserve position, not jump to top.
      await p.evaluate(() => window.scrollTo(0, 600));
      await p.waitForTimeout(200);
      const beforeY = await p.evaluate(() => window.scrollY);

      const burger = p.locator('button[aria-label="Open menu"]');
      await burger.click();
      await p.waitForTimeout(350);

      // The offset the LOCK captured, read off the negative top it parks on
      // <body>. Not the offset measured before the click: Playwright scrolls a
      // control into view before clicking it, so the page had already moved
      // from 600 to 876 by the time the drawer opened. Comparing the restore
      // against the pre-click value reported a 600 -> 876 regression for a
      // restore that is exactly right, and cost three wrong fixes before the
      // sequence was actually traced. What matters is that you get back the
      // offset you were at WHEN IT OPENED.
      rec.lockedAt = await p.evaluate(() => {
        const t = document.body.style.top;
        return t ? Math.abs(parseInt(t, 10)) : null;
      });

      rec.drawerOpen = await p.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        const scrim = [...document.querySelectorAll('div')].find((d) => {
          const cs = getComputedStyle(d);
          const r = d.getBoundingClientRect();
          return cs.position === 'fixed' && /rgba\(0, 0, 0/.test(cs.backgroundColor) &&
                 r.width >= window.innerWidth - 1 && r.height > window.innerHeight * 0.6;
        });
        return {
          dialog: !!dlg,
          scrim: !!scrim,
          bodyOverflow: getComputedStyle(document.body).overflow,
          docOverflow: getComputedStyle(document.documentElement).overflow,
        };
      });

      // Focus must be inside the drawer, and Tab must not escape it.
      rec.drawerFocus = await p.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        return { insideAtOpen: !!(dlg && dlg.contains(document.activeElement)) };
      });
      const seen = [];
      for (let i = 0; i < 14; i++) {
        await p.keyboard.press('Tab');
        seen.push(await p.evaluate(() => {
          const dlg = document.querySelector('[role="dialog"]');
          const a = document.activeElement;
          return dlg && a ? dlg.contains(a) : false;
        }));
      }
      rec.drawerTrapped = seen.every(Boolean);
      rec.drawerTabSamples = seen.filter(Boolean).length + '/' + seen.length;

      // Escape closes, and focus comes back to the control that opened it.
      await p.keyboard.press('Escape');
      await p.waitForTimeout(350);
      rec.afterEscape = await p.evaluate(() => ({
        open: !!document.querySelector('[role="dialog"]'),
        activeLabel: document.activeElement ? document.activeElement.getAttribute('aria-label') : null,
        bodyOverflow: getComputedStyle(document.body).overflow,
        scrollY: Math.round(window.scrollY),
      }));
      rec.scrollBefore = beforeY;

      // The scroll-lock check runs SECOND, on its own open/close cycle.
      //
      // It has to, because a programmatic scrollTo while <body> is
      // position:fixed does nothing at the time and then lands once the
      // document expands on close — which corrupted the restore measurement
      // above and reported 600 -> 876 for a restore that works. A real finger
      // on a fixed body queues nothing, so that was an artifact of the probe,
      // not a defect. Measuring the two separately is the honest way to have
      // both.
      await burger.click();
      await p.waitForTimeout(350);
      rec.openY = await p.evaluate(() => window.scrollY);
      await p.evaluate(() => window.scrollTo(0, 1400));
      await p.waitForTimeout(200);
      rec.drawerScrolled = await p.evaluate(() => window.scrollY);
      await p.keyboard.press('Escape');
      await p.waitForTimeout(300);

      await p.screenshot({ path: path.join(OUT, 'drawer-closed.png') });
      await dctx.close();
    }

    await ctx.close();

    // ── the desktop must be untouched ─────────────────────────────────────
    // The acceptance is "desktop layout unchanged". The rules are inside
    // @media (pointer: coarse) so that should follow by construction — but
    // "should follow by construction" is how the spinner's reduced-motion
    // override came to be dead code, so it is measured.
    const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: false });
    const dpage = await dctx.newPage();
    await dpage.goto(BASE + '/products?productId=IP33PO', { waitUntil: 'networkidle' });
    rec.desktopCoarse = await dpage.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
    rec.desktopCtas = await dpage.evaluate(() =>
      [...document.querySelectorAll('.ipc-touch')].map((el) => {
        const r = el.getBoundingClientRect();
        return { h: Math.round(r.height), text: (el.textContent || '').trim().slice(0, 20) };
      })
    );
    await dctx.close();
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'mobile.json'), JSON.stringify(rec, null, 2));

  note(rec.coarse === true,
    'the emulated context really is a coarse pointer — otherwise this measures the desktop rule');

  const all = ROUTES.flatMap((r) => rec[r].map((e) => ({ ...e, route: r })));

  // ── the conversion paths: 44x44 ───────────────────────────────────────────
  const conv = all.filter((e) => e.tel || e.mail);
  const convSmall = conv.filter((e) => e.h < TARGET || e.w < TARGET);
  note(convSmall.length === 0,
    `all ${conv.length} tel:/mailto: links are at least ${TARGET}x${TARGET}`,
    convSmall.map((e) => `${e.route} ${e.w}x${e.h} ${JSON.stringify(e.text)}`).join('\n         '));

  const productCtas = (rec['/products?productId=IP33PO'] || []).filter((e) =>
    /Download PDF|Request Quote|Request Data Sheet/i.test(e.text));
  const ctaSmall = productCtas.filter((e) => e.h < TARGET);
  note(productCtas.length > 0 && ctaSmall.length === 0,
    `the product page's primary actions are at least ${TARGET}px tall ` +
    `(${productCtas.map((e) => `${e.text.slice(0, 14)} ${e.w}x${e.h}`).join(', ')})`,
    ctaSmall.map((e) => `${e.w}x${e.h} ${JSON.stringify(e.text)}`).join('\n         '));

  // ── the AA floor everywhere ───────────────────────────────────────────────
  const tiny = all.filter((e) => e.h < AA_MIN || e.w < AA_MIN);
  note(tiny.length === 0,
    `nothing interactive is below ${AA_MIN}x${AA_MIN} on any of the ${ROUTES.length} routes (WCAG 2.5.8)`,
    tiny.slice(0, 10).map((e) => `${e.route} ${e.w}x${e.h} <${e.tag}> ${JSON.stringify(e.text)}`).join('\n         '));

  // ── B13 ───────────────────────────────────────────────────────────────────
  const d = rec.drawerOpen || {};
  note(d.dialog === true, 'the drawer opens on a real tap of the hamburger');
  note(d.scrim === true,
    'a scrim covers the viewport behind the open drawer',
    JSON.stringify(d));
  note(d.bodyOverflow === 'hidden' || d.docOverflow === 'hidden',
    `the page behind is locked while the drawer is open ` +
    `(body overflow=${d.bodyOverflow}, html overflow=${d.docOverflow})`);
  note(rec.drawerScrolled === rec.openY,
    `the page behind did not move while the drawer was open ` +
    `(offset ${rec.openY} before scrollTo(0,1400), ${rec.drawerScrolled} after)`);
  note(rec.drawerFocus && rec.drawerFocus.insideAtOpen,
    'focus moves into the drawer when it opens');
  note(rec.drawerTrapped === true,
    `focus stays inside the drawer across 14 Tab presses (${rec.drawerTabSamples} inside)`);
  const esc = rec.afterEscape || {};
  note(esc.open === false, 'Escape closes the drawer');
  note(esc.activeLabel === 'Open menu',
    `Escape returns focus to the hamburger (activeElement aria-label=${JSON.stringify(esc.activeLabel)})`);
  note(esc.bodyOverflow !== 'hidden',
    `the scroll lock is released on close (body overflow=${esc.bodyOverflow})`);
  note(rec.lockedAt !== null && esc.scrollY === rec.lockedAt,
    `the scroll position survives open/close — locked at ${rec.lockedAt}, restored to ${esc.scrollY}. ` +
    `Locking with overflow:hidden alone discards this and jumps the page to the top`);

  // ── desktop unchanged ─────────────────────────────────────────────────────
  note(rec.desktopCoarse === false,
    'a 1440 mouse context is NOT a coarse pointer, so the rules above cannot reach it');
  const grown = (rec.desktopCtas || []).filter((e) => e.h >= 44);
  note((rec.desktopCtas || []).length > 0 && grown.length === 0,
    `the product CTAs keep their desktop height ` +
    `(${(rec.desktopCtas || []).map((e) => `${e.text.slice(0, 12)} ${e.h}px`).join(', ')})`,
    grown.map((e) => `${e.text} grew to ${e.h}px`).join(', '));

  // ── reported, not enforced ────────────────────────────────────────────────
  const between = all.filter((e) => (e.h >= AA_MIN && e.h < TARGET) || (e.w >= AA_MIN && e.w < TARGET));
  const shapes = [...new Set(between.map((e) => `${e.w}x${e.h} <${e.tag}> ${e.text.slice(0, 22)}`))];
  console.log(`\n     ${between.length} controls sit between ${AA_MIN} and ${TARGET} — above the AA floor,`);
  console.log(`     below the AAA target. Reported rather than forced, per the acceptance:`);
  for (const s of shapes.slice(0, 12)) console.log(`       ${s}`);
  if (shapes.length > 12) console.log(`       … ${shapes.length - 12} more shapes`);

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan8-mobile ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'mobile.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
