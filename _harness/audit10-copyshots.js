/**
 * AUDIT-10 pass-4 — issue screenshots for the copy findings, plus the second
 * measurement of the homepage stat-strip contradiction.
 *
 * Writes to _harness/out/audit10/issues/ (gitignored). The numbers printed
 * here are the durable evidence; the PNGs die with the container.
 *
 * Usage: node _harness/audit10-copyshots.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const VP = { width: 1440, height: 900 };
const DIR = path.join(__dirname, 'out', 'audit10', 'issues');
fs.mkdirSync(DIR, { recursive: true });

const shot = async (page, sel, name) => {
  const el = typeof sel === 'string' ? await page.$(sel) : sel;
  const p = path.join(DIR, name);
  if (el) await el.screenshot({ path: p }); else await page.screenshot({ path: p });
  console.log('  wrote', name);
};

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: VP });
  const page = await ctx.newPage();

  /* A10-042 — the homepage's two stat strips (second measurement) */
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  console.log('A10-042 homepage stat strips:');
  console.log('  ' + JSON.stringify(await page.evaluate(() => {
    const strips = [...document.querySelectorAll('main section')].slice(0, 3).map((s, i) => {
      const cells = [...s.querySelectorAll('div')].filter((d) => !d.children.length && d.textContent.trim());
      return { section: i + 1, cells: cells.map((c) => c.textContent.trim()).filter((t) => t.length < 40) };
    });
    return strips.filter((s) => s.cells.some((c) => /Shipment Available/.test(c)));
  })));
  await shot(page, 'main section:nth-of-type(1)', 'A10-042__desktop-1440__home-hero-stats.png');
  await shot(page, 'main section:nth-of-type(2)', 'A10-042__desktop-1440__home-trust-bar.png');

  /* A10-037 — ISO renderings */
  await shot(page, 'main section:nth-of-type(3)', 'A10-037__desktop-1440__home-iso-9001-2008.png');
  await page.goto(BASE + '/products?productId=VALUE-ADDED', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await shot(page, 'main', 'A10-037__desktop-1440__value-added-iso9001-2000.png');
  await page.goto(BASE + '/about', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await shot(page, 'main', 'A10-037__desktop-1440__about-iso-mixed.png');

  /* A10-038 — mid-word slices */
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await shot(page, 'table', 'A10-038__desktop-1440__dashboard-midword-slices.png');
  await page.goto(BASE + '/products?productId=IP29CG', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await shot(page, 'aside', 'A10-038__desktop-1440__sidebar-midword-slices.png');

  /* A10-043 — the two not-found messages */
  await page.goto(BASE + '/no-such-page', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await shot(page, 'main', 'A10-043__desktop-1440__404-curly-apostrophe.png');
  await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await shot(page, 'main', 'A10-043__desktop-1440__contact-enquiry.png');
  await ctx.close();

  /* admin */
  const actx = await browser.newContext({ viewport: VP });
  const ap = await actx.newPage();
  ap.on('dialog', (d) => d.dismiss());
  await ap.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
  await ap.fill('input[type="password"]', PASS);
  await Promise.all([ap.waitForNavigation(), ap.click('button[type="submit"]')]);

  await ap.goto(BASE + '/admin/settings.php', { waitUntil: 'networkidle' });
  await ap.waitForTimeout(600);
  await shot(ap, '.preview-inner', 'A10-040__desktop-1440__settings-live-preview.png');
  await shot(ap, 'main', 'A10-041__desktop-1440__settings-hints.png');

  await ap.goto(BASE + '/admin/content.php', { waitUntil: 'networkidle' });
  await ap.waitForTimeout(600);
  await shot(ap, 'fieldset[data-section]', 'A10-039__desktop-1440__content-row-accessible-names.png');
  await actx.close();

  await browser.close();
})();
