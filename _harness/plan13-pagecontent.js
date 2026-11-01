/**
 * PLAN-13 Phase 4 — Page Content regrouped by public page ($PAGE_MAP in
 * admin/content.php), with a "Find a box" filter, the section strip and
 * Hide/Show from longform.js, and labels split into label + hint.
 *
 *   P1  twelve page groups, in site order, and every one of the 33 sections
 *       inside one of them (none fell through to "Everything else")
 *   P2  sections land on their own page (proof points under Homepage, the
 *       team under About, the tips under Contact, the menus together)
 *   P3  the posted field names are identical with JavaScript on and off,
 *       and form_complete is still the last one
 *   P4  Save with nothing changed writes nothing: "No changes to save" and
 *       content.json byte-identical
 *   P5  no label still carries its rule in brackets; the rules are hints
 *   P6  the filter narrows to matching boxes, pages and strip links, says how
 *       many, clears on Escape, and does not mark the page as changed
 *   P7  boxes the filter hides are still in the POST
 *   P8  the strip is one row at 1440 and a link lands its page below it;
 *       editing an FAQ row dots the FAQ link
 *
 * Saves nothing (P4's Save is a no-op by construction and is checked to be).
 * Usage: node _harness/plan13-pagecontent.js      (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const CONTENT = path.join(__dirname, 'site', 'site-data', 'content.json');
const ORDER = ['homepage', 'families', 'services', 'industries', 'about', 'datasheets',
  'faq', 'contact', 'privacy', 'menus', 'seo', 'sitewide'];

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); };
const sha = () => crypto.createHash('sha256').update(fs.readFileSync(CONTENT)).digest('hex');

(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => ok(false, `page error: ${e.message}`));
  await p.goto(BASE + '/admin/index.php', { waitUntil: 'domcontentloaded' });
  if (await p.$('input[type=password]')) {
    await p.fill('input[type=password]', PW);
    await p.click('button[type=submit]');
    await p.waitForLoadState('domcontentloaded');
  }
  const open = async () => { await p.goto(BASE + '/admin/content.php', { waitUntil: 'networkidle' }); };
  const names = () => [...document.querySelector('form[data-long-form]').elements].filter((e) => e.name).map((e) => e.name);

  console.log('\n── P1/P2 grouped by public page, in site order ──');
  await open();
  const g = await p.evaluate(() => ({
    ids: [...document.querySelectorAll('form > .page-group')].map((s) => s.id.replace(/^page-/, '')),
    fieldsets: document.querySelectorAll('form fieldset.card').length,
    loose: [...document.querySelectorAll('form fieldset.card')].filter((f) => !f.closest('.page-group')).length,
    where: Object.fromEntries([...document.querySelectorAll('fieldset[data-section]')].map((f) => [f.dataset.section, f.closest('.page-group').id.replace(/^page-/, '')])),
  }));
  ok(JSON.stringify(g.ids) === JSON.stringify(ORDER), `page groups: ${g.ids.join(', ')}`);
  ok(g.fieldsets === 33 && g.loose === 0, `${g.fieldsets} sections, ${g.loose} outside a page group`);
  const expect = { heroProofPoints: 'homepage', heroTrust: 'homepage', stats: 'homepage', features: 'homepage', markets: 'homepage',
    productFamilies: 'families', services: 'services', industryDetail: 'industries', milestones: 'about', capabilities: 'about',
    certs: 'about', faq: 'faq', contactTips: 'contact', privacySections: 'privacy', companyNav: 'menus', footerLinks: 'menus', seo: 'seo' };
  const wrong = Object.entries(expect).filter(([s, pg]) => g.where[s] !== pg).map(([s]) => `${s}→${g.where[s]}`);
  ok(wrong.length === 0, `all 17 lists on their own page${wrong.length ? ': ' + wrong.join(', ') : ''}`);

  console.log('\n── P3 the POST is unchanged ──');
  const onNames = await p.evaluate(names);
  {
    const off = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    await off.addCookies(await ctx.cookies());
    const q = await off.newPage();
    await q.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
    const offNames = await q.evaluate(names);
    const offUi = await q.evaluate(() => ({ strip: !!document.querySelector('.form-index'), filter: !!document.querySelector('.form-filter'), groups: document.querySelectorAll('.page-group').length }));
    await off.close();
    ok(onNames.join('|') === offNames.join('|'), `${onNames.length} posted fields, identical with JavaScript on and off`);
    ok(onNames[onNames.length - 1] === 'form_complete', `last posted field: ${onNames[onNames.length - 1]}`);
    ok(!offUi.strip && !offUi.filter && offUi.groups === 12, `JavaScript off: no strip, no filter, ${offUi.groups} page groups`);
  }

  console.log('\n── P4 an unchanged save writes nothing ──');
  {
    // The first save of a content.json that lacks newer keys writes their
    // defaults (the committed code does the same: measured byte-identical
    // 2026-11-01). So: save once to settle the file, then the second save
    // of the regrouped form must change nothing. The file and its backup
    // folder are put back afterwards.
    const dir = path.dirname(CONTENT);
    const orig = fs.readFileSync(CONTENT);
    const backups = new Set(fs.readdirSync(dir));
    const save = async () => {
      await open();
      await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.click('.save-bar button[type=submit]')]);
      return p.evaluate(() => (document.querySelector('.alert-info, .alert-success, .error-list') || { textContent: '' }).textContent.trim());
    };
    try {
      await save();
      const before = sha();
      const banner = await save();
      ok(/^No changes to save/.test(banner) && sha() === before, `second save: "${banner.slice(0, 40)}…", content.json ${sha() === before ? 'byte-identical' : 'CHANGED'}`);
    } finally {
      fs.writeFileSync(CONTENT, orig);
      for (const f of fs.readdirSync(dir)) if (!backups.has(f) && /^content\.backup\./.test(f)) fs.unlinkSync(path.join(dir, f));
    }
  }

  console.log('\n── P5 labels without their rules; the rules as hints ──');
  await open();
  {
    const r = await p.evaluate(() => {
      const own = (l) => [...l.childNodes].filter((n) => !(n.nodeType === 1 && (n.classList.contains('vh') || n.classList.contains('lbl-hint')))).map((n) => n.textContent).join('').trim();
      const labels = [...document.querySelectorAll('form label')];
      return { n: labels.length, bracketed: labels.map(own).filter((t) => /\((empty|leave)/i.test(t)).slice(0, 3),
        hints: document.querySelectorAll('form .lbl-hint').length,
        smallInLabel: document.querySelectorAll('form label > small').length };
    });
    ok(r.bracketed.length === 0, `no label still says "(empty …)" in its own text${r.bracketed.length ? ': ' + r.bracketed.join(' | ') : ''}`);
    ok(r.hints >= 60 && r.smallInLabel === 0, `${r.hints} hint lines; ${r.smallInLabel} <small> blocks left inside labels`);
  }

  console.log('\n── P6/P7 "Find a box" ──');
  {
    const all = await p.evaluate(() => document.querySelectorAll('form .card').length);
    await p.fill('#form-filter-q', 'privacy policy');
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => ({
      count: document.querySelector('.form-filter-count').textContent,
      cards: [...document.querySelectorAll('form .card:not(.f-out)')].map((c) => c.querySelector('.card-title').textContent.trim()),
      pages: [...document.querySelectorAll('.page-group:not(.f-out)')].map((s) => s.id),
      links: [...document.querySelectorAll('.form-index li:not(.f-out) a')].map((a) => a.textContent),
      status: document.querySelector('.save-status').textContent,
    }));
    ok(r.cards.includes('Privacy Policy — Sections') && r.cards.length < 6 && /^\d+ match/.test(r.count),
      `"privacy policy": ${r.count}; sections ${JSON.stringify(r.cards)}`);
    ok(r.pages.length < 12 && r.links.length === r.pages.length, `pages shown ${r.pages.length}, strip links shown ${r.links.length}`);
    ok(r.status === '', `typing in the filter leaves the save bar at "${r.status}"`);
    const fd = await p.evaluate(() => [...new FormData(document.querySelector('form[data-long-form]')).keys()].length);
    const fdAll = onNames.filter((n) => n).length;
    ok(fd === fdAll, `while filtered, the form still posts ${fd} of ${fdAll} fields`);
    await p.fill('#form-filter-q', 'zzqx nothing');
    await p.waitForTimeout(400);
    const none = await p.evaluate(() => document.querySelector('.form-filter-count').textContent);
    ok(/^Nothing matches/.test(none), `no match says so: "${none}"`);
    await p.focus('#form-filter-q');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    const back = await p.evaluate(() => ({ out: document.querySelectorAll('.f-out').length, cards: document.querySelectorAll('form .card').length }));
    ok(back.out === 0 && back.cards === all, `Escape clears it: ${back.out} hidden`);
  }

  console.log('\n── P8 strip, jump, dot ──');
  await open();
  {
    const h = await p.evaluate(() => Math.round(document.querySelector('.form-index').getBoundingClientRect().height));
    ok(h <= 56, `strip ${h}px (one row)`);
    await p.click('.form-index a:has-text("About")');
    await p.waitForTimeout(250);
    const j = await p.evaluate(() => {
      const t = document.querySelector('#page-about > .page-group-title').getBoundingClientRect().top;
      return { t: Math.round(t), strip: Math.round(document.querySelector('.form-index').getBoundingClientRect().bottom), cur: document.querySelector('.form-index a[aria-current]').textContent };
    });
    ok(j.t >= j.strip && j.t < 300 && j.cur === 'About', `About title at ${j.t}px under a strip ending ${j.strip}px; current "${j.cur}"`);
    await p.focus('fieldset[data-section="faq"] .content-row textarea, fieldset[data-section="faq"] .content-row input[type=text]');
    await p.keyboard.type('x');
    const d = await p.evaluate(() => ({ dots: [...document.querySelectorAll('.form-index a.has-changes')].map((a) => a.textContent), status: document.querySelector('.save-status').textContent }));
    ok(d.dots.join() === 'FAQ' && /FAQ/.test(d.status), `dot on ${JSON.stringify(d.dots)}; bar "${d.status}"`);
  }

  await b.close();
  console.log(`\nplan13-pagecontent ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
