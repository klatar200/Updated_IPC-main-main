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
 *   2. The six single-purpose pages — Password, Delete, Upload PDF, Upload
 *      Image, Site Images & Logo, Catalog & Brochure PDFs — must NOT grow. They are one file field or one confirm button;
 *      80% of an ultrawide screen would stretch a 440px dialog across the
 *      whole display. They opt out by simply not carrying `.admin-wide`, and
 *      this suite is what stops someone adding the class "for consistency".
 *
 * It also checks that the extraction did not leave a page unstyled: every page,
 * wide and narrow, must still resolve the shared body background and, where it
 * has one, a .card with the shared white fill; and on every page admin_head()'s
 * shared <style> must come first (invariant 15). A page whose <style> was over-trimmed
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
  ['site-images.php', 'Site Images & Logo', 600],   // 2026-09-29
  ['marketing-pdfs.php', 'Catalog & Brochure PDFs', 600],   // 2026-10-05, WHATS_LEFT §1ap G1
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
        // Invariant 15: admin_head()'s shared <style> (it carries the
        // "THE container rule" comment) must come before the page's own.
        sharedFirst: (() => { const st = [...document.querySelectorAll('style')]; return st.length > 0 && st[0].textContent.includes('THE container rule'); })(),
      };
    });
    await pg.close();
    return m;
  };

  // On EVERY page, wide and narrow (AUDIT-12 A12-L13-01-3: the body check ran
  // on the wide pages only and cardBg was never read; A12-L13-W1-R2-1-3: the
  // admin_head() ordering was only caught where it changed a narrow page's
  // width).
  const stylesOk = (label, rows) => {
    const m0 = rows[0][1];
    ok(rows.every(([, m]) => m.bodyBg === 'rgb(240, 244, 248)' && (m.cardBg === null || m.cardBg === 'rgb(255, 255, 255)')),
      `${label.padEnd(17)} shared body background and .card fill still resolve (${m0.bodyBg}, card ${m0.cardBg})`);
    ok(rows.every(([, m]) => m.sharedFirst), `${label.padEnd(17)} admin_head() is echoed before the page's own <style> (invariant 15)`);
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
    stylesOk(label, rows);
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
    stylesOk(label, rows);
  }

  fs.writeFileSync(path.join(OUT, 'adminwidth.json'),
    JSON.stringify({ pass, fail }, null, 2));
  console.log(`\nadminwidth ${pass}/${pass + fail}`);
  await b.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
