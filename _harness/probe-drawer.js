/**
 * One-shot: where does the scroll offset actually go across a drawer
 * open/close? Three targeted fixes failed to move it off 876, so this stops
 * guessing and samples every step.
 */
const { launch } = require('./browser');
const BASE = 'http://127.0.0.1:8123';

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();

  const snap = async (label) => {
    const s = await p.evaluate(() => ({
      y: Math.round(window.scrollY),
      bodyPos: getComputedStyle(document.body).position,
      bodyTop: document.body.style.top,
      docH: document.documentElement.scrollHeight,
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
      active: document.activeElement ? document.activeElement.tagName + '/' +
        (document.activeElement.getAttribute('aria-label') || (document.activeElement.textContent || '').trim().slice(0, 18)) : null,
    }));
    console.log(label.padEnd(28), JSON.stringify(s));
  };

  await p.goto(`${BASE}/products?productId=IP33PO`, { waitUntil: 'networkidle' });
  await p.evaluate(() => window.scrollTo(0, 600));
  await p.waitForTimeout(250);
  await snap('1 after scrollTo(600)');

  await p.locator('button[aria-label="Open menu"]').click();
  await p.waitForTimeout(400);
  await snap('2 drawer open');

  for (let i = 0; i < 14; i++) await p.keyboard.press('Tab');
  await p.waitForTimeout(200);
  await snap('3 after 14 Tabs');

  await p.keyboard.press('Escape');
  await p.waitForTimeout(50);
  await snap('4 escape +50ms');
  await p.waitForTimeout(250);
  await snap('5 escape +300ms');
  await p.waitForTimeout(700);
  await snap('6 escape +1000ms');

  await browser.close();
})();
