/**
 * PLAN-13 Phase 3 — the long-form pattern on Business Details, Add and Edit
 * (admin/longform.js, the save bar in admin_head(), unsaved.js's status).
 *
 *   L1  the "On this page" strip lists every section, is one row at 1440, and
 *       the page does not scroll sideways at 1024 or 390
 *   L2  a strip link lands its section's title below the strip, focuses it,
 *       and marks that link as current
 *   L3  typing names the section in the save bar ("Unsaved changes in: …")
 *       and dots its link; Page Content's bar says the same
 *   L4  Hide/Show folds a section; its fields are still in the POST
 *   L5  Save with an empty required field in a hidden section opens it
 *   L6  the live previews stay on screen after scrolling (1440)
 *   L7  with JavaScript off: no strip, no toggles, the save bar still sticks
 *   L8  the POST is the same set of fields with JavaScript on and off
 *
 * Read-only: signs in to the mirror and saves nothing (L5's Save is stopped
 * by the browser before it is sent).
 * Usage: node _harness/plan13-longform.js      (needs :8123)
 */
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const FORMS = ['settings.php', 'add.php', 'edit.php?sku=IP33PO'];

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); };
const name = (pg) => pg.replace(/\?.*/, '');

(async () => {
  const b = await launch();
  const ctxs = {};
  const signIn = async (w, h, opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...opts });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => ok(false, `page error at ${w}: ${e.message}`));
    await p.goto(BASE + '/admin/index.php', { waitUntil: 'domcontentloaded' });
    if (await p.$('input[type=password]')) {
      await p.fill('input[type=password]', PW);
      await p.click('button[type=submit]');
      await p.waitForLoadState('domcontentloaded');
    }
    return { ctx, p };
  };
  ctxs[1440] = await signIn(1440, 900);
  ctxs[1024] = await signIn(1024, 768);
  ctxs[390] = await signIn(390, 844, { hasTouch: true, isMobile: true });
  const open = async (w, pg) => {
    const { p } = ctxs[w];
    await p.goto(BASE + '/admin/' + pg, { waitUntil: 'networkidle' });
    return p;
  };

  console.log('\n── L1 strip lists every section; one row at 1440; no sideways scroll ──');
  for (const w of [1440, 1024, 390]) {
    for (const pg of FORMS) {
      const p = await open(w, pg);
      const r = await p.evaluate(() => {
        const nav = document.querySelector('.form-index');
        const titles = [...document.querySelectorAll('form[data-long-form] > .card > .card-title')].map((t) => t.textContent.trim());
        const links = nav ? [...nav.querySelectorAll('a')].map((a) => a.textContent.trim()) : [];
        return { has: !!nav, same: JSON.stringify(titles) === JSON.stringify(links), n: links.length,
          h: nav ? Math.round(nav.getBoundingClientRect().height) : 0,
          sw: document.documentElement.scrollWidth, iw: innerWidth };
      });
      ok(r.has && r.same && r.n >= 6 && r.sw <= r.iw && (w !== 1440 || r.h <= 56),
        `${w} ${name(pg).padEnd(12)} ${r.n} links${r.same ? ' = the section titles' : ' DIFFER from the titles'}, strip ${r.h}px, page ${r.sw}/${r.iw}px wide`);
    }
  }

  console.log('\n── L2 a strip link lands the section below the strip ──');
  for (const w of [1440, 390]) {
    for (const pg of FORMS) {
      const p = await open(w, pg);
      const target = await p.evaluate(() => {
        const a = [...document.querySelectorAll('.form-index a')];
        return a[a.length - 2].textContent.trim();
      });
      await p.evaluate((t) => [...document.querySelectorAll('.form-index a')].find((a) => a.textContent.trim() === t).click(), target);
      await p.waitForTimeout(250);
      const r = await p.evaluate((t) => {
        const title = [...document.querySelectorAll('form[data-long-form] > .card > .card-title')].find((x) => x.textContent.trim() === t);
        const tr = title.getBoundingClientRect(), nb = document.querySelector('.form-index').getBoundingClientRect().bottom;
        const cur = document.querySelector('.form-index a[aria-current="true"]');
        return { top: Math.round(tr.top), strip: Math.round(nb), ih: innerHeight, focused: document.activeElement === title, cur: cur && cur.textContent.trim() };
      }, target);
      ok(r.top >= r.strip && r.top < r.ih / 2 && r.focused && r.cur === target,
        `${w} ${name(pg).padEnd(12)} "${target}": title at ${r.top}px under a strip ending ${r.strip}px; focused ${r.focused}; current "${r.cur}"`);
    }
  }

  console.log('\n── L3 the save bar names the sections with changes ──');
  for (const pg of [...FORMS, 'content.php']) {
    const p = await open(1440, pg);
    const before = await p.evaluate(() => document.querySelector('.save-status').textContent);
    const sec = await p.evaluate(() => {
      const secs = [...document.querySelectorAll('form .card')].filter((c) => c.querySelector('input[type=text], textarea'));
      const c = secs[1];
      const f = c.querySelector('input[type=text], textarea');
      f.id = f.id || 'l3-probe';
      const t = c.getAttribute('data-section-title') || c.querySelector('.card-title').textContent;
      return { sel: '#' + CSS.escape(f.id), title: t.replace(/\s+/g, ' ').trim() };
    });
    await p.focus(sec.sel);
    await p.keyboard.type('x');
    const r = await p.evaluate(() => ({
      status: document.querySelector('.save-status').textContent,
      dots: [...document.querySelectorAll('.form-index a.has-changes')].map((a) => a.textContent.trim()),
      hasStrip: !!document.querySelector('.form-index'),
    }));
    ok(before === '' && r.status === `Unsaved changes in: ${sec.title}` && (!r.hasStrip || (r.dots.length === 1 && r.dots[0] === sec.title)),
      `${name(pg).padEnd(12)} before "${before}", after "${r.status}"${r.hasStrip ? `, dot on ${JSON.stringify(r.dots)}` : ''}`);
  }

  console.log('\n── L4 Hide/Show folds a section; its fields still post ──');
  {
    const p = await open(1440, 'settings.php');
    const r = await p.evaluate(() => {
      const card = document.querySelectorAll('form[data-long-form] > .card')[1];
      const btn = card.querySelector('.sec-toggle');
      const h0 = card.getBoundingClientRect().height;
      btn.click();
      const h1 = card.getBoundingClientRect().height;
      const fd = new FormData(card.closest('form'));
      const names = [...card.querySelectorAll('[name]')].map((e) => e.name);
      const res = { h0: Math.round(h0), h1: Math.round(h1), exp: btn.getAttribute('aria-expanded'), label: btn.textContent,
        posted: names.every((n) => fd.has(n)), n: names.length };
      btn.click();
      res.back = btn.getAttribute('aria-expanded') === 'true' && Math.round(card.getBoundingClientRect().height) === res.h0;
      return res;
    });
    ok(r.h1 < 100 && r.h1 < r.h0 && r.exp === 'false' && r.label === 'Show', `hidden: ${r.h0}px → ${r.h1}px, button "${r.label}", aria-expanded ${r.exp}`);
    ok(r.posted && r.n > 0, `all ${r.n} fields of the hidden section are still in the form data`);
    ok(r.back, 'Show restores the section');
  }

  console.log('\n── L5 a blocked Save opens the hidden section holding the empty field ──');
  {
    const p = await open(1440, 'add.php');
    await p.evaluate(() => document.querySelectorAll('form[data-long-form] > .card')[0].querySelector('.sec-toggle').click());
    await p.click('main button[type=submit]');
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({
      collapsed: document.querySelectorAll('form[data-long-form] > .card')[0].classList.contains('is-collapsed'),
      focus: document.activeElement && document.activeElement.name, path: location.pathname,
    }));
    ok(!r.collapsed && r.focus && r.path.endsWith('/add.php'), `section open again: ${!r.collapsed}; focus on "${r.focus}"; still on ${r.path}`);
  }

  console.log('\n── L6 the live preview stays on screen after scrolling (1440) ──');
  for (const [pg, sel] of [['settings.php', '.preview-inner'], ['edit.php?sku=IP33PO', '.ipc-preview-inner']]) {
    const p = await open(1440, pg);
    const r = await p.evaluate(async (s) => {
      scrollTo(0, Math.round((document.documentElement.scrollHeight - innerHeight) * 0.6));
      await new Promise((res) => setTimeout(res, 150));
      const rc = document.querySelector(s).getBoundingClientRect();
      const nb = document.querySelector('.form-index').getBoundingClientRect().bottom;
      return { top: Math.round(rc.top), bottom: Math.round(rc.bottom), strip: Math.round(nb), ih: innerHeight };
    }, sel);
    ok(r.top >= r.strip && r.top < 200 && r.bottom <= r.ih, `${name(pg).padEnd(12)} preview at ${r.top}–${r.bottom}px, strip ends ${r.strip}px`);
  }

  console.log('\n── L7/L8 JavaScript off: plain form, save bar still sticks, same POST ──');
  {
    const { ctx: on } = ctxs[1440];
    const off = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    await off.addCookies(await on.cookies());
    const q = await off.newPage();
    const pOn = ctxs[1440].p;
    for (const pg of FORMS) {
      await q.goto(BASE + '/admin/' + pg, { waitUntil: 'domcontentloaded' });
      const fieldNames = () => [...document.querySelector('main form').elements].filter((e) => e.name).map((e) => e.name).join('|');
      const r = await q.evaluate(() => {
        const btn = document.querySelector('.save-bar button[type=submit]');
        window.scrollTo(0, Math.round((document.documentElement.scrollHeight - innerHeight) * 0.5));
        const rc = btn.getBoundingClientRect();
        return { strip: !!document.querySelector('.form-index'), toggles: document.querySelectorAll('.sec-toggle').length,
          seen: rc.top >= 0 && rc.bottom <= innerHeight };
      });
      ok(!r.strip && r.toggles === 0 && r.seen, `${name(pg).padEnd(12)} no strip, no toggles, Save on screen half-way down: ${r.seen}`);
      const offNames = await q.evaluate(fieldNames);
      await pOn.goto(BASE + '/admin/' + pg, { waitUntil: 'networkidle' });
      const onNames = await pOn.evaluate(fieldNames);
      ok(onNames === offNames, `${name(pg).padEnd(12)} ${onNames.split('|').length} posted fields, identical with JavaScript on and off`);
    }
    await off.close();
  }

  await b.close();
  console.log(`\nplan13-longform ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
