/**
 * AUDIT-10 pass-5 step 5.4 — heading-level size inversion, per page.
 *
 * The computed-style census aggregates across pages, so it cannot answer "on
 * THIS page, does an h3 paint larger than the h2 above it". That is a per-page
 * ordering question and it needs its own walk.
 *
 * For every route (10 public + 3 family views + 2 error states + 42 product
 * pages + the admin GET pages) at desktop-1440 and mobile-390, this records
 * every visible h1-h6 with its computed fontSize/fontWeight and its document
 * order, then flags any page where a DEEPER heading level paints strictly
 * LARGER than a shallower one. Ties are not flagged — two levels sharing a
 * size is a scale decision, not an inversion.
 *
 * Headings inside the mobile navigation drawer and other closed containers are
 * skipped by the same visibility test the census uses (client rects +
 * visibility), so a hidden h2 cannot manufacture an inversion.
 *
 * Usage: node _harness/audit10-headings.js   (mirror on :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const ROOT = path.join(__dirname, '..');
const OUTDIR = path.join(ROOT, '_harness', 'out', 'audit10', 'pass5');
const PASS = 'audit-pass-123';

const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8'));
const PUBLIC = [
  '/', '/products', '/services', '/industries', '/about', '/contact',
  '/dashboard', '/datasheets', '/faq', '/privacy',
  '/dashboard?family=Tape', '/dashboard?family=' + encodeURIComponent('Heat Shrink Tubing'),
  '/dashboard?family=Adhesive',
  '/products?productId=NOPE-XYZ-123', '/no-such-page',
  ...products.map((p) => '/products?productId=' + encodeURIComponent(p.id)),
];
const ADMIN = [
  '/admin/index.php', '/admin/content.php', '/admin/settings.php', '/admin/add.php',
  '/admin/edit.php?id=CC', '/admin/backups.php', '/admin/password.php',
  '/admin/inquiries.php', '/admin/audit-log.php', '/admin/help.php',
];
const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const WALK = () => {
  const out = [];
  let i = 0;
  for (const el of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible') continue;
    out.push({
      order: i++,
      level: +el.tagName[1],
      size: parseFloat(cs.fontSize),
      weight: cs.fontWeight,
      text: (el.textContent || '').trim().slice(0, 60),
      cls: (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).slice(0, 3).join('.'),
    });
  }
  return out;
};

(async () => {
  const browser = await launch();
  const report = { base: BASE, pages: [], inversions: [] };

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const visit = async (url, key) => {
      try {
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(200);
        const hs = await page.evaluate(WALK);
        report.pages.push({ page: key, headings: hs.length });
        // Best (largest) size seen at each level on this page.
        const best = {};
        for (const h of hs) best[h.level] = Math.max(best[h.level] || 0, h.size);
        for (const a of Object.keys(best))
          for (const b of Object.keys(best))
            if (+a < +b && best[b] > best[a])
              report.inversions.push({
                page: key, shallower: `h${a}`, shallowerSize: best[a],
                deeper: `h${b}`, deeperSize: best[b], delta: +(best[b] - best[a]).toFixed(2),
                examples: hs.filter((h) => h.level === +b && h.size === best[b]).slice(0, 2).map((h) => `${h.text} (${h.size}px ${h.weight} .${h.cls})`)
                  .concat(hs.filter((h) => h.level === +a && h.size === best[a]).slice(0, 2).map((h) => `${h.text} (${h.size}px ${h.weight} .${h.cls})`)),
              });
      } catch (e) {
        report.pages.push({ page: key, error: String(e).slice(0, 160) });
      }
      process.stdout.write('.');
    };
    for (const u of PUBLIC) await visit(u, vp.name + ' ' + u);
    await ctx.close();

    const actx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const apage = await actx.newPage();
    await apage.goto(BASE + '/admin/', { waitUntil: 'networkidle', timeout: 45000 });
    if (await apage.$('input[type="password"]')) {
      await apage.fill('input[type="password"]', PASS);
      await Promise.all([apage.waitForNavigation(), apage.click('button[type="submit"], input[type="submit"]')]);
    }
    const saved = page;
    for (const u of ADMIN) {
      try {
        await apage.goto(BASE + u, { waitUntil: 'networkidle', timeout: 45000 });
        await apage.waitForTimeout(200);
        const hs = await apage.evaluate(WALK);
        const key = vp.name + ' ' + u;
        report.pages.push({ page: key, headings: hs.length });
        const best = {};
        for (const h of hs) best[h.level] = Math.max(best[h.level] || 0, h.size);
        for (const a of Object.keys(best))
          for (const b of Object.keys(best))
            if (+a < +b && best[b] > best[a])
              report.inversions.push({
                page: key, shallower: `h${a}`, shallowerSize: best[a], deeper: `h${b}`, deeperSize: best[b],
                delta: +(best[b] - best[a]).toFixed(2),
                examples: hs.filter((h) => h.level === +b && h.size === best[b]).slice(0, 2).map((h) => `${h.text} (${h.size}px ${h.weight} .${h.cls})`),
              });
      } catch (e) {
        report.pages.push({ page: vp.name + ' ' + u, error: String(e).slice(0, 160) });
      }
      process.stdout.write('.');
    }
    await actx.close();
    void saved;
    console.log(' ' + vp.name + ' done');
  }
  await browser.close();

  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.writeFileSync(path.join(OUTDIR, 'headings.json'), JSON.stringify(report, null, 1));
  console.log(`pages walked: ${report.pages.filter((p) => !p.error).length}/${report.pages.length}`);
  console.log(`heading-level size inversions: ${report.inversions.length}`);
  const seen = new Set();
  for (const inv of report.inversions) {
    const k = `${inv.shallower}<${inv.deeper} ${inv.shallowerSize}/${inv.deeperSize}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const n = report.inversions.filter((x) => `${x.shallower}<${x.deeper} ${x.shallowerSize}/${x.deeperSize}` === k).length;
    console.log(`  ${inv.shallower} ${inv.shallowerSize}px  <  ${inv.deeper} ${inv.deeperSize}px  (+${inv.delta}px) on ${n} page x viewport rows, e.g. ${inv.page}`);
    console.log(`      ${inv.examples.join(' | ')}`);
  }
  console.log('-> ' + path.join(OUTDIR, 'headings.json'));
})();
