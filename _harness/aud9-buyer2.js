/** 2026-08-09 audit probe — B3 redo with the detail-page "Request Quote" CTA,
 *  plus the trailing-slash relative-image question from B6. */
const { launch } = require('./browser');
const BASE = 'http://127.0.0.1:8123';

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE + '/products?productId=IP17TW-18SW-19LW', { waitUntil: 'networkidle' });
  const rfq = await page.$('a:has-text("Request Quote")');
  await rfq.click();
  await page.waitForLoadState('networkidle');
  const url = page.url();
  const part = await page.evaluate(() => {
    const el = document.querySelector('input[name="part"], input[name="partNumber"], input[value*="IP17"]');
    return el ? el.value : (document.body.innerText.match(/IP17[^\n]{0,30}/) || [null])[0];
  });
  console.log('RFQ url:', url);
  console.log('part reaches the form as:', JSON.stringify(part));

  // trailing slash: do the relative image slots still resolve?
  const imgs = [];
  page.on('response', (r) => { if (/images\/site\//.test(r.url())) imgs.push(`${r.status()} ${r.headers()['content-type']} ${r.url()}`); });
  await page.goto(BASE + '/about/', { waitUntil: 'networkidle' });
  const painted = await page.evaluate(() => [...document.querySelectorAll('img')]
    .filter((i) => /images\/site/.test(i.src))
    .map((i) => ({ src: i.src, ok: i.complete && i.naturalWidth > 0, w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height) })));
  console.log('/about/ image responses:', JSON.stringify(imgs, null, 1));
  console.log('/about/ painted:', JSON.stringify(painted, null, 1));

  // control: no trailing slash
  await page.goto(BASE + '/about', { waitUntil: 'networkidle' });
  const painted2 = await page.evaluate(() => [...document.querySelectorAll('img')]
    .filter((i) => /images\/site/.test(i.src))
    .map((i) => ({ src: i.src, ok: i.complete && i.naturalWidth > 0 })));
  console.log('/about  painted:', JSON.stringify(painted2, null, 1));

  await browser.close();
})();
