/**
 * AUDIT-10 pass-7 — A10-027 re-verification, driven the way the record's own
 * reproduce steps describe: open /admin/content.php, change a field belonging to
 * the Privacy Policy section, press SAVE CONTENT (by its visible label, not the
 * first submit button on the page), then read the newest /admin/audit-log.php row.
 *
 * MUTATES MIRROR DATA. The caller restores _harness/site/data/ from
 * _harness/pristine/ and removes the backup files the save creates; pass-7 does
 * that and cmp-checks it byte-for-byte.
 *
 * Output: _harness/out/audit10/p7/journey.json
 * Usage:  node _harness/audit10-p7journey.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'audit10', 'p7');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const out = {};

  await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="password"]', PASS);
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                     page.click('button[type="submit"], input[type="submit"]')]);
  out.signedIn = !(await page.$('input[type="password"]'));

  await page.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });

  out.submitControls = await page.evaluate(`(() => [...document.querySelectorAll(
    'form button, form input[type=submit]')].map(b=>({tag:b.tagName,type:b.type,
      name:b.name||null,text:(b.textContent||b.value||'').replace(/\\s+/g,' ').trim().slice(0,40)})))()`);

  const target = await page.evaluate(`(() => {
    const f=[...document.querySelectorAll('input[name],textarea[name]')]
      .find(e=>/privacy/i.test(e.name) && e.type!=='hidden');
    return f?{name:f.name,tag:f.tagName,was:f.value}:null;
  })()`);
  out.field = target;
  if (!target) { out.error = 'no privacy field'; return finish(); }

  const MARK = 'AUDIT10 PASS7 REVERIFY';
  await page.fill(`[name="${target.name}"]`, MARK);

  // The record says "press Save Content" — find it by label, and submit the form
  // that field actually belongs to.
  const clicked = await page.evaluate(`(() => {
    const f=document.querySelector('[name="${target.name}"]');
    const form=f.form;
    const btn=[...form.querySelectorAll('button,input[type=submit]')]
      .find(b=>/save content/i.test((b.textContent||b.value||'')));
    if(!btn) return null;
    btn.scrollIntoView({block:'center'});
    return {text:(btn.textContent||btn.value).replace(/\\s+/g,' ').trim(),
            formAction:form.getAttribute('action')||location.pathname,
            fieldCount:form.querySelectorAll('[name]').length};
  })()`);
  out.saveButton = clicked;
  if (!clicked) { out.error = 'no Save Content button'; return finish(); }

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => { out.navError = String(e).split('\n')[0]; }),
    page.evaluate(`(() => {
      const f=document.querySelector('[name="${target.name}"]');
      const btn=[...f.form.querySelectorAll('button,input[type=submit]')]
        .find(b=>/save content/i.test((b.textContent||b.value||'')));
      btn.click();
    })()`),
  ]);
  await page.waitForTimeout(1200);

  out.afterSave = await page.evaluate(`(() => ({
    url:location.pathname+location.search,
    banners:[...document.querySelectorAll('.alert,.success,.error-list,.notice,[class*=flash]')]
      .map(e=>e.textContent.replace(/\\s+/g,' ').trim().slice(0,180)).filter(Boolean).slice(0,6),
    fieldNow:(document.querySelector('[name="${target.name}"]')||{}).value||null
  }))()`);

  await page.goto(BASE + '/admin/audit-log.php', { waitUntil: 'domcontentloaded' });
  out.log = await page.evaluate(`(() => {
    const rows=[...document.querySelectorAll('table tr')].map(tr=>
      [...tr.children].map(c=>c.textContent.replace(/\\s+/g,' ').trim()));
    return {rowCount:rows.length,rows:rows.slice(0,5),
            emptyBanner:[...document.querySelectorAll('.empty,.alert')]
              .map(e=>e.textContent.replace(/\\s+/g,' ').trim().slice(0,140))};
  })()`);

  function finish() {}
  await browser.close();

  const dataRows = (out.log && out.log.rows || []).slice(1);
  out.newestEntry = dataRows[0] || null;
  out.reproduces = !!(out.newestEntry && out.newestEntry.join(' | ').toLowerCase().includes('homepage'));
  fs.writeFileSync(path.join(OUT, 'journey.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log('\nA10-027 ' + (out.reproduces ? 'REPRODUCES' : 'DOES NOT REPRODUCE'));
})();
