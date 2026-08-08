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
 * B13 (drawer scrim/lock/Escape) and B26 (form-first ordering) were named for
 * this file in PLAN-8 §4. Both belong to work that has not run — B13 is
 * Phase F, B26 is logged open in WHATS_LEFT §2b — so they are NOT asserted
 * here. A suite that silently covers two of three named items reads like it
 * covers all three.
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
