/**
 * Lows batch C — the public site (src/App.jsx): PUB-4, PUB-6, PUB-7, PUB-12,
 * NEW-N1-1, N1-2, N1-3, N1-8, N1-9, N1-10, N1-11, N1-12, N1-13, N1-14, N1-15,
 * N1-16, V1-2 (audit-runs/audit-2026-09-27.md).
 *
 * Own `php -S` on :8718 over the mirror, a real browser. Each arm writes the
 * data files it needs into the mirror and the finally restores all three from
 * pristine/. Needs a build that carries the fixes (npm run build + sync.sh).
 *
 *   node _harness/lowsC-public.js
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { launch } = require('./browser');

const SITE = path.join(__dirname, 'site');
const DATA = path.join(SITE, 'data');
const PRISTINE = path.join(__dirname, 'pristine');
const PORT = 8718;
const BASE = `http://127.0.0.1:${PORT}`;

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};
const load = (n) => JSON.parse(fs.readFileSync(path.join(PRISTINE, n), 'utf8'));
const put = (n, v) => fs.writeFileSync(path.join(DATA, n), JSON.stringify(v, null, 2));
const restore = () => { for (const n of ['products-all.json', 'content.json', 'site-info.json']) fs.copyFileSync(path.join(PRISTINE, n), path.join(DATA, n)); };

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`lowsC-public: port ${PORT} is already in use — stop that server first`);
    process.exit(2);
  }
  restore();
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, path.join(__dirname, 'router.php')], { cwd: SITE, stdio: 'ignore' });
  let browser = null;
  try {
    browser = await launch();
    await new Promise((r) => setTimeout(r, 800));
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const go = async (u) => { await page.goto(BASE + u, { waitUntil: 'networkidle' }); await page.waitForTimeout(250); };
    const crashed = async () => /Something went wrong/.test(await page.locator('body').innerText());
    // Real product rows only: the empty state is ALSO a <tr>, one colspan
    // cell that echoes the query ("No results for …") — which made every
    // "found it" check pass against unfixed code.
    const dashNames = () => page.$$eval('table tbody tr', (trs) => trs.filter((tr) => tr.querySelectorAll('td').length > 2)
      .map((tr) => tr.querySelector('td').innerText || '').filter(Boolean));
    const dashSearch = async (q) => {
      const box = page.locator('input[aria-label="Search products"]:visible').first();
      await box.fill(q);
      await page.waitForTimeout(250);
    };

    // ── PUB-4 / N1-3 ──
    // A product whose NAME appears in none of the other searched text — the
    // register's own example ("VT-1100 Heat Gun") is in its description, so it
    // passed against unfixed code.
    const cat0 = load('products-all.json');
    const other = (p) => [p.sku, p.partType, (p.description || []).join(' '), p.operatingTemp, p.specificationsSummary,
      JSON.stringify(p.specTable1 || ''), JSON.stringify(p.specTable2 || '')].join(' ').toLowerCase();
    // …and in no OTHER product's searched text either, or that row answers.
    const byName = cat0.find((p) => p.name && !cat0.some((q) => other(q).includes(p.name.toLowerCase())));
    await go('/dashboard');
    await dashSearch(byName.name);
    note((await dashNames()).some((n) => n.includes(byName.name)), `PUB-4: the Product Index finds a product by its full name ("${byName.name}")`);
    await dashSearch(byName.sku.toLowerCase() + '   ');
    note((await dashNames()).some((n) => n.includes(byName.name)), `N1-3: a pasted part number with trailing spaces ("${byName.sku.toLowerCase()}   ") still finds it`);

    // ── N1-2 ──
    await go('/dashboard');
    const chips = page.locator('button[aria-pressed]');
    const nChips = await chips.count();
    let emptied = false;
    for (let i = 0; i < nChips && !emptied; i++) {
      await chips.nth(i).click();
      await page.waitForTimeout(100);
      emptied = /No results/.test(await page.locator('body').innerText());
    }
    const clearBtn = page.getByRole('button', { name: 'Clear all filters' });
    const hasClear = emptied && (await clearBtn.count()) > 0;
    if (hasClear) { await clearBtn.first().click(); await page.waitForTimeout(200); }
    const pressedAfter = await page.locator('button[aria-pressed="true"]').count();
    note(emptied && hasClear && pressedAfter === 0 && (await dashNames()).length > 10,
      'N1-2: when approval chips alone empty the index, "Clear all filters" is offered and clears them too',
      `emptied ${emptied}, button ${hasClear}, chips still on ${pressedAfter}`);

    // ── N1-11 ──
    await go('/dashboard?family=NoSuchFamily');
    const rowsUnknown = (await dashNames()).length;
    note(rowsUnknown > 10, 'N1-11: an unknown ?family= shows the whole index, matching the "All" the select shows', `${rowsUnknown} rows`);

    // ── N1-12 ──
    await go('/dashboard');
    await dashSearch('zzzz-nothing');
    await page.locator('button[aria-haspopup="true"]').first().hover();   // the family links render in the open menu
    await page.waitForTimeout(200);
    const famLink = await page.$$eval('a[href*="/dashboard?family="]', (as) => as.map((a) => a.getAttribute('href')));
    if (famLink.length) {
      await page.evaluate((href) => { const a = document.querySelector(`a[href="${href}"]`); a.click(); }, famLink[0]);
      await page.waitForTimeout(400);
      const q = await page.locator('input[aria-label="Search products"]:visible').first().inputValue();
      note(q === '' && (await dashNames()).length > 0, 'N1-12: picking a family from the navbar on /dashboard clears the old search', `search "${q}"`);
    } else {
      note(false, 'N1-12: a navbar link to /dashboard?family= exists to test with', 'none found');
    }

    // ── N1-9 ──
    const c9 = load('content.json');
    const fams = (c9.productFamilies || []).map((r) => r.name);
    c9.productFamilies = [...fams].reverse().map((name) => ({ name }));
    put('content.json', c9);
    await go('/dashboard');
    const pills = (await page.$$eval('button.ipc-tap', (bs) => bs.map((b) => b.innerText.replace(/\s*\d+\s*$/, '').trim()))).filter((t) => t && t !== 'All');
    const want = [...fams].reverse().filter((f) => pills.includes(f));
    note(pills.length > 2 && JSON.stringify(pills.slice(0, want.length)) === JSON.stringify(want),
      'N1-9: the Product Index pills follow the Product Families order', `pills ${pills.slice(0, 4).join(', ')} … want ${want.slice(0, 4).join(', ')}`);
    await go('/datasheets');
    const heads = await page.$$eval('main h2, main h3', (hs) => hs.map((h) => h.innerText.split('\n')[0].trim()));
    const order = heads.filter((h) => fams.includes(h));
    const wantDs = [...fams].reverse().filter((f) => order.includes(f));
    note(order.length > 2 && JSON.stringify(order) === JSON.stringify(wantDs), 'N1-9: /datasheets groups follow the Product Families order', order.slice(0, 4).join(', '));
    restore();

    // ── N1-10 ──
    const c10 = load('content.json');
    (c10.services || []).forEach((s, i) => { s.leadTime = `${i + 2} weeks`; });
    put('content.json', c10);
    await go('/services');
    const shown = (await page.locator('main').innerText()).match(/Lead time: \d+ weeks/g) || [];
    note(/Varies by service/.test(await page.locator('main').innerText()) && shown.length === (c10.services || []).length,
      'N1-10: when lead times differ, every service card shows its own', `${shown.length} of ${(c10.services || []).length}`);
    restore();

    // ── N1-13 ──
    const c13 = load('content.json');
    const extra = JSON.parse(JSON.stringify(c13.industryDetail[0]));
    extra.name = 'Sixth Industry';
    c13.industryDetail.push(extra);
    put('content.json', c13);
    await go('/industries');
    const ids = await page.$$eval('[id^="industry-"]', (els) => els.map((e) => e.id));
    note(ids.length === c13.industryDetail.length && new Set(ids).size === ids.length, 'N1-13: industry sections sharing an icon get distinct anchor ids', ids.join(', '));
    restore();

    // ── N1-14 ──
    const p14 = load('products-all.json');
    p14.find((p) => p.sku === 'VT-1100').operatingTemp = '250°F – 1,100°F';
    put('products-all.json', p14);
    await go('/dashboard');
    await page.click('button[data-sort-key="operatingTemp"]');
    await page.waitForTimeout(200);
    // Sorted hottest first, VT-1100 is 2nd (the register's own figure: "21st of
    // 42 instead of 2nd" — Fiberglass Sleeving rates higher).
    const top2 = async () => (await dashNames()).slice(0, 2).some((n) => /VT-1100/.test(n));
    let names = await dashNames();
    if (!(await top2())) { await page.click('button[data-sort-key="operatingTemp"]'); await page.waitForTimeout(200); names = await dashNames(); }
    note(await top2(), 'N1-14: "250°F – 1,100°F" sorts among the hottest ratings (1,100°F read as 1100, not 100)', `top: ${names.slice(0, 3).join(' | ')}`);
    restore();

    // ── PUB-6 / N1-1 / V1-2 ──
    const p6 = load('products-all.json');
    p6.find((p) => p.sku === 'IP35KY').name = { x: 1 };
    p6.find((p) => p.sku === 'CC').caption = { x: 1 };
    put('products-all.json', p6);
    for (const u of ['/products', '/products?productId=IP35KY', '/products?productId=CC', '/dashboard', '/']) {
      await go(u);
      // No <main> at all is the failure (the whole root unmounted), so read it tolerantly.
      const mainText = await page.locator('main').innerText({ timeout: 2000 }).catch(() => '');
      note(!(await crashed()) && mainText.length > 200, `PUB-6/N1-1: ${u} renders with a malformed product row`);
    }
    restore();

    // ── V1-2 ── on its own data: with the malformed rows above, the unfixed
    // bundle crashes the whole page and "no dead link" passes on an empty page.
    const pv = load('products-all.json');
    pv.find((p) => p.sku === 'CC90').pdfUrl = '//evil.example/x.pdf';
    put('products-all.json', pv);
    await go('/products?productId=CC90');
    const rendered = /90° Conduit Connectors/.test(await page.locator('main').innerText({ timeout: 2000 }).catch(() => ''));
    const dead = await page.$$eval('a', (as) => as.filter((a) => /data\s*sheet/i.test(a.innerText) && !a.getAttribute('href')).length);
    note(rendered && dead === 0, 'V1-2: a refused data-sheet link leaves no dead "Datasheet" button', `rendered ${rendered}, ${dead} dead`);
    restore();

    // ── PUB-7 ──
    // A record whose id is NOT its SKU — what 6 shipped products were before
    // NEW-V2-1 normalised them, and what a restored older backup still holds.
    const p7 = load('products-all.json');
    const r7 = p7.find((p) => p.sku === 'IP12GA-IP1274');
    r7.id = 'IP12GA - IP1274';
    put('products-all.json', p7);
    await go('/products?productId=' + encodeURIComponent('IP12GA - IP1274'));
    const ld = await page.$$eval('script[type="application/ld+json"]', (ss) => ss.map((s) => s.textContent));
    const prod = ld.map((t) => { try { return JSON.parse(t); } catch { return null; } }).find((d) => d && d['@type'] === 'Product');
    note(prod && prod.sku === 'IP12GA-IP1274', 'PUB-7: the Product JSON-LD sku is the product\'s SKU even when its id differs', prod ? prod.sku : 'no Product JSON-LD');
    restore();

    // ── PUB-12 ──
    await go('/index.html');
    const robots = await page.$eval('meta[name="robots"]', (m) => m.content).catch(() => '');
    note(!/Page not found/i.test(await page.locator('main').innerText()) && !/noindex/.test(robots) && new URL(page.url()).pathname === '/',
      '/index.html is the homepage (no "Page not found", no noindex, address becomes /)'.replace(/^/, 'PUB-12: '), `robots "${robots}", url ${page.url()}`);

    // ── N1-15 / N1-16 ──
    const si = load('site-info.json');
    si.contact.phone = '312.555.0199';
    si.certifications.other = 'UL';
    si.about.paragraphs = 'A single string where a list belongs.';
    put('site-info.json', si);
    await go('/about');
    const tels = await page.$$eval('a[href^="tel:"]', (as) => as.map((a) => a.getAttribute('href')));
    note(tels.length > 0 && tels.every((t) => t === 'tel:+13125550199'), 'N1-15: a changed phone dials the new number when the dial field was left as shipped', [...new Set(tels)].join(', '));
    const foot = await page.locator('footer').innerText();
    note(!(await crashed()) && !/U · L/.test(foot), 'N1-16: a string where a list belongs neither crashes /about nor spreads into "U · L"');
    restore();

    // ── N1-8 ──
    await go('/');
    const trigger = page.locator('button[aria-haspopup="true"]').first();
    await trigger.hover();
    await page.waitForTimeout(80);
    await trigger.click();
    await page.waitForTimeout(150);
    note((await trigger.getAttribute('aria-expanded')) === 'true', 'N1-8: hovering then clicking the desktop menu leaves it open');
  } finally {
    if (browser) await browser.close();
    srv.kill();
    restore();
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nlowsC-public ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
