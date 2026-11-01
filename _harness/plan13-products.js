/**
 * PLAN-13 Phase 5 — the Products list (admin/index.php, admin/search.js).
 *
 *   R1  "Missing Photo" counts the products with no photo on the server, and
 *       exactly those rows say "No photo"; the PDF chips agree with the
 *       "Missing PDF" card (§2 E3)
 *   R2  category chips: one chip per category plus All; a chip shows only
 *       its category, the search works inside it, All brings everything
 *       back; without JavaScript a chip is a link to its section (E4)
 *   R3  the More menu: opens by keyboard, one at a time, closes on Escape
 *       (focus back on More) and on a click elsewhere; with JavaScript off
 *       it still opens (E1)
 *   R4  Delete still goes through delete.php: the dialog names the SKU, and
 *       accepting it lands on the confirmation page with nothing deleted
 *
 * plan10-adminrows covers reach (every action on screen and hit-testable at
 * four widths) and admin-ux U5 the phone. Saves nothing.
 * Usage: node _harness/plan13-products.js      (needs :8123)
 */
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const PRODUCTS = require(path.join(__dirname, 'site', 'site-data', 'products-all.json'));
const LIST = Array.isArray(PRODUCTS) ? PRODUCTS : PRODUCTS.products;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); };

(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => ok(false, `page error: ${e.message}`));
  await p.goto(BASE + '/admin/auth.php', { waitUntil: 'domcontentloaded' });
  await p.fill('input[type=password]', PW);
  await p.click('button[type=submit]');
  await p.waitForLoadState('domcontentloaded');
  const open = () => p.goto(BASE + '/admin/index.php', { waitUntil: 'networkidle' });

  console.log('\n── R1 photo and PDF status ──');
  await open();
  {
    const r = await p.evaluate(() => {
      const stat = (l) => +([...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-lbl').textContent.trim() === l) || { innerText: 'NaN' }).querySelector('.stat-val').textContent;
      const rowsWith = (re) => [...document.querySelectorAll('tr[data-search]')].filter((tr) => [...tr.querySelectorAll('.chip')].some((c) => re.test(c.textContent.trim()))).map((tr) => tr.querySelector('.sku').textContent.trim());
      return { missingPhoto: stat('Missing Photo'), missingPdf: stat('Missing PDF'),
        noPhoto: rowsWith(/^(No photo|Photo missing)$/), noPdf: rowsWith(/^(No PDF|PDF missing)$/),
        thumbs: document.querySelectorAll('tr[data-search] img.thumb').length };
    });
    const empty = LIST.filter((x) => !String(x.photoUrl || '').trim()).map((x) => x.sku).sort();
    ok(r.missingPhoto === r.noPhoto.length && empty.every((s) => r.noPhoto.includes(s)),
      `Missing Photo ${r.missingPhoto}; rows saying so: ${r.noPhoto.join(', ')}`);
    ok(r.thumbs === LIST.length - r.noPhoto.length, `${r.thumbs} thumbnails for ${LIST.length - r.noPhoto.length} products with a photo`);
    ok(r.missingPdf === r.noPdf.length, `Missing PDF ${r.missingPdf}; rows saying so: ${r.noPdf.length}`);
  }

  console.log('\n── R2 category chips ──');
  {
    const chips = await p.evaluate(() => [...document.querySelectorAll('.cat-chips a')].map((a) => ({ cat: a.dataset.cat, text: a.textContent.trim(), href: a.getAttribute('href') })));
    const cats = new Set(LIST.map((x) => x.partType || 'Other'));
    ok(chips.length === cats.size + 1 && chips[0].cat === '', `${chips.length} chips: All + ${cats.size} categories`);
    const target = chips.find((c) => /Extruded Tubing/.test(c.text)) || chips[2];
    await p.click(`.cat-chips a[data-cat="${target.cat}"]`);
    let r = await p.evaluate(() => ({
      shown: [...document.querySelectorAll('section[data-section]')].filter((s) => s.style.display !== 'none').map((s) => s.id),
      rows: [...document.querySelectorAll('tr[data-search]')].filter((t) => t.style.display !== 'none').length,
      count: document.getElementById('searchCount').textContent,
      current: (document.querySelector('.cat-chips a[aria-current="true"]') || {}).textContent,
    }));
    const n = +target.text.match(/(\d+)\s*$/)[1];
    ok(r.shown.length === 1 && r.shown[0] === target.cat && r.rows === n && r.current === target.text,
      `"${target.text}": ${r.shown.length} section, ${r.rows} rows, count "${r.count}"`);
    await p.fill('#productSearch', 'IP');
    await p.waitForTimeout(100);
    r = await p.evaluate(() => [...document.querySelectorAll('tr[data-search]')].filter((t) => t.style.display !== 'none').map((t) => t.closest('section').id));
    ok(r.length > 0 && r.every((id) => id === target.cat), `search "IP" inside the category: ${r.length} rows, all in it`);
    await p.fill('#productSearch', '');
    await p.click('.cat-chips a[data-cat=""]');
    r = await p.evaluate(() => [...document.querySelectorAll('tr[data-search]')].filter((t) => t.style.display !== 'none').length);
    ok(r === LIST.length, `All shows all ${r} rows again`);

    const off = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    await off.addCookies(await ctx.cookies());
    const q = await off.newPage();
    await q.goto(BASE + '/admin/index.php', { waitUntil: 'domcontentloaded' });
    const ids = await q.evaluate(() => [...document.querySelectorAll('.cat-chips a')].slice(1).every((a) => !!document.getElementById(a.getAttribute('href').slice(1))));
    await q.click(`.cat-chips a[data-cat="${target.cat}"]`);
    await q.waitForTimeout(200);
    const top = await q.evaluate((id) => Math.round(document.getElementById(id).getBoundingClientRect().top), target.cat);
    // JS off: the More menu is a plain <details> and still opens.
    await q.click('tr[data-search] details.row-more > summary');
    const offMenu = await q.evaluate(() => [...document.querySelector('tr[data-search] .row-more-menu').querySelectorAll('a')].filter((a) => a.getBoundingClientRect().height > 0).length);
    await off.close();
    ok(ids && top >= 0 && top < 200, `JavaScript off: every chip links to its section; "${target.text}" jumps there (top ${top}px)`);
    ok(offMenu === 4, `JavaScript off: More opens and shows its ${offMenu} links (R3)`);
  }

  console.log('\n── R3 the More menu ──');
  await open();
  {
    const sums = p.locator('tr[data-search] details.row-more > summary');
    await sums.nth(0).focus();
    await p.keyboard.press('Enter');
    let r = await p.evaluate(() => [...document.querySelectorAll('details.row-more')].map((d) => d.open).filter(Boolean).length);
    ok(r === 1, `Enter on More opens its menu (${r} open)`);
    // From the keyboard: the open menu overlays the next row's More, as a
    // drop-down does, so a mouse click there lands on the menu.
    await sums.nth(1).focus();
    await p.keyboard.press('Enter');
    r = await p.evaluate(() => ({ open: [...document.querySelectorAll('details.row-more')].map((d, i) => d.open ? i : -1).filter((i) => i >= 0) }));
    ok(r.open.length === 1 && r.open[0] === 1, `opening a second menu closes the first (open: ${r.open.join(',')})`);
    await p.keyboard.press('Escape');
    r = await p.evaluate(() => ({ open: document.querySelectorAll('details.row-more[open]').length, focus: document.activeElement.tagName + ' ' + (document.activeElement.getAttribute('aria-label') || '') }));
    ok(r.open === 0 && /^SUMMARY More actions for/.test(r.focus), `Escape closes it and focus returns to "${r.focus}"`);
    await sums.nth(2).click();
    await p.mouse.click(5, 600);
    r = await p.evaluate(() => document.querySelectorAll('details.row-more[open]').length);
    ok(r === 0, 'a click elsewhere closes it');
  }

  console.log('\n── R4 Delete still goes through delete.php ──');
  await open();
  {
    const sku = await p.evaluate(() => document.querySelector('tr[data-search] .sku').textContent.trim());
    let msg = null;
    p.once('dialog', async (d) => { msg = d.message(); await d.accept(); });
    await p.locator('tr[data-search]').first().locator('details.row-more > summary').click();
    await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.locator('tr[data-search]').first().locator('a.danger').click()]);
    const url = p.url();
    const body = await p.evaluate(() => document.body.innerText);
    ok(msg && msg.includes(sku) && /Backups/.test(msg), `the dialog names ${sku} and points at Backups`);
    ok(/\/admin\/delete\.php\?sku=/.test(url) && new RegExp(sku).test(body), `accepting it opens ${url.replace(BASE, '')}, the confirmation page — nothing deleted yet`);
    const still = await (await ctx.request.get(BASE + '/site-data/products-all.json')).json();
    const list = Array.isArray(still) ? still : still.products;
    ok(list.some((x) => x.sku === sku), `${sku} is still in the catalog`);
  }

  await b.close();
  console.log(`\nplan13-products ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
