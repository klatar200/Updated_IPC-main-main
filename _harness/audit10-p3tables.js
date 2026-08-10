/**
 * AUDIT-10 pass-3 — the three data tables (audit log, backups, inquiries) with
 * REAL ROWS in them.
 *
 * Why this is separate: on a fresh mirror all three are empty, so the pass-3
 * rubric line "tables readable or scrollable-in-place without page-level
 * horizontal scroll" cannot be measured at all. pass-0's candidate C-046 flagged
 * a 206px overflow on /admin/audit-log.php at mobile-390, which only appears
 * once the log has entries. Journeys A-D leave entries behind; this posts one
 * contact-form inquiry as well (mirror-only: public/contact.php appends to
 * _harness/site/admin/inquiries.jsonl, which is gitignored scratch and is NOT
 * one of the data/*.json files under the restore contract).
 *
 * Usage: node _harness/audit10-p3tables.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'audit10');
const ISSUES = path.join(OUT, 'issues');
fs.mkdirSync(ISSUES, { recursive: true });

const VIEWPORTS = [
  ['desktop-1440', 1440, 900], ['tablet-1024', 1024, 768],
  ['tablet-834', 834, 1112], ['mobile-390', 390, 844],
];
const PAGES = ['/admin/audit-log.php', '/admin/backups.php', '/admin/inquiries.php'];

const MEASURE = () => {
  const vw = document.documentElement.clientWidth;
  const tables = [...document.querySelectorAll('table')].map((t) => {
    let sc = t.parentElement, guard = 0, scrollable = false;
    while (sc && guard++ < 6) {
      if (/auto|scroll/.test(getComputedStyle(sc).overflowX)) { scrollable = true; break; }
      sc = sc.parentElement;
    }
    const r = t.getBoundingClientRect();
    return {
      width: Math.round(r.width), right: Math.round(r.right),
      minWidth: getComputedStyle(t).minWidth, layout: getComputedStyle(t).tableLayout,
      rows: t.querySelectorAll('tbody tr').length,
      offscreenPx: Math.round(Math.max(0, r.right - vw)),
      inScroller: scrollable,
      scrollerHiddenPx: scrollable ? Math.max(0, sc.scrollWidth - sc.clientWidth) : 0,
      headers: [...t.querySelectorAll('thead th')].map((th) => th.innerText.trim()),
      lastColumnRight: (() => {
        const td = t.querySelector('tbody tr td:last-child');
        return td ? Math.round(td.getBoundingClientRect().right) : null;
      })(),
    };
  });
  return {
    vw,
    overflowX: Math.round(document.documentElement.scrollWidth - vw),
    tables,
    emptyState: document.querySelector('.empty') ? document.querySelector('.empty').innerText.trim() : null,
    alert: document.querySelector('.alert') ? document.querySelector('.alert').innerText.replace(/\s+/g, ' ').trim().slice(0, 160) : null,
  };
};

(async () => {
  const browser = await launch();

  // One inquiry, so the Inquiries table has a row to measure.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const resp = await page.request.post(BASE + '/contact.php', {
      form: {
        name: 'AUDIT10 Pass-3 Probe',
        email: 'audit10-probe@example.invalid',
        company: 'AUDIT-10 Harness',
        phone: '555-0100',
        formType: 'quote',
        material: 'Polyolefin Heat Shrink',
        message: 'AUDIT-10 pass-3 table-measurement probe. Mirror only. Ignore.',
      },
    });
    console.log('contact.php POST ->', resp.status(), (await resp.text()).replace(/\s+/g, ' ').slice(0, 200));
    await ctx.close();
  }

  const results = [];
  for (const [name, w, h] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="password"]', PASS);
    await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')]);
    for (const url of PAGES) {
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      const m = await page.evaluate(MEASURE);
      results.push({ url, viewport: name, ...m });
      console.log(`${name} ${url} :: overflowX=${m.overflowX} ` + JSON.stringify(m.tables));
      const slug = url.replace('/admin/', '').replace('.php', '');
      await page.screenshot({ path: path.join(OUT, 'current', name, 'admin_' + slug + '.php__withdata.png'), fullPage: true });
      if (m.overflowX > 1) {
        await page.screenshot({ path: path.join(ISSUES, `A10-036__${name}__${slug}-table-overflows-viewport.png`) });
      }
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'p3tables.json'), JSON.stringify(results, null, 1));
  console.log('\nreport -> _harness/out/audit10/p3tables.json');
})();
