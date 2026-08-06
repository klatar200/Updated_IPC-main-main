/**
 * Probe (one-shot): measure the ref-callback listener leak that PLAN-5 4.26
 * describes.
 *
 * 4.26 calls them "scroll listeners". They are not — `src/App.jsx:6508` adds
 * `mouseenter`/`mouseleave` to the parent <button> from inside an inline ref
 * callback. The MECHANISM the item describes is exactly right: an inline ref
 * callback is a new function identity on every render, so React detaches
 * (ref(null)) and re-attaches (ref(el)) each time, and nothing removes what
 * was added. The only real `scroll` listener in the file (:6609) is already a
 * useEffect with a cleanup and {passive:true}.
 *
 * Counted over CDP (DOMDebugger.getEventListeners), not by inspection.
 */
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const TARGET = 'IP29CG';   // Polyolefin Heat Shrink — 12 siblings, so Related renders
const OTHER = 'IP30HS';

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(`${BASE}/products?productId=${TARGET}`, { waitUntil: 'networkidle' });

  // Resolve the node through the DOM domain — Playwright's ElementHandle does
  // not expose a usable Runtime objectId for a raw CDP call.
  const count = async () => {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'button.group' });
    if (!nodeId) return 'NO BUTTON';
    const { object } = await cdp.send('DOM.resolveNode', { nodeId });
    const res = await cdp.send('DOMDebugger.getEventListeners', { objectId: object.objectId });
    const tally = {};
    for (const l of res.listeners) tally[l.type] = (tally[l.type] || 0) + 1;
    return tally;
  };

  console.log('after first mount         :', JSON.stringify(await count()));

  // Re-render WITHOUT unmounting: scrolling past the sticky-bar threshold and
  // back flips showStickyBar, which re-renders ProductDetail.
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForTimeout(40);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(40);
  }
  console.log('after 20 scroll re-renders :', JSON.stringify(await count()));

  // Mount / unmount 20 times, staying inside the SPA (clicking a related card).
  for (let i = 0; i < 20; i++) {
    await page.goto(`${BASE}/products?productId=${OTHER}`, { waitUntil: 'networkidle' });
    await page.goto(`${BASE}/products?productId=${TARGET}`, { waitUntil: 'networkidle' });
  }
  console.log('after 20 full page loads   :', JSON.stringify(await count()));

  await browser.close();
})();
