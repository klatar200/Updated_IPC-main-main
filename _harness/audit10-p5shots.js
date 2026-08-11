/**
 * AUDIT-10 pass-5 — issue-evidence screenshots for the pass-5 findings.
 *
 * guardrails.evidence_standards requires an issue screenshot for every visual
 * finding, saved as
 *   _harness/out/audit10/issues/<finding-id>__<viewport>__<slug>.png
 * The numbers in the finding records are the durable evidence (the PNGs are
 * gitignored and die with the container); these exist so a reader of the
 * report can see the thing.
 *
 * The repalette findings (A10-045 / A10-046) get a BEFORE/AFTER pair produced
 * the same way audit10-repalette.js produces its own: the test palette is
 * injected with page.addStyleTag, never by editing a file.
 *
 * Usage: node _harness/audit10-p5shots.js    (mirror on :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const ISSUES = path.join(__dirname, '..', '_harness', 'out', 'audit10', 'issues');

const TEST = {
  '--brand-primary': '#8a1c5a', '--brand-primary-rgb': '138, 28, 90',
  '--brand-primary-hover': '#6f1648', '--brand-dark': '#3a1200',
  '--brand-accent': '#ff9d2e', '--brand-accent-2': '#d2691e',
  '--brand-primary-ink': '#ffffff', '--brand-dark-ink': '#ffffff', '--brand-header-ink': '#ffffff',
  '--brand-primary-ink-rgb': '255, 255, 255', '--brand-dark-ink-rgb': '255, 255, 255',
  '--brand-header-ink-rgb': '255, 255, 255',
  '--brand-primary-text': '#8a1c5a', '--brand-accent-text': '#a04e13',
  '--brand-accent-on-dark': '#e8873a', '--brand-accent-on-footer': '#e8873a',
  '--brand-accent1-on-dark': '#ff9d2e',
};
const CSS = ':root{' + Object.entries(TEST).map(([k, v]) => `${k}:${v} !important;`).join('') + '}';

const settle = async (page) => {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 15)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(350);
};

/** Screenshot a clipped region around the first match of `sel`, with padding. */
async function shotEl(page, sel, file, pad = 24) {
  const el = page.locator(sel).first();
  if (!(await el.count())) { console.log('  MISS ' + sel + ' -> ' + path.basename(file)); return false; }
  // Scroll it in first: an element below the fold has a boundingBox y past the
  // viewport height, and the clip rectangle then computes a negative height.
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(250);
  const box = await el.boundingBox();
  if (!box) { console.log('  NOBOX ' + sel); return false; }
  const vp = page.viewportSize();
  const x = Math.max(0, Math.min(box.x - pad, vp.width - 1));
  const y = Math.max(0, Math.min(box.y - pad, vp.height - 1));
  const width = Math.max(1, Math.min(vp.width - x, box.width + pad * 2));
  const height = Math.max(1, Math.min(vp.height - y, box.height + pad * 2));
  await page.screenshot({ path: file, clip: { x, y, width, height } });
  console.log('  ok   ' + path.basename(file));
  return true;
}

(async () => {
  fs.mkdirSync(ISSUES, { recursive: true });
  const browser = await launch();
  const P = (n) => path.join(ISSUES, n);

  // ── A10-045 / A10-046 — the repalette pair, public pages ─────────────────
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // A10-045: the header's cyan hairline and the homepage badge, after the
  // palette moves to magenta/orange. Viewport shot: the header is at the top.
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await settle(page);
  await page.screenshot({ path: P('A10-045__desktop-1440__home-accent-tints-before.png'), clip: { x: 0, y: 0, width: 1440, height: 620 } });
  await page.addStyleTag({ content: CSS });
  await page.waitForTimeout(400);
  await page.screenshot({ path: P('A10-045__desktop-1440__home-accent-tints-after.png'), clip: { x: 0, y: 0, width: 1440, height: 620 } });
  console.log('  ok   A10-045 home before/after');

  // A10-046: the product-page header gradient, one stop of which stays navy.
  await page.goto(BASE + '/products?productId=IP38FE', { waitUntil: 'networkidle' });
  await settle(page);
  await shotEl(page, 'main div[style*="linear-gradient"]', P('A10-046__desktop-1440__product-header-gradient-before.png'), 8);
  await page.addStyleTag({ content: CSS });
  await page.waitForTimeout(400);
  await shotEl(page, 'main div[style*="linear-gradient"]', P('A10-046__desktop-1440__product-header-gradient-after.png'), 8);

  // A10-046 second surface: the /industries card headers.
  await page.goto(BASE + '/industries', { waitUntil: 'networkidle' });
  await settle(page);
  await shotEl(page, '#industry-automotive', P('A10-046__desktop-1440__industries-card-gradient-before.png'), 8);
  await page.addStyleTag({ content: CSS });
  await page.waitForTimeout(400);
  await shotEl(page, '#industry-automotive', P('A10-046__desktop-1440__industries-card-gradient-after.png'), 8);

  // ── A10-047 — the near-identical border greys, side by side ──────────────
  await page.goto(BASE + '/products?productId=IP38FE', { waitUntil: 'networkidle' });
  await settle(page);
  await shotEl(page, 'table', P('A10-047__desktop-1440__spec-table-border-grey.png'), 16);
  await page.goto(BASE + '/products', { waitUntil: 'networkidle' });
  await settle(page);
  await shotEl(page, 'a.bg-white.rounded-xl', P('A10-047__desktop-1440__catalog-card-border-grey.png'), 16);

  // ── A10-048 — the same card class at three elevations ────────────────────
  // The three surfaces the census shows painting three different shadows on
  // one component class: /services and /industries carry
  // div.bg-white.rounded-2xl.overflow-hidden, /contact the form of the same
  // treatment. / uses the sibling a.flex.gap-5.p-6 with the 0.05 shadow.
  for (const [url, name, sel] of [
    ['/services', 'services', '.bg-white.rounded-2xl'],
    ['/industries', 'industries', '.bg-white.rounded-2xl'],
    ['/contact', 'contact', '.bg-white.rounded-2xl'],
    ['/', 'home', 'a.flex.gap-5.p-6'],
  ]) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await settle(page);
    await shotEl(page, sel, P(`A10-048__desktop-1440__card-shadow-${name}.png`), 26);
  }

  // ── A10-051 — /faq, where the h3 paints larger than the h2 ───────────────
  await page.goto(BASE + '/faq', { waitUntil: 'networkidle' });
  await settle(page);
  await shotEl(page, 'h3', P('A10-051__desktop-1440__faq-h3-larger-than-h2.png'), 40);

  // ── A10-054 — the logo, whose baked-in blue is not the site's blue ───────
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await settle(page);
  await shotEl(page, 'header img', P('A10-054__desktop-1440__logo-blue-vs-brand-blue.png'), 20);
  await ctx.close();

  // ── Admin: A10-049 (button font) and A10-050 (grey text) ─────────────────
  const actx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const apage = await actx.newPage();
  await apage.goto(BASE + '/admin/', { waitUntil: 'networkidle' });
  if (await apage.$('input[type="password"]')) {
    await apage.fill('input[type="password"]', PASS);
    await Promise.all([apage.waitForNavigation(), apage.click('button[type="submit"], input[type="submit"]')]);
  }
  await apage.goto(BASE + '/admin/settings.php', { waitUntil: 'networkidle' });
  await apage.waitForTimeout(400);
  await shotEl(apage, '.hint', P('A10-050__desktop-1440__admin-hint-text-2.54to1.png'), 30);
  await shotEl(apage, 'button.btn', P('A10-049__desktop-1440__admin-button-ua-font.png'), 22);
  await apage.goto(BASE + '/admin/content.php', { waitUntil: 'networkidle' });
  await apage.waitForTimeout(600);
  await shotEl(apage, 'button.rbtn', P('A10-049__desktop-1440__admin-rbtn-arial.png'), 28);
  await apage.goto(BASE + '/admin/backups.php', { waitUntil: 'networkidle' });
  await apage.waitForTimeout(300);
  await shotEl(apage, 'p.note', P('A10-050__desktop-1440__admin-backups-note-2.3to1.png'), 26);
  await apage.goto(BASE + '/admin/add.php', { waitUntil: 'networkidle' });
  await apage.waitForTimeout(400);
  await shotEl(apage, '.pp-ph', P('A10-050__desktop-1440__admin-preview-placeholder-1.82to1.png'), 30);
  await apage.goto(BASE + '/admin/index.php', { waitUntil: 'networkidle' });
  await apage.waitForTimeout(300);
  await shotEl(apage, 'a.btn-danger', P('A10-052__desktop-1440__admin-delete-button-4.28to1.png'), 22);
  await shotEl(apage, 'p.sub, .page-header p', P('A10-052__desktop-1440__admin-subline-4.37to1.png'), 22);
  await actx.close();

  await browser.close();
  console.log('\nissue screenshots -> ' + ISSUES);
})();
