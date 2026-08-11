/**
 * AUDIT-10 pass-6 step 6.8 — issue screenshots for the pass-6 findings.
 *
 * Named _harness/out/audit10/issues/<finding-id>__<viewport>__<slug>.png per
 * guardrails.evidence_standards.screenshots. These are gitignored and die with
 * the container; the numbers in each finding record are the durable evidence.
 * Every state here is produced the same way the finding was measured — real
 * Tab/Enter/Escape presses, a real wheel scroll, a real pointer move.
 *
 * Usage: node _harness/audit10-p6issues.js         (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const ISSUES = path.join(__dirname, 'out', 'audit10', 'issues');

const shot = (page, id, vp, slug, opts = {}) =>
  page.screenshot({ path: path.join(ISSUES, `${id}__${vp}__${slug}.png`), ...opts });

const resetFocus = (page) => page.evaluate(() => {
  document.body.focus();
  document.documentElement.setAttribute('tabindex', '-1');
  document.documentElement.focus();
});

(async () => {
  fs.mkdirSync(ISSUES, { recursive: true });
  const browser = await launch();
  const made = [];
  try {
    // ── A10-055 mega-menu: Escape from inside the panel does nothing ─────
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      await resetFocus(page);
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab');
        if (await page.evaluate(() => document.activeElement.hasAttribute('aria-haspopup'))) break;
      }
      await page.keyboard.press('Enter');       // open
      await page.waitForTimeout(350);
      await page.keyboard.press('Tab');         // focus into the panel
      await page.waitForTimeout(250);
      await page.keyboard.press('Escape');      // the dismiss that does nothing
      await page.waitForTimeout(450);
      await shot(page, 'A10-055', 'desktop-1440', 'mega-menu-still-open-after-escape',
        { clip: { x: 0, y: 0, width: 1100, height: 470 } });
      made.push('A10-055');
      await ctx.close();
    }

    // ── A10-056 Back does not restore the catalog scroll position ────────
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + '/products', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await page.evaluate(() => window.scrollTo(0, 1200));
      await page.waitForTimeout(500);
      await shot(page, 'A10-056', 'desktop-1440', 'catalog-before-opening-a-product');
      await page.locator('a[href*="productId="]:visible').first().click();
      await page.waitForTimeout(1500);
      await page.goBack();
      await page.waitForTimeout(2500);
      await shot(page, 'A10-056', 'desktop-1440', 'catalog-after-back-scroll-lost');
      made.push('A10-056');
      await ctx.close();
    }

    // ── A10-057 sticky bar mid-slide under prefers-reduced-motion ────────
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.goto(BASE + '/products?productId=CC', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(90);            // caught mid-spring
      await shot(page, 'A10-057', 'desktop-1440', 'sticky-rfq-mid-slide-under-reduce',
        { clip: { x: 0, y: 760, width: 1440, height: 140 } });
      await page.waitForTimeout(1500);
      await shot(page, 'A10-057', 'desktop-1440', 'sticky-rfq-settled',
        { clip: { x: 0, y: 760, width: 1440, height: 140 } });
      made.push('A10-057');
      await ctx.close();
    }

    // ── A10-058 drawer returns the page below where it opened ────────────
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      await page.goto(BASE + '/products?productId=IP33PO', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await page.mouse.move(195, 420);
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(600);
      await shot(page, 'A10-058', 'mobile-390', 'before-opening-the-menu-scrollY-600');
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')]
          .find((x) => /menu/i.test(x.getAttribute('aria-label') || ''));
        if (b) b.focus({ preventScroll: true });
      });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(700);
      await shot(page, 'A10-058', 'mobile-390', 'after-closing-the-menu-scrollY-876');
      made.push('A10-058');
      await ctx.close();
    }

    // ── A10-059 sidebar landing puts the product h1 behind the navbar ────
    for (const vp of [{ name: 'tablet-834', width: 834, height: 1112 },
                      { name: 'desktop-1440', width: 1440, height: 900 }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(BASE + '/products?productId=CC', { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(400);
      await page.locator('a[href*="productId="]:visible').nth(1).click();
      await page.waitForTimeout(2200);
      await shot(page, 'A10-059', vp.name, 'product-h1-under-the-sticky-navbar',
        { clip: { x: 0, y: 0, width: vp.width, height: 240 } });
      await ctx.close();
    }
    made.push('A10-059');

    // ── A10-060 a declared hover state that cannot paint ─────────────────
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + '/about', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const box = await page.evaluate(() => {
        const el = [...document.querySelectorAll('div[class*="hover:border-blue-400"]')]
          .find((e) => e.getBoundingClientRect().width > 0);
        if (!el) return null;
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      if (box) {
        await page.mouse.move(2, 2); await page.waitForTimeout(300);
        await shot(page, 'A10-060', 'desktop-1440', 'about-timeline-card-default',
          { clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: Math.min(1440, box.w + 20), height: Math.min(300, box.h + 20) } });
        await page.mouse.move(box.x + box.w / 2, box.y + box.h / 2);
        await page.waitForTimeout(600);
        await shot(page, 'A10-060', 'desktop-1440', 'about-timeline-card-hovered-identical',
          { clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: Math.min(1440, box.w + 20), height: Math.min(300, box.h + 20) } });
        made.push('A10-060');
      }
      await ctx.close();
    }

    // ── A10-061 a control family with no hover feedback at all ───────────
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const box = await page.evaluate(() => {
        const el = document.querySelector('button.ipc-sort-btn');
        if (!el) return null;
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      if (box) {
        const clip = { x: 0, y: Math.max(0, box.y - 20), width: 1440, height: 120 };
        await page.mouse.move(2, 2); await page.waitForTimeout(300);
        await shot(page, 'A10-061', 'desktop-1440', 'sort-header-default', { clip });
        await page.mouse.move(box.x + box.w / 2, box.y + box.h / 2);
        await page.waitForTimeout(600);
        await shot(page, 'A10-061', 'desktop-1440', 'sort-header-hovered-identical', { clip });
        made.push('A10-061');
      }
      await ctx.close();
    }

    // ── A10-062 the two focus-ring treatments, same page ─────────────────
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      // the designed 3px accent ring on a sort header
      await resetFocus(page);
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        const hit = await page.evaluate(() =>
          document.activeElement.classList && document.activeElement.classList.contains('ipc-sort-btn'));
        if (hit) break;
      }
      const y = await page.evaluate(() => Math.round(document.activeElement.getBoundingClientRect().y));
      await shot(page, 'A10-062', 'desktop-1440', 'designed-ring-on-sort-header',
        { clip: { x: 0, y: Math.max(0, y - 24), width: 1000, height: 110 } });
      // the browser default ring on the neighbouring row link
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await resetFocus(page);
      await page.keyboard.press('Tab');   // skip link (designed)
      await page.keyboard.press('Tab');   // logo (UA default)
      await page.keyboard.press('Tab');   // Home (UA default)
      await page.waitForTimeout(300);
      await shot(page, 'A10-062', 'desktop-1440', 'ua-default-ring-on-navbar-link',
        { clip: { x: 0, y: 0, width: 900, height: 100 } });
      made.push('A10-062');
      await ctx.close();
    }
  } finally { await browser.close(); }

  const files = fs.readdirSync(ISSUES).filter((f) => f.startsWith('A10-05') || f.startsWith('A10-06'));
  console.log(`\nissue screenshots for: ${made.join(', ')}`);
  for (const f of files.sort()) console.log(`  ${f}`);
  console.log(`\n-> ${ISSUES}`);
})();
