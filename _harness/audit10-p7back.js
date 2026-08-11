/**
 * AUDIT-10 pass-7 — three attempts at A10-056 (Back does not restore scroll on
 * /products), after attempt 1 in audit10-p7reverify.js failed to reproduce it.
 *
 * The guardrail is three attempts before recording something as unreproducible,
 * and the interesting question is not "does it fail" but "what did pass-6
 * actually measure". Two things differ between pass-6's probe and a visitor:
 *
 *   A. HOW THE CARD IS CLICKED. `page.click(selector)` performs an actionability
 *      scroll first — it scrolls the target into view before dispatching. If the
 *      chosen card is above the current scroll offset, that scroll happens
 *      BEFORE the navigation, so the history entry for /products is committed at
 *      the scrolled-to offset, not at the offset the visitor was reading at.
 *      Back then restores that offset perfectly and looks broken.
 *   B. HOW LONG BACK IS GIVEN. A SPA re-renders 42 cards and the browser
 *      restores scroll after layout; a short settle reads the intermediate 0.
 *
 * Arms, per viewport:
 *   arm1  real mouse click at a point the card owns, pass-6's waits (1.5s/2.5s)
 *   arm2  real mouse click, long waits (2.5s/4s)
 *   arm3  page.click(selector) on the FIRST card in the DOM — pass-6's shape
 *
 * arm1/arm2 are what a visitor does. arm3 is the control that shows whether the
 * original number came from the harness.
 *
 * Output: _harness/out/audit10/p7/back.json
 * Usage:  node _harness/audit10-p7back.js      (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10', 'p7');
fs.mkdirSync(OUT, { recursive: true });

const VP = {
  'desktop-1440': { width: 1440, height: 900 },
  'tablet-834': { width: 834, height: 1112 },
  'mobile-390': { width: 390, height: 844 },
};

const PICK_OWNED = `(() => {
  for(const a of document.querySelectorAll('a[href*="productId="]')){
    const b=a.getBoundingClientRect();
    if(b.top<60||b.bottom>window.innerHeight-80||b.width<40) continue;
    const x=b.x+b.width/2, y=b.y+b.height/2;
    const hit=document.elementFromPoint(x,y);
    if(hit&&a.contains(hit)) return {href:a.getAttribute('href'),x:Math.round(x),y:Math.round(y)};
  }
  return null;
})()`;

async function run(browser, vpName, arm) {
  const ctx = await browser.newContext({ viewport: VP[vpName] });
  const page = await ctx.newPage();
  await page.goto(BASE + '/products', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const scrollRestoration = await page.evaluate('history.scrollRestoration');
  await page.evaluate('window.scrollTo(0,1200)');
  await page.waitForTimeout(600);
  const before = await page.evaluate('Math.round(window.scrollY)');

  let clicked = null, scrollAtNavigation = null;
  if (arm === 'arm3') {
    // first card with a painted box, in DOM order — pass-6's "first visible
    // product card". The very first match in the DOM is a display:none rail link.
    const href = await page.evaluate(`(() => {
      for(const a of document.querySelectorAll('a[href*="productId="]')){
        const b=a.getBoundingClientRect();
        if(b.width>0&&b.height>0) return a.getAttribute('href');
      }
      return null;
    })()`);
    if (!href) { await ctx.close(); return { vp: vpName, arm, error: 'no painted card' }; }
    clicked = href;
    // pass-6's shape: a selector click, which scrolls the target into view first.
    const loc = page.locator(`a[href="${href}"]`).first();
    await loc.scrollIntoViewIfNeeded();
    scrollAtNavigation = await page.evaluate('Math.round(window.scrollY)');
    await loc.click({ force: true });
  } else {
    const c = await page.evaluate(PICK_OWNED);
    if (!c) { await ctx.close(); return { vp: vpName, arm, error: 'no clickable card' }; }
    clicked = c.href;
    scrollAtNavigation = await page.evaluate('Math.round(window.scrollY)');
    await page.mouse.click(c.x, c.y);
  }

  await page.waitForTimeout(arm === 'arm2' ? 2500 : 1500);
  const onProduct = await page.evaluate('({url:location.pathname+location.search,y:Math.round(window.scrollY)})');
  await page.goBack();
  await page.waitForTimeout(arm === 'arm2' ? 4000 : 2500);
  const afterBack = await page.evaluate('({url:location.pathname+location.search,y:Math.round(window.scrollY)})');
  await ctx.close();

  return {
    vp: vpName, arm, scrollRestoration, before,
    scrollAtNavigation,
    scrollMovedBeforeNavigating: scrollAtNavigation !== before,
    clicked, onProduct, afterBack,
    restored: Math.abs(afterBack.y - before) < 200,
  };
}

(async () => {
  const browser = await launch();
  const rows = [];
  for (const vp of Object.keys(VP)) {
    for (const arm of ['arm1', 'arm2', 'arm3']) {
      let r;
      try { r = await run(browser, vp, arm); }
      catch (e) { r = { vp, arm, error: String(e).split('\n')[0].slice(0, 200) }; }
      rows.push(r);
      if (r.error) { console.log(`${vp.padEnd(13)} ${arm}  ERROR ${r.error}`); continue; }
      console.log(`${r.vp.padEnd(13)} ${r.arm}  before=${r.before} atNav=${r.scrollAtNavigation}` +
        ` product=${r.onProduct ? r.onProduct.y : '?'} back=${r.afterBack ? r.afterBack.y : '?'}` +
        `  ${r.restored ? 'RESTORED' : 'NOT RESTORED'}` +
        `${r.scrollMovedBeforeNavigating ? '   <- harness scrolled before navigating' : ''}`);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'back.json'), JSON.stringify(rows, null, 2));
  const visitorArms = rows.filter(r => r.arm !== 'arm3');
  console.log(`\nvisitor-shaped arms restored: ${visitorArms.filter(r => r.restored).length}/${visitorArms.length}`);
  console.log('-> ' + path.join(OUT, 'back.json'));
})();
