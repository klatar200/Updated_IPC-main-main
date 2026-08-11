/**
 * AUDIT-10 pass-3 — capture the REAL product-edit page, and sweep every admin
 * page's raw response body for PHP diagnostics.
 *
 * Why this exists: plans/audit10/routes.json lists the edit page as
 * `/admin/edit.php?id=CC`, but admin/edit.php:5 reads `$_GET['sku']` and
 * admin/index.php:221 links `edit.php?sku=…`. With `?id=` the page redirects to
 * index.php ("Product not found") — so every capture named
 * admin_edit.php_id_CC.png in pass-0/1/2 is a screenshot of the CATALOG, not of
 * the edit form. This captures `?sku=CC` alongside it so the page is actually
 * reviewed. The plan file itself is NOT edited (guardrails hard_prohibitions);
 * the discrepancy is recorded in the ledger.
 *
 * Also: :8123 runs display_errors=On (php-mail.ini), so any PHP notice/warning
 * lands in the response body. This fetches every admin page through the logged-in
 * browser context and greps the served HTML for diagnostic signatures.
 *
 * Usage: node _harness/audit10-p3capture.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'audit10');
const SHOTS = path.join(OUT, 'current');

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'tablet-834', width: 834, height: 1112 },
  { name: 'mobile-390', width: 390, height: 844 },
];

// Every admin GET page, with the edit page at its REAL parameter name.
const PAGES = [
  ['/admin/index.php', 'admin_index.php'],
  ['/admin/content.php', 'admin_content.php'],
  ['/admin/settings.php', 'admin_settings.php'],
  ['/admin/add.php', 'admin_add.php'],
  ['/admin/edit.php?sku=CC', 'admin_edit.php_sku_CC'],
  ['/admin/backups.php', 'admin_backups.php'],
  ['/admin/password.php', 'admin_password.php'],
  ['/admin/inquiries.php', 'admin_inquiries.php'],
  ['/admin/audit-log.php', 'admin_audit-log.php'],
  ['/admin/help.php', 'admin_help.php'],
];

// PHP's display_errors output is always wrapped in one of these prefixes.
const DIAG = /(<br\s*\/?>\s*<b>)?\b(Warning|Fatal error|Parse error|Notice|Deprecated|Recoverable fatal error)\b\s*:\s/;

async function login(ctx) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
  if (await page.$('input[type="password"]')) {
    await page.fill('input[type="password"]', PASS);
    await Promise.all([page.waitForNavigation(), page.click('button[type="submit"], input[type="submit"]')]);
  }
  return page;
}

(async () => {
  const browser = await launch();
  const results = [];

  for (const vp of VIEWPORTS) {
    const dir = path.join(SHOTS, vp.name);
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await login(ctx);

    for (const [url, stem] of PAGES) {
      const consoleErrors = [];
      const onConsole = (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); };
      page.on('console', onConsole);

      const resp = await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
      const html = await page.content();
      const bodyText = await page.evaluate(() => document.body.innerText);
      const landed = page.url().replace(BASE, '');

      // Only capture the pages the main crawler could not reach correctly.
      if (url.includes('sku=CC')) {
        await page.screenshot({ path: path.join(dir, stem + '.png'), fullPage: true });
      }

      const diagLines = html.split('\n').filter((l) => DIAG.test(l)).map((l) => l.trim().slice(0, 240));
      const textDiag = bodyText.split('\n')
        .filter((l) => /^(Warning|Fatal error|Parse error|Notice|Deprecated):/.test(l.trim()))
        .map((l) => l.trim().slice(0, 240));

      results.push({
        viewport: vp.name,
        requested: url,
        landed,
        redirected: landed !== url,
        status: resp ? resp.status() : null,
        title: await page.title(),
        h1: await page.evaluate(() => {
          const h = document.querySelector('h1');
          return h ? h.textContent.trim() : null;
        }),
        htmlBytes: html.length,
        phpDiagnosticsInHtml: diagLines,
        phpDiagnosticsInText: textDiag,
        consoleErrors,
      });
      page.off('console', onConsole);
      process.stdout.write('.');
    }
    await ctx.close();
    console.log(' ' + vp.name + ' done');
  }

  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'p3capture.json'), JSON.stringify(results, null, 1));

  console.log('\n--- redirects ---');
  for (const r of results.filter((r) => r.redirected)) {
    console.log(`${r.viewport} ${r.requested} -> ${r.landed}  title="${r.title}" h1="${r.h1}"`);
  }
  console.log('--- php diagnostics in served HTML ---');
  const diag = results.filter((r) => r.phpDiagnosticsInHtml.length || r.phpDiagnosticsInText.length);
  if (!diag.length) console.log('none on any of ' + results.length + ' page loads');
  for (const r of diag) {
    console.log(`${r.viewport} ${r.requested} :: ` + JSON.stringify(r.phpDiagnosticsInHtml.concat(r.phpDiagnosticsInText)));
  }
  console.log('--- titles (desktop) ---');
  for (const r of results.filter((r) => r.viewport === 'desktop-1440')) {
    console.log(`${r.requested.padEnd(26)} | ${r.title} | h1: ${r.h1}`);
  }
  console.log('report -> _harness/out/audit10/p3capture.json');
})();
