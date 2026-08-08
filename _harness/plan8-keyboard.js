/**
 * PLAN-8 B15 and B28 — bypass blocks, and heading structure.
 *
 * B15. Tab order on every page started at the logo and walked the entire
 * header — both mega-menus included — before reaching any content, and
 * `document.querySelector('a[href^="#"]')` returned null site-wide. WCAG 2.4.1
 * Bypass Blocks, Level A.
 *
 * Driven with REAL key presses, never `element.focus()`. Chromium does not
 * match `:focus-visible` for programmatic focus, so a skip link whose visible
 * state depends on `:focus` styling can be asserted present by a script and
 * still be invisible to the person it exists for. The whole point of this item
 * is what happens when a human presses Tab, so the test presses Tab.
 *
 * The second half matters as much as the first: activating the link must MOVE
 * FOCUS into <main>, not merely scroll to it. Without tabIndex={-1} on the
 * target the browser scrolls and leaves focus on the link, so the next Tab
 * goes straight back into the navigation the visitor just asked to skip —
 * a skip link that looks implemented and does nothing.
 *
 * B28. /services went h1 -> h3 with no h2; every other page was well-formed.
 * Checked on all ten routes rather than the one the audit named.
 *
 * Usage: node _harness/plan8-keyboard.js      (needs :8123)
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-keyboard');
const ROUTES = ['/', '/products', '/dashboard', '/datasheets', '/industries',
                '/services', '/about', '/faq', '/contact', '/privacy'];

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const describeActive = () => {
  const a = document.activeElement;
  if (!a) return null;
  const r = a.getBoundingClientRect();
  return {
    tag: a.tagName.toLowerCase(),
    id: a.id || null,
    cls: (typeof a.className === 'string' ? a.className : '').slice(0, 40),
    text: (a.textContent || '').trim().slice(0, 40),
    href: a.getAttribute ? a.getAttribute('href') : null,
    // On-screen means inside the viewport, not merely "has a box".
    onScreen: r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= -1 &&
              r.left < window.innerWidth && r.top < window.innerHeight,
    left: Math.round(r.left),
    outline: getComputedStyle(a).outlineWidth,
  };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const rec = { skip: {}, headings: {} };

  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // ── B15, on every route ───────────────────────────────────────────────
    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      // Start from the document, not from whatever the last action focused.
      await page.evaluate(() => document.body.focus());

      const before = await page.evaluate(() => {
        const el = document.querySelector('.ipc-skip');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), onScreen: r.left >= 0 };
      });

      await page.keyboard.press('Tab');
      const first = await page.evaluate(describeActive);

      await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
      const afterEnter = await page.evaluate(describeActive);

      rec.skip[route] = { before, first, afterEnter };
    }

    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.body.focus());
    await page.keyboard.press('Tab');
    await page.screenshot({ path: path.join(OUT, 'skip-focused.png'), clip: { x: 0, y: 0, width: 700, height: 160 } });

    // ── B28, on every route ───────────────────────────────────────────────
    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      rec.headings[route] = await page.evaluate(() =>
        [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
          .filter((h) => h.getClientRects().length)
          .map((h) => ({ level: Number(h.tagName[1]), text: h.textContent.trim().slice(0, 34) }))
      );
    }

    await ctx.close();
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'keyboard.json'), JSON.stringify(rec, null, 2));

  // ── B15 ───────────────────────────────────────────────────────────────────
  const missing = ROUTES.filter((r) => !rec.skip[r].before);
  note(missing.length === 0, `a skip link exists on all ${ROUTES.length} routes`, missing.join(', '));

  const hidden = ROUTES.filter((r) => rec.skip[r].before && rec.skip[r].before.onScreen);
  note(hidden.length === 0,
    'the skip link is off-screen until focused, on every route',
    hidden.map((r) => `${r}: left=${rec.skip[r].before.left}`).join(', '));

  const notFirst = ROUTES.filter((r) => {
    const f = rec.skip[r].first;
    return !f || f.href !== '#ipc-main';
  });
  note(notFirst.length === 0,
    'the FIRST Tab press lands on the skip link, on every route',
    notFirst.map((r) => `${r}: ${JSON.stringify(rec.skip[r].first)}`).join('\n         '));

  const notVisible = ROUTES.filter((r) => rec.skip[r].first && !rec.skip[r].first.onScreen);
  note(notVisible.length === 0,
    'once focused it is on-screen — measured after a real Tab, not element.focus()',
    notVisible.map((r) => `${r}: left=${rec.skip[r].first.left}`).join(', '));

  const noRing = ROUTES.filter((r) => {
    const o = rec.skip[r].first && rec.skip[r].first.outline;
    return !o || parseFloat(o) < 1;
  });
  note(noRing.length === 0,
    'the focused skip link draws a focus indicator',
    noRing.map((r) => `${r}: outlineWidth=${rec.skip[r].first.outline}`).join(', '));

  const notMoved = ROUTES.filter((r) => {
    const a = rec.skip[r].afterEnter;
    return !a || a.id !== 'ipc-main';
  });
  note(notMoved.length === 0,
    'pressing Enter MOVES FOCUS into <main> — not just scrolls to it',
    notMoved.map((r) => `${r}: activeElement=${JSON.stringify(rec.skip[r].afterEnter)}`).join('\n         '));

  // ── B28 ───────────────────────────────────────────────────────────────────
  const skipped = [];
  for (const [route, hs] of Object.entries(rec.headings)) {
    let prev = 0;
    for (const h of hs) {
      if (prev && h.level > prev + 1) {
        skipped.push(`${route}: h${prev} -> h${h.level} at ${JSON.stringify(h.text)}`);
      }
      prev = h.level;
    }
  }
  note(skipped.length === 0,
    `no route skips a heading level (${ROUTES.length} routes checked)`,
    skipped.join('\n         '));

  const oneH1 = Object.entries(rec.headings).filter(([, hs]) => hs.filter((h) => h.level === 1).length !== 1);
  note(oneH1.length === 0,
    'every route still has exactly one <h1>',
    oneH1.map(([r, hs]) => `${r}: ${hs.filter((h) => h.level === 1).length}`).join(', '));

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan8-keyboard ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'keyboard.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
