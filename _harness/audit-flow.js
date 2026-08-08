/**
 * Organic user-flow audit. Drives the site the way a visitor would and records
 * what actually happens at each step, plus a screenshot of every state.
 *
 *   node _harness/audit-flow.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit');
const SH = path.join(OUT, 'flow');
fs.mkdirSync(SH, { recursive: true });

const log = [];
async function tryStep(name, fn) {
  try { await fn(); } catch (e) { note(name + ' FAILED', { err: String(e).split('\n')[0].slice(0, 160) }); }
}
function note(step, data) { log.push({ step, ...data }); console.log('•', step, JSON.stringify(data).slice(0, 220)); }

async function shot(page, name, clip) {
  await page.screenshot({ path: path.join(SH, name + '.png'), ...(clip ? { clip } : { fullPage: false }) });
}

async function desktop(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));

  // ── 1. Mega menu ─────────────────────────────────────────────
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.locator('header button:has-text("Products")').first().click();
  await page.waitForTimeout(400);
  await shot(page, '01-products-menu', { x: 0, y: 0, width: 1440, height: 620 });
  note('products menu opened', await page.evaluate(() => ({
    expanded: document.querySelectorAll('[aria-expanded="true"]').length,
    visibleLinks: [...document.querySelectorAll('a')].filter((a) => {
      const r = a.getBoundingClientRect(); return r.top > 60 && r.top < 600 && r.width > 10;
    }).length,
  })));
  // Does clicking outside close it?
  await page.mouse.click(700, 800);
  await page.waitForTimeout(300);
  note('closes on outside click', await page.evaluate(
    () => ({ stillOpen: document.querySelectorAll('[aria-expanded="true"]').length })));

  await page.locator('header button:has-text("Company")').first().click();
  await page.waitForTimeout(400);
  await shot(page, '02-company-menu', { x: 0, y: 0, width: 1440, height: 500 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  note('company menu escape', await page.evaluate(
    () => ({ stillOpen: document.querySelectorAll('[aria-expanded="true"]').length })));

  // Can both menus be open at once?
  await page.locator('header button:has-text("Products")').first().click();
  await page.waitForTimeout(250);
  await page.locator('header button:has-text("Company")').first().click();
  await page.waitForTimeout(300);
  note('both menus at once', await page.evaluate(
    () => ({ openCount: document.querySelectorAll('[aria-expanded="true"]').length })));
  await shot(page, '03-both-menus', { x: 0, y: 0, width: 1440, height: 620 });
  await page.keyboard.press('Escape');

  // ── 2. Homepage → product, and Back ──────────────────────────
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.locator('a:has-text("Browse Products"):visible').first().click();
  await page.waitForTimeout(1000);
  note('browse products lands on', { url: page.url() });
  // Pick the 3rd product in the sidebar.
  const link = page.locator('a[href*="productId="]:visible').nth(3);
  const label = await link.textContent();
  await link.click();
  await page.waitForTimeout(900);
  note('sidebar product click', { label: (label || '').trim().slice(0, 40), url: page.url(),
    scrollY: await page.evaluate(() => Math.round(window.scrollY)) });
  await shot(page, '04-after-sidebar-click', { x: 0, y: 0, width: 1440, height: 900 });
  await page.goBack();
  await page.waitForTimeout(800);
  note('back from product', { url: page.url() });

  // ── 3. Request a Quote from a product carries the SKU? ───────
  await page.goto(BASE + '/products?productId=IP33PO', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const rq = page.locator('a:has-text("Request Quote"):visible').first();
  await rq.click();
  await page.waitForTimeout(1200);
  note('product → request quote', {
    url: page.url(),
    partField: await page.evaluate(() => {
      const el = document.querySelector('[name=partNumber]');
      return el ? el.value : null;
    }),
    scrollY: await page.evaluate(() => Math.round(window.scrollY)),
  });
  await shot(page, '05-quote-from-product', { x: 0, y: 0, width: 1440, height: 900 });

  // ── 4. Contact form validation ───────────────────────────────
  await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('button:has-text("Submit Quote Request"):visible').first().click();
  await page.waitForTimeout(600);
  note('empty submit', await page.evaluate(() => {
    const inv = [...document.querySelectorAll(':invalid')].map((e) => e.name).filter(Boolean);
    const alert = document.querySelector('[role=alert]');
    return { invalidFields: inv, alertText: alert ? alert.textContent.trim().slice(0, 90) : null,
      focused: document.activeElement ? document.activeElement.name || document.activeElement.tagName : null };
  }));
  // Fill and submit for real.
  await page.fill('[name=name]', 'Audit Tester');
  await page.fill('[name=email]', 'audit@example.com');
  await page.fill('[name=quantity]', '500 ft');
  await page.fill('[name=partNumber]', 'IP33PO');
  await page.fill('[name=additionalNotes]', 'Need <1/4 inch and >2 inch ID, 1/2" wall.');
  await shot(page, '06-contact-filled', { x: 0, y: 240, width: 1440, height: 900 });
  await page.locator('button:has-text("Submit Quote Request"):visible').first().click();
  await page.waitForTimeout(2500);
  note('valid submit', await page.evaluate(() => {
    const alert = document.querySelector('[role=alert]');
    return { url: location.href, alert: alert ? alert.textContent.trim().slice(0, 160) : null,
      bodyHas: /thank|received|success/i.test(document.body.innerText) ? 'success-ish' : 'no success text',
      scrollY: Math.round(window.scrollY) };
  }));
  await shot(page, '07-contact-submitted', { x: 0, y: 0, width: 1440, height: 900 });

  // ── 5. Dashboard search / sort / empty state ─────────────────
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const search = page.locator('input[placeholder*="Search"]:visible').first();
  await search.fill('kynar');
  await page.waitForTimeout(700);
  note('search "kynar"', await page.evaluate(() => ({
    rows: document.querySelectorAll('tbody tr').length,
    counter: (document.body.innerText.match(/\d+ of \d+ products/) || [])[0] || null,
  })));
  await search.fill('zzzznothing');
  await page.waitForTimeout(700);
  note('search no-results', await page.evaluate(() => ({
    rows: document.querySelectorAll('tbody tr').length,
    text: document.body.innerText.slice(document.body.innerText.indexOf('products'), 400).replace(/\s+/g, ' ').slice(0, 180),
  })));
  await shot(page, '08-dashboard-empty', { x: 0, y: 250, width: 1440, height: 700 });
  await search.fill('');
  await page.waitForTimeout(500);
  // Sort by Product Name.
  await page.locator('th button:has-text("Product Name"):visible').first().click();
  await page.waitForTimeout(500);
  note('sort by name', await page.evaluate(() => ({
    aria: [...document.querySelectorAll('th')].map((t) => t.getAttribute('aria-sort')),
    first: (document.querySelector('tbody tr td') || {}).innerText,
  })));

  // ── 6. Datasheets: what does a card do? ──────────────────────
  await page.goto(BASE + '/datasheets', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  note('datasheet links', await page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href$=".pdf"], a[href*="/pdfs/"]')];
    return { count: a.length, sample: a.slice(0, 3).map((x) => ({
      href: x.getAttribute('href'), target: x.getAttribute('target'), rel: x.getAttribute('rel'),
      download: x.hasAttribute('download'), text: x.textContent.trim().slice(0, 40) })) };
  }));

  // ── 7. FAQ chips ─────────────────────────────────────────────
  await page.goto(BASE + '/faq', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const before = await page.evaluate(() => window.scrollY);
  await page.locator('button:has-text("Ordering & Minimums"):visible').first().click();
  await page.waitForTimeout(800);
  note('faq chip', { scrollBefore: before, scrollAfter: await page.evaluate(() => Math.round(window.scrollY)),
    url: page.url() });
  const q = page.locator('button:has-text("What is your minimum order")').first();
  if (await q.count()) {
    await q.click();
    await page.waitForTimeout(600);
  } else {
    await page.locator('h3 button, button[aria-expanded]').nth(2).click().catch(() => {});
    await page.waitForTimeout(600);
  }
  await shot(page, '09-faq-open', { x: 0, y: 300, width: 1440, height: 800 });
  note('faq expanded', await page.evaluate(() => ({
    expanded: document.querySelectorAll('[aria-expanded="true"]').length,
  })));

  note('console errors during desktop flow', { errors: errors.slice(0, 8), count: errors.length });
  await ctx.close();
}

async function mobile(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, 'm01-home-top');

  // Hamburger
  const burger = page.locator('header button').last();
  await burger.click();
  await page.waitForTimeout(600);
  await shot(page, 'm02-drawer');
  note('mobile drawer', await page.evaluate(() => ({
    bodyScrollLocked: getComputedStyle(document.body).overflow,
    links: [...document.querySelectorAll('a')].filter((a) => a.getBoundingClientRect().width > 40).length,
    closeBtn: !!document.querySelector('[aria-label*="lose"],[aria-label*="enu"]'),
    height: document.documentElement.scrollHeight,
  })));
  // Scroll inside drawer
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(400);
  await shot(page, 'm03-drawer-scrolled');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  note('drawer escape', await page.evaluate(
    () => ({ open: document.querySelectorAll('[aria-expanded="true"]').length })));

  // Product page on mobile
  await page.goto(BASE + '/products?productId=IP33PO', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await shot(page, 'm04-product-top');
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(500);
  await shot(page, 'm05-product-mid');
  note('mobile product', await page.evaluate(() => {
    const t = document.querySelector('table');
    const bar = [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).position === 'fixed' && d.getBoundingClientRect().bottom >= innerHeight - 2 && d.getBoundingClientRect().height > 30);
    return {
      tableScrollW: t ? t.scrollWidth : null, tableClientW: t ? t.clientWidth : null,
      tableWrapScrolls: t && t.parentElement ? t.parentElement.scrollWidth > t.parentElement.clientWidth : null,
      stickyBarH: bar ? Math.round(bar.getBoundingClientRect().height) : null,
      docScrollW: document.documentElement.scrollWidth, docClientW: document.documentElement.clientWidth,
    };
  }));

  // Dashboard table on mobile
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await shot(page, 'm06-dashboard');
  note('mobile dashboard', await page.evaluate(() => {
    const t = document.querySelector('table');
    return { hasTable: !!t, cards: document.querySelectorAll('[class*=card]').length,
      docScrollW: document.documentElement.scrollWidth };
  }));

  // Contact on mobile
  await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, 'm07-contact');
  await ctx.close();
}

(async () => {
  const browser = await launch();
  await desktop(browser);
  await mobile(browser);
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'flow.json'), JSON.stringify(log, null, 1));
  console.log('\nwrote flow.json');
})();
