/**
 * AUDIT-10 capture crawler — every page, every viewport,
 * screenshot + automated layout probes.
 *
 * Coverage: the 10 public routes, all 42 product pages, three dashboard
 * family views, and every admin GET page (signed in, plus the signed-out
 * login screen) — at 1440×900 (desktop), 1024×768 (tablet landscape),
 * 834×1112 (tablet portrait), 390×844 (mobile).
 *
 * Output (all under the gitignored _harness/out/):
 *   out/audit10/current/<viewport>/<slug>.png   full-page screenshots
 *   out/audit10/report.json                     per-page probe results
 *
 * Probes per page×viewport: console errors, uncaught page errors, failed
 * requests (network or HTTP >= 400), images that did not decode
 * (naturalWidth 0), horizontal document overflow (scrollWidth vs viewport),
 * and the specific elements protruding past the right edge.
 *
 * Usage: node _harness/audit10-crawl.js [--admin-only|--public-only]
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'audit10');
const SHOTS = path.join(OUT, 'current');

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'tablet-834', width: 834, height: 1112 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const PUBLIC_ROUTES = [
  '/', '/products', '/services', '/industries', '/about',
  '/contact', '/dashboard', '/datasheets', '/faq', '/privacy',
];
const FAMILY_VIEWS = ['Tape', 'Heat Shrink Tubing', 'Adhesive']
  .map((f) => '/dashboard?family=' + encodeURIComponent(f));

const ADMIN_PAGES = [
  '/admin/index.php', '/admin/content.php', '/admin/settings.php',
  '/admin/add.php', '/admin/edit.php?id=CC', '/admin/backups.php',
  '/admin/password.php', '/admin/inquiries.php', '/admin/audit-log.php',
  '/admin/help.php',
];

const slug = (u) =>
  u.replace(/^\//, '').replace(/[/?&=%]+/g, '_').replace(/^$/, 'home').slice(0, 90);

async function probePage(page, url, vp, shotPath) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const onConsole = (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); };
  const onPageErr = (e) => pageErrors.push(String(e).slice(0, 300));
  const onReqFail = (r) => failedRequests.push(`NETFAIL ${r.url().slice(0, 200)}`);
  const onResp = (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url().slice(0, 200)}`); };
  page.on('console', onConsole);
  page.on('pageerror', onPageErr);
  page.on('requestfailed', onReqFail);
  page.on('response', onResp);

  await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
  // Full scroll to trigger lazy loads and scroll-driven UI, then back to top.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 25));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);

  const layout = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const overflowX = Math.max(
      document.documentElement.scrollWidth - vw,
      document.body ? document.body.scrollWidth - vw : 0
    );
    const sig = (el) => {
      const id = el.id ? '#' + el.id : '';
      const cls = el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      return el.tagName.toLowerCase() + id + cls;
    };
    const protruding = [];
    if (overflowX > 1) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && protruding.length < 8) {
          protruding.push({ el: sig(el), left: Math.round(r.left), right: Math.round(r.right) });
        }
      }
    }
    const brokenImgs = [...document.querySelectorAll('img')]
      .filter((i) => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.src))
      .map((i) => (i.getAttribute('src') || '').slice(0, 160));
    const invisibleImgs = [...document.querySelectorAll('img')]
      .filter((i) => {
        const r = i.getBoundingClientRect();
        const cs = getComputedStyle(i);
        return r.width === 0 && r.height === 0 && cs.display !== 'none' &&
          !i.closest('[hidden]') && cs.visibility !== 'hidden';
      }).length;
    return {
      overflowX: Math.round(overflowX),
      protruding,
      brokenImgs,
      invisibleImgs,
      title: document.title,
      h1s: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).slice(0, 4),
      docHeight: document.documentElement.scrollHeight,
    };
  });

  await page.screenshot({ path: shotPath, fullPage: true });

  page.off('console', onConsole);
  page.off('pageerror', onPageErr);
  page.off('requestfailed', onReqFail);
  page.off('response', onResp);

  return { url, viewport: vp.name, consoleErrors, pageErrors, failedRequests, ...layout };
}

(async () => {
  const args = process.argv.slice(2);
  const adminOnly = args.includes('--admin-only');
  const publicOnly = args.includes('--public-only');

  const report = [];
  const browser = await launch();

  const publicUrls = [
    ...PUBLIC_ROUTES,
    ...FAMILY_VIEWS,
    ...products.map((p) => '/products?productId=' + encodeURIComponent(p.id)),
  ];

  for (const vp of VIEWPORTS) {
    const dir = path.join(SHOTS, vp.name);
    fs.mkdirSync(dir, { recursive: true });

    if (!adminOnly) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      for (const url of publicUrls) {
        try {
          report.push(await probePage(page, url, vp, path.join(dir, slug(url || 'home') + '.png')));
        } catch (e) {
          report.push({ url, viewport: vp.name, crawlError: String(e).slice(0, 300) });
        }
        process.stdout.write('.');
      }
      await ctx.close();
    }

    if (!publicOnly) {
      // Signed-out login screen.
      const anon = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const anonPage = await anon.newPage();
      try {
        report.push(await probePage(anonPage, '/admin/', vp, path.join(dir, 'admin_login.png')));
      } catch (e) {
        report.push({ url: '/admin/ (signed out)', viewport: vp.name, crawlError: String(e).slice(0, 300) });
      }
      await anon.close();

      // Signed-in admin pages.
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      page.on('dialog', (d) => d.accept());
      await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
      if (await page.$('input[type="password"]')) {
        await page.fill('input[type="password"]', PASS);
        await Promise.all([page.waitForNavigation(), page.click('button[type="submit"], input[type="submit"]')]);
      }
      for (const url of ADMIN_PAGES) {
        try {
          report.push(await probePage(page, url, vp, path.join(dir, slug(url) + '.png')));
        } catch (e) {
          report.push({ url, viewport: vp.name, crawlError: String(e).slice(0, 300) });
        }
        process.stdout.write('.');
      }
      await ctx.close();
    }
    console.log(` ${vp.name} done`);
  }

  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));

  // Summary of anomalies for the console.
  const flagged = report.filter((r) =>
    r.crawlError ||
    (r.consoleErrors && r.consoleErrors.length) ||
    (r.pageErrors && r.pageErrors.length) ||
    (r.failedRequests && r.failedRequests.length) ||
    (r.overflowX && r.overflowX > 1) ||
    (r.brokenImgs && r.brokenImgs.length) ||
    (r.invisibleImgs && r.invisibleImgs > 0)
  );
  console.log(`\npages crawled: ${report.length}; flagged by automated probes: ${flagged.length}`);
  for (const f of flagged) {
    console.log(`FLAG ${f.viewport} ${f.url} :: ` + JSON.stringify({
      crawlError: f.crawlError, console: (f.consoleErrors || []).length,
      pageErr: (f.pageErrors || []).length, failed: f.failedRequests,
      overflowX: f.overflowX, protruding: f.protruding,
      brokenImgs: f.brokenImgs, invisibleImgs: f.invisibleImgs,
    }));
  }
  console.log(`report -> _harness/out/audit10/report.json`);
})();
