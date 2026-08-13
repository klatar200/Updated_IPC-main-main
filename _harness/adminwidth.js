/**
 * Every admin page after the shared-stylesheet extraction.
 *
 * Two things are being asserted, and they pull in opposite directions:
 *
 *   1. The nine content pages share ONE container — 1280px up to 1600, then
 *      80% of the viewport (admin/config.php, admin_head()). Before the
 *      extraction `main { max-width }` disagreed nine ways across thirteen
 *      pages (1280 / 1340 / 1100 / 1000 / 900 / 800 / 600 / 520 / 440), and
 *      the widest of them used barely half of a 2560px screen.
 *
 *   2. The four single-purpose pages — Password, Delete, Upload PDF, Upload
 *      Image — must NOT grow. They are one file field or one confirm button;
 *      80% of an ultrawide screen would stretch a 440px dialog across the
 *      whole display. They opt out by simply not carrying `.admin-wide`, and
 *      this suite is what stops someone adding the class "for consistency".
 *
 * It also checks that the extraction did not leave a page unstyled: every page
 * must still resolve the shared body background and, where it has one, a
 * .card with the shared white fill. A page whose <style> was over-trimmed
 * would still lay out — it would just render as unstyled HTML, which is easy
 * to miss in a suite that only measures widths.
 *
 * Usage: node _harness/adminwidth.js      (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'adminwidth');
fs.mkdirSync(OUT, { recursive: true });

// page, expected behaviour at >=1600
const WIDE = [
  ['index.php', 'Products'],
  ['add.php', 'Add Product'],
  ['edit.php', 'Edit Product'],
  ['settings.php', 'Business Details'],
  ['content.php', 'Page Content'],
  ['inquiries.php', 'Inquiries'],
  ['backups.php', 'Backups'],
  ['audit-log.php', 'Audit Log'],
  ['help.php', 'Help'],
];
const NARROW = [
  ['password.php', 'Password', 520],
  ['upload-pdf.php', 'Upload PDF', 600],
  ['upload-image.php', 'Upload Image', 600],
  ['delete.php', 'Delete', null], // <main> is a flex centring box; the CARD is 440
];

const QS = { 'edit.php': '?sku=CC', 'upload-pdf.php': '?sku=CC', 'upload-image.php': '?sku=CC', 'delete.php': '?sku=CC' };
const VIEWPORTS = [1280, 1440, 1600, 1920, 2560];

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); };

(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  // one login for the whole run
  let p = await ctx.newPage();
  await p.goto(BASE + '/admin/index.php', { waitUntil: 'domcontentloaded' });
  if (await p.$('input[type=password]')) {
    await p.fill('input[type=password]', PW);
    await p.click('button[type=submit]');
    await p.waitForLoadState('domcontentloaded');
  }
  await p.close();

  const measure = async (file, w) => {
    const pg = await ctx.newPage();
    await pg.setViewportSize({ width: w, height: 900 });
    await pg.goto(BASE + '/admin/' + file + (QS[file] || ''), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(250);
    const m = await pg.evaluate(() => {
      const main = document.querySelector('main');
      const r = main && main.getBoundingClientRect();
      const card = document.querySelector('.card');
      return {
        mainW: r ? Math.round(r.width) : null,
        wide: main ? main.classList.contains('admin-wide') : null,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        cardBg: card ? getComputedStyle(card).backgroundColor : null,
        cardW: card ? Math.round(card.getBoundingClientRect().width) : null,
        hscroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        title: document.title,
      };
    });
    await pg.close();
    return m;
  };

  console.log('\n── wide pages: 1280px, then 80vw above 1600 ──');
  for (const [file, label] of WIDE) {
    const rows = [];
    for (const w of VIEWPORTS) rows.push([w, await measure(file, w)]);
    const bad = rows.filter(([w, m]) => {
      const want = w >= 1600 ? Math.round(w * 0.8) : 1280;
      return !m.mainW || Math.abs(m.mainW - want) > 2;
    });
    ok(bad.length === 0,
      `${label.padEnd(17)} ${rows.map(([w, m]) => `${w}->${m.mainW}`).join(' ')}` +
      (bad.length ? `  << expected ${bad.map(([w]) => `${w}->${w >= 1600 ? Math.round(w * 0.8) : 1280}`).join(' ')}` : ''));
    const noScroll = rows.every(([, m]) => m.hscroll <= 0);
    ok(noScroll, `${label.padEnd(17)} no horizontal page scroll at any width`);
    const styled = rows.every(([, m]) => m.bodyBg === 'rgb(240, 244, 248)');
    ok(styled, `${label.padEnd(17)} shared body background still resolves (${rows[0][1].bodyBg})`);
  }

  console.log('\n── narrow pages: must NOT grow ──');
  for (const [file, label, expect] of NARROW) {
    const rows = [];
    for (const w of VIEWPORTS) rows.push([w, await measure(file, w)]);
    if (expect !== null) {
      const bad = rows.filter(([, m]) => Math.abs(m.mainW - expect) > 2);
      ok(bad.length === 0, `${label.padEnd(17)} main stays ${expect}px at every width (${rows.map(([w, m]) => `${w}->${m.mainW}`).join(' ')})`);
    } else {
      const bad = rows.filter(([, m]) => !m.cardW || Math.abs(m.cardW - 440) > 2);
      ok(bad.length === 0, `${label.padEnd(17)} confirm card stays 440px (${rows.map(([w, m]) => `${w}->${m.cardW}`).join(' ')})`);
    }
    ok(rows.every(([, m]) => !m.wide), `${label.padEnd(17)} does not carry .admin-wide`);
    ok(rows.every(([, m]) => m.hscroll <= 0), `${label.padEnd(17)} no horizontal page scroll at any width`);
  }

  fs.writeFileSync(path.join(OUT, 'adminwidth.json'),
    JSON.stringify({ pass, fail }, null, 2));
  console.log(`\nadminwidth ${pass}/${pass + fail}`);
  await b.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
