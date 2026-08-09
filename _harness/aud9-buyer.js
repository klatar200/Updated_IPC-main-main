/**
 * 2026-08-09 audit probe — §7C: the buyer journey.
 *
 *  B1  land on a deep product URL (as from a search result), 1440: product
 *      name visible, photo or placeholder paints, datasheet link present.
 *  B2  the datasheet answers 200 application/pdf.
 *  B3  "Request a Quote" from the product page carries the product context
 *      into the contact form; fill and submit; the success state appears and
 *      the enquiry lands in admin/inquiries.jsonl; a mail record is written
 *      by fakemail.
 *  B4  the same landing at 390 — name visible, no horizontal overflow, the
 *      quote CTA tappable.
 *  B5  JavaScript disabled: the noscript block with the phone number renders.
 *  B6  trailing-slash URL /about/ — does the app boot and what renders?
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const SITE = path.join(__dirname, 'site');
const results = [];
const note = (ok, what, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       -> ' + detail}`);
};

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // B1 — deep landing
  await page.goto(BASE + '/products?productId=IP17TW-18SW-19LW', { waitUntil: 'networkidle' });
  const b1 = await page.evaluate(() => {
    const h1 = [...document.querySelectorAll('h1')].map((h) => h.textContent.trim());
    const pdf = [...document.querySelectorAll('a[href*=".pdf"]')].map((a) => a.getAttribute('href'));
    return { h1, pdfCount: pdf.length, firstPdf: pdf[0] || null };
  });
  note(b1.h1.length === 1 && b1.pdfCount > 0, 'B1 deep landing renders the product with a datasheet link', JSON.stringify(b1));

  // B2 — datasheet content type
  if (b1.firstPdf) {
    const resp = await page.request.get(BASE + (b1.firstPdf.startsWith('/') ? '' : '/') + b1.firstPdf);
    const ct = resp.headers()['content-type'] || '';
    note(resp.status() === 200 && /application\/pdf/.test(ct), 'B2 datasheet is 200 application/pdf', `${resp.status()} ${ct} ${b1.firstPdf}`);
  }

  // B3 — request a quote
  const rfq = await page.$('a[href*="contact"][href*="product="], a:has-text("Request a Quote")');
  note(!!rfq, 'B3 product page has a quote link', '');
  if (rfq) {
    await rfq.click();
    await page.waitForLoadState('networkidle');
    const url = page.url();
    const carried = /product=|productId=/.test(url);
    note(carried, 'B3 quote link carries the product into the form URL', url);
    // fill whatever required fields exist on the visible form
    const mailLog = '/tmp/ipc-harness-mail.log';
    const beforeMail = fs.existsSync(mailLog) ? fs.readFileSync(mailLog, 'utf8').split('===MESSAGE===').length - 1 : 0;
    const inq = path.join(SITE, 'admin', 'inquiries.jsonl');
    const beforeInq = fs.existsSync(inq) ? fs.readFileSync(inq, 'utf8').trim().split('\n').filter(Boolean).length : 0;
    await page.fill('input[name="name"]', 'Audit Buyer');
    await page.fill('input[name="email"]', 'buyer@example.com');
    const company = await page.$('input[name="company"]');
    if (company) await company.fill('Audit Co');
    const msg = await page.$('textarea[name="message"], textarea[name="notes"]');
    if (msg) await msg.fill('Quote please — audit probe.');
    // any other required fields (qty etc.)
    for (const el of await page.$$('form:visible [required]')) {
      const v = await el.inputValue().catch(() => 'x');
      if (!v) await el.fill('1').catch(() => {});
    }
    await page.click('button[type="submit"]:visible');
    await page.waitForTimeout(2500);
    const success = await page.evaluate(() => /thank|received|we.ll|success/i.test(document.body.innerText));
    const afterInq = fs.existsSync(inq) ? fs.readFileSync(inq, 'utf8').trim().split('\n').filter(Boolean).length : 0;
    note(success, 'B3 submit shows a success state', page.url());
    note(afterInq === beforeInq + 1, 'B3 the enquiry lands in admin/inquiries.jsonl', `${beforeInq} -> ${afterInq}`);
    const afterMail = fs.existsSync(mailLog) ? fs.readFileSync(mailLog, 'utf8').split('===MESSAGE===').length - 1 : 0;
    note(afterMail > beforeMail, 'B3 a sales notification reaches the (fake) mailer', `${beforeMail} -> ${afterMail} messages in ${mailLog}`);
  }
  await ctx.close();

  // B4 — mobile landing
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mpage = await mctx.newPage();
  await mpage.goto(BASE + '/products?productId=IP17TW-18SW-19LW', { waitUntil: 'networkidle' });
  const b4 = await mpage.evaluate(() => ({
    sw: document.documentElement.scrollWidth, iw: window.innerWidth,
    h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
  }));
  note(b4.sw <= b4.iw && b4.h1.length === 1, 'B4 390px landing: no overflow, product name is the h1', JSON.stringify(b4));
  await mctx.close();

  // B5 — JS disabled
  const nctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const npage = await nctx.newPage();
  await npage.goto(BASE + '/products?productId=CC', { waitUntil: 'domcontentloaded' });
  const noscript = await npage.evaluate(() => {
    const t = document.body.innerText;
    return { hasPhone: /630\.771\.0700/.test(t), hasCall: /call or email/i.test(t) };
  });
  note(noscript.hasPhone && noscript.hasCall, 'B5 with JS off the noscript contact card renders', JSON.stringify(noscript));
  await nctx.close();

  // B6 — trailing slash
  const tctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const tpage = await tctx.newPage();
  const terrs = [];
  tpage.on('pageerror', (e) => terrs.push(String(e).slice(0, 120)));
  await tpage.goto(BASE + '/about/', { waitUntil: 'networkidle' });
  const b6 = await tpage.evaluate(() => ({
    title: document.title,
    booted: !!document.querySelector('#root *'),
    body: document.body.innerText.slice(0, 120).replace(/\n/g, ' '),
    robots: (document.querySelector('meta[name="robots"]') || {}).content || null,
  }));
  console.log('B6 /about/ ->', JSON.stringify(b6), 'pageerrors:', terrs.length);
  await tctx.close();

  await browser.close();
  console.log(`aud9-buyer: ${results.filter(Boolean).length}/${results.length}`);
})();
