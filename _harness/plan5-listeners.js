/**
 * PLAN-5 4.26 — listeners attached in a `ref` callback and never removed.
 *
 * The item is titled "scroll listeners". Measured, that is not what they are:
 * `src/App.jsx` had exactly one `scroll` listener (in ProductPage) and it was
 * ALREADY a useEffect with a cleanup and `{passive:true}`. The leak was on the
 * related-product card's "View →" glyph, which attached `mouseenter` and
 * `mouseleave` to its parent <button> from inside an inline `ref={(el) => …}`.
 * The mechanism 4.26 describes is exactly right — an arrow function written in
 * the markup is a new identity every render, so React tears the ref down and
 * sets it up again on each pass, and nothing removed the previous pass's
 * listeners.
 *
 * ProductDetail re-renders every time the sticky quote bar crosses its scroll
 * threshold, so scrolling a product page is what drives the accumulation.
 *
 * Measured on the unfixed bundle, ONE related-product card:
 *     after first mount          {"click":1,"mouseenter":1,"mouseleave":1}
 *     after 20 scroll cycles     {"click":1,"mouseenter":51,"mouseleave":51}
 *
 * Counts come from CDP (DOMDebugger.getEventListeners) against the real node,
 * not from reading the source. React's own onMouseEnter/onMouseLeave props are
 * delegated to the root container and never appear on the element, so every
 * pointer listener counted here is one this code attached by hand.
 *
 * Asserts:
 *   - the count after 20 scroll re-render cycles equals the count after the
 *     first mount
 *   - the count on `window` is unchanged across 20 SPA mount/unmounts, so the
 *     ProductPage scroll listener's cleanup really runs
 *   - that scroll listener is registered `passive`
 *   - the hover effect it drives still works, at 1440 and at 375
 *   - the sticky quote bar still appears on scroll and retracts, at both widths
 *
 * Reads only. Nothing under data/ is written.
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan5-listeners.js
 */

const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const TARGET = 'IP29CG';   // Polyolefin Heat Shrink — 12 siblings, so Related renders
const CYCLES = 20;

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/** Listeners on the first related-product card, by type. */
async function cardListeners(cdp) {
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'button.group' });
  if (!nodeId) return null;
  const { object } = await cdp.send('DOM.resolveNode', { nodeId });
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: object.objectId });
  const tally = {};
  for (const l of listeners) tally[l.type] = (tally[l.type] || 0) + 1;
  return tally;
}

/** Listeners on `window`, by type, plus the passive flag for `scroll`. */
async function windowListeners(cdp) {
  const { result } = await cdp.send('Runtime.evaluate', { expression: 'window' });
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
  const tally = {};
  let scrollPassive = null;
  for (const l of listeners) {
    tally[l.type] = (tally[l.type] || 0) + 1;
    if (l.type === 'scroll') scrollPassive = l.passive;
  }
  return { tally, scrollPassive };
}

const sameTally = (a, b) =>
  a && b && Object.keys({ ...a, ...b }).every((k) => (a[k] || 0) === (b[k] || 0));

(async () => {
  const browser = await launch();

  try {
    // ── the leak itself, at 1440 ─────────────────────────────────────────────
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const cdp = await page.context().newCDPSession(page);
    await page.goto(`${BASE}/products?productId=${TARGET}`, { waitUntil: 'networkidle' });

    const first = await cardListeners(cdp);
    note(first !== null, `a related-product card is on the page (${TARGET})`, JSON.stringify(first));

    for (let i = 0; i < CYCLES; i++) {
      await page.evaluate(() => window.scrollTo(0, 1400));
      await page.waitForTimeout(40);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(40);
    }
    const afterScroll = await cardListeners(cdp);
    note(sameTally(first, afterScroll),
      `card listener count is unchanged after ${CYCLES} scroll re-render cycles`,
      `${JSON.stringify(first)} -> ${JSON.stringify(afterScroll)}`);

    // ── window, across SPA mount/unmounts ───────────────────────────────────
    const winFirst = await windowListeners(cdp);
    note(winFirst.scrollPassive === true,
      'the ProductPage scroll listener is registered passive',
      JSON.stringify(winFirst));

    for (let i = 0; i < CYCLES; i++) {
      await page.click('button.group');                 // SPA nav to a sibling
      await page.waitForTimeout(80);
      await page.goBack();                              // SPA nav back
      await page.waitForTimeout(80);
    }
    const winAfter = await windowListeners(cdp);
    note(sameTally(winFirst.tally, winAfter.tally),
      `window listener count is unchanged after ${CYCLES} SPA mount/unmounts`,
      `${JSON.stringify(winFirst.tally)} -> ${JSON.stringify(winAfter.tally)}`);

    const afterNav = await cardListeners(cdp);
    note(sameTally(first, afterNav),
      `card listener count is unchanged after ${CYCLES} SPA mount/unmounts`,
      `${JSON.stringify(first)} -> ${JSON.stringify(afterNav)}`);

    await page.close();

    // ── the behaviour it drives still works, at both widths ─────────────────
    for (const w of [1440, 375]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 812 } });
      const p = await ctx.newPage();
      await p.goto(`${BASE}/products?productId=${TARGET}`, { waitUntil: 'networkidle' });

      const card = await p.$('button.group');
      if (!card) {
        note(false, `${w}px: related-product card present`);
      } else {
        await card.scrollIntoViewIfNeeded();
        const glyphOf = () => p.$eval('button.group span[style*="translateX"]',
          (el) => getComputedStyle(el).transform);
        const rest = await glyphOf();
        await card.hover();
        await p.waitForTimeout(350);
        const hovered = await glyphOf();
        await p.mouse.move(2, 2);
        await p.waitForTimeout(350);
        const back = await glyphOf();
        // matrix(1,0,0,1,4,0) is translateX(4px); matrix(1,0,0,1,0,0) is none.
        note(hovered !== rest && /,\s*4,\s*0\)/.test(hovered),
          `${w}px: hovering a related card still slides the arrow`,
          `rest=${rest} hovered=${hovered}`);
        note(back === rest,
          `${w}px: leaving the card puts the arrow back`,
          `hovered=${hovered} back=${back}`);
      }

      // Sticky quote bar — the thing the real scroll listener drives.
      // Return to the top first: the hover check above called
      // scrollIntoViewIfNeeded() on the related card, which leaves the page
      // scrolled, and the first draft of this check read "already visible at
      // the top" as a failure of the bar rather than of its own setup.
      const barVisible = () => p.evaluate(() => document.body.classList.contains('ipc-has-sticky-rfq'));
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(300);
      const atTop = await barVisible();
      await p.evaluate(() => window.scrollTo(0, 1400));
      await p.waitForTimeout(300);
      const scrolled = await barVisible();
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(300);
      const backTop = await barVisible();
      note(atTop === false && scrolled === true && backTop === false,
        `${w}px: the sticky quote bar still appears on scroll and retracts`,
        `top=${atTop} scrolled=${scrolled} back=${backTop}`);

      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan5-listeners: ${results.length - bad}/${results.length}`);
  process.exit(bad ? 1 : 0);
})();
