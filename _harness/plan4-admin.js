/**
 * PLAN-4 admin — 4.31 (content.php's unlabelled controls) and 4.30 (the
 * spec-table editor's focus and naming).
 *
 * 4.31: content.php renders 418 form controls. It DOES render 418 <label>
 * elements, but not one of them carries `for` and not one control carries an
 * `id` — so visually there are labels and programmatically there are none.
 * Measured over the real accessibility tree: 397 of 418 controls have no
 * accessible name at all. This is the page holding the most irreplaceable
 * typing on the site.
 *
 * The constraint that governs 4.31: labels must not add posted VARIABLES.
 * <label>, id/for, <fieldset> and <legend> do not post. The form's posted count
 * is measured before and after and must be identical, because the whole
 * max_input_vars truncation-guard machinery is built on that number.
 *
 * 4.30: the editor rebuilds its rows with innerHTML on every structural change,
 * so focus goes to the document. Building a 20-row spec table by keyboard means
 * 20 round trips back. Every remove button is also called "Remove row".
 *
 * Accessible names are read from the real AX tree over CDP, not inferred from
 * markup — an inferred name would happily "pass" on a <label> that is not
 * associated with anything, which is exactly this defect.
 *
 * Needs the mirror on :8123. 4.30's round-trip SAVES; the caller restores
 * data/ from _harness/pristine and the suite proves byte-identity itself.
 *
 * Usage: node _harness/plan4-admin.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const MIRROR_DATA = path.join(__dirname, 'site/data');
const PRISTINE = path.join(__dirname, 'pristine');

// Measured on the unmodified page. 2026-08-06: 421 (the PLAN-4 doc says 423 —
// the same over-count the WHATS_LEFT §2 AMENDED note corrected for the copy-key
// figure; asserted as measured, not as documented). 2026-08-07: **424** after
// PLAN-6 item 3 added three auto-reply copy fields, then **435** after item 1
// added the eleven-row Product Families section.
//
// This number is allowed to move. What is NOT allowed is moving it silently, so
// it is updated in the same commit as any field that changes it, and
// `plan2-trunc.js` is re-run against a real max_input_vars=100 server at the new
// count — that is the assertion that matters; this one is bookkeeping.
// (PLAN-6 §0, invariant 6.)
const POSTED_BEFORE = 439;

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const CTRL_ROLES = new Set(['textbox', 'combobox', 'listbox', 'checkbox', 'spinbutton']);

/** Census of form controls in the real accessibility tree. */
async function axControls(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const named = [];
  const unnamed = [];
  for (const n of nodes) {
    if (n.ignored) continue;
    if (!CTRL_ROLES.has(n.role && n.role.value)) continue;
    const name = ((n.name && n.name.value) || '').trim();
    (name ? named : unnamed).push(name);
  }
  await cdp.detach();
  return { total: named.length + unnamed.length, named, unnamed };
}

async function signIn(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  return page;
}

// ── 4.31 ────────────────────────────────────────────────────────────────────
async function contentLabels(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await signIn(ctx);
  await page.goto(`${BASE}/admin/content.php`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  const dom = await page.evaluate(() => {
    // The Sign Out form in nav.php is also a form[method=POST]; anchor on the
    // sentinel instead, which only the content form has.
    const form = [...document.querySelectorAll('form')].find((f) => f.querySelector('[name="form_complete"]'));
    const ctrls = [...form.querySelectorAll('input, select, textarea')].filter((e) => e.type !== 'hidden');
    const ids = ctrls.map((e) => e.id).filter(Boolean);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    const orphanFor = [...form.querySelectorAll('label[for]')]
      .filter((l) => !form.querySelector(`#${CSS.escape(l.getAttribute('for'))}`))
      .map((l) => l.getAttribute('for'));
    return {
      posted: form.querySelectorAll('[name]').length,
      controls: ctrls.length,
      withId: ids.length,
      dupIds: dup.length,
      dupSample: dup.slice(0, 3),
      orphanFor: orphanFor.length,
      orphanSample: orphanFor.slice(0, 3),
      fieldsets: form.querySelectorAll('fieldset').length,
      legends: form.querySelectorAll('fieldset > legend').length,
    };
  });

  note(dom.posted === POSTED_BEFORE,
    `4.31: the posted variable count is UNCHANGED at ${POSTED_BEFORE}`,
    `now ${dom.posted} — a label must never add a posted variable`);
  note(dom.withId === dom.controls,
    '4.31: every control has an id', `${dom.withId}/${dom.controls}`);
  note(dom.dupIds === 0, '4.31: every control id is unique',
    `${dom.dupIds} duplicates, e.g. ${JSON.stringify(dom.dupSample)}`);
  note(dom.orphanFor === 0, '4.31: every label[for] resolves to a real control',
    `${dom.orphanFor} orphans, e.g. ${JSON.stringify(dom.orphanSample)}`);
  note(dom.fieldsets > 0 && dom.legends === dom.fieldsets,
    '4.31: each section is a <fieldset> with a <legend>',
    `${dom.fieldsets} fieldsets, ${dom.legends} legends`);

  const ax = await axControls(page);
  note(ax.unnamed.length === 0,
    '4.31: ZERO controls without an accessible name',
    `${ax.unnamed.length} of ${ax.total} are unnamed`);

  // Row-repeated controls must be distinguishable: 18 boxes all called "Icon"
  // is a labelled form that is still unusable.
  const dupNames = {};
  for (const n of ax.named) dupNames[n] = (dupNames[n] || 0) + 1;
  const worst = Object.entries(dupNames).sort((a, b) => b[1] - a[1])[0] || ['', 0];
  note(worst[1] <= 1,
    '4.31: no two controls share an accessible name (rows carry their identity)',
    `"${worst[0]}" appears ${worst[1]} times`);

  // The riskiest part of 4.31: content-editor.js renumbers names on every add,
  // remove and reorder, and the id / label-for / row-context have to move with
  // them. A stale `for` is WORSE than no label — it points a screen reader at a
  // control in a different row. So mutate the form and re-check.
  const afterMutation = await page.evaluate(async () => {
    const sec = document.querySelector('[data-section]');
    const name = sec.getAttribute('data-section');
    sec.querySelector('[data-action="add"]').click();
    const rows = sec.querySelectorAll('.rows > .content-row');
    rows[rows.length - 1].querySelector('[data-action="up"]').click();
    await new Promise((r) => setTimeout(r, 60));

    const form = [...document.querySelectorAll('form')].find((f) => f.querySelector('[name="form_complete"]'));
    const ctrls = [...form.querySelectorAll('input, select, textarea')].filter((e) => e.type !== 'hidden');
    const ids = ctrls.map((e) => e.id).filter(Boolean);
    const mismatched = ctrls.filter((c) => {
      const g = c.closest('.form-group');
      const l = g && g.querySelector('label');
      return !l || l.getAttribute('for') !== c.id;
    }).length;
    // Every row's context text must agree with the row number now shown.
    const ctxWrong = [...sec.querySelectorAll('.rows > .content-row')].filter((row, i) => {
      const ctx = row.querySelector('[data-rowctx]');
      return ctx && !ctx.textContent.includes('row ' + (i + 1));
    }).length;
    return {
      section: name,
      controls: ctrls.length,
      withId: ids.length,
      dupIds: ids.length - new Set(ids).size,
      mismatchedFor: mismatched,
      ctxWrong,
      posted: form.querySelectorAll('[name]').length,
    };
  });
  note(afterMutation.dupIds === 0 && afterMutation.withId === afterMutation.controls,
    '4.31: ids stay unique and present after an add + reorder',
    JSON.stringify(afterMutation));
  note(afterMutation.mismatchedFor === 0,
    '4.31: every label[for] still points at ITS OWN control after a reorder',
    `${afterMutation.mismatchedFor} labels point elsewhere`);
  note(afterMutation.ctxWrong === 0,
    '4.31: the hidden row context is renumbered by the reorder too',
    `${afterMutation.ctxWrong} rows announce the wrong number`);

  // Keyboard: walk the first section and confirm every control is reachable.
  const walk = await page.evaluate(async () => {
    const form = [...document.querySelectorAll('form')].find((f) => f.querySelector('[name="form_complete"]'));
    const first = form.querySelector('fieldset') || form;
    const ctrls = [...first.querySelectorAll('input, select, textarea')].filter((e) => e.type !== 'hidden');
    return { n: ctrls.length, allFocusable: ctrls.every((c) => !c.disabled && c.tabIndex >= 0) };
  });
  note(walk.n > 0 && walk.allFocusable,
    '4.31: every control in the first section is keyboard-focusable, no trap',
    JSON.stringify(walk));

  await ctx.close();
}

// ── 4.30 ────────────────────────────────────────────────────────────────────
async function specTableEditor(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await signIn(ctx);

  const products = JSON.parse(fs.readFileSync(path.join(PRISTINE, 'products-all.json'), 'utf8'));
  const sku = (Array.isArray(products) ? products : products.products || [])[0].sku;
  await page.goto(`${BASE}/admin/edit.php?sku=${encodeURIComponent(sku)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  const present = await page.evaluate(() => !!document.querySelector('.ste-row'));
  note(present, '4.30: the spec-table editor rendered', `sku under test had no .ste-row`);
  if (!present) { await ctx.close(); return; }

  // Grow to five rows so the naming assertion has something to bite on.
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /add/i.test(x.textContent) && x.closest('.ste-wrap, .ste-box, form'));
      if (b) b.click();
    });
    await page.waitForTimeout(80);
  }

  const rowCount = await page.evaluate(() => document.querySelectorAll('.ste-row').length);
  note(rowCount >= 5, '4.30: at least five spec rows exist to test with', `rows=${rowCount}`);

  // ── add: focus must land in the NEW row ──
  const afterAdd = await page.evaluate(() => {
    const before = document.querySelectorAll('.ste-row').length;
    const b = [...document.querySelectorAll('button')].find((x) => /add/i.test(x.textContent) && x.closest('.ste-wrap, .ste-box, form'));
    b.click();
    const rows = [...document.querySelectorAll('.ste-row')];
    const a = document.activeElement;
    return {
      grew: rows.length === before + 1,
      inNewRow: !!(a && rows[rows.length - 1] && rows[rows.length - 1].contains(a)),
      tag: a ? a.tagName.toLowerCase() + '.' + a.className : null,
    };
  });
  note(afterAdd.grew && afterAdd.inNewRow,
    '4.30: adding a row puts focus in the NEW row',
    JSON.stringify(afterAdd));

  // ── remove: focus must land on a sensible surviving neighbour ──
  const afterRemove = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.ste-row')];
    const target = rows[2];
    const x = target.querySelector('.ste-x');
    x.click();
    const a = document.activeElement;
    const now = [...document.querySelectorAll('.ste-row')];
    return {
      shrank: now.length === rows.length - 1,
      focusSomewhereUseful: !!(a && a !== document.body && now.some((r) => r.contains(a))),
      tag: a ? a.tagName.toLowerCase() + '.' + a.className : null,
    };
  });
  note(afterRemove.shrank && afterRemove.focusSomewhereUseful,
    '4.30: removing a row puts focus on a surviving neighbour, not the document',
    JSON.stringify(afterRemove));

  // ── every remove button has its OWN accessible name ──
  const ax = await axControls(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  await cdp.detach();
  const removeNames = nodes
    .filter((n) => !n.ignored && n.role && n.role.value === 'button')
    .map((n) => ((n.name && n.name.value) || '').trim())
    .filter((n) => /remove/i.test(n));
  const uniq = new Set(removeNames);
  note(removeNames.length >= 5 && uniq.size === removeNames.length,
    '4.30: no two remove buttons share an accessible name',
    `${removeNames.length} remove buttons, ${uniq.size} distinct: ${JSON.stringify([...uniq].slice(0, 6))}`);

  // ── structural changes are announced ──
  // The announcer deliberately clears the region and re-fills it a tick later:
  // a live region does not re-announce identical text, so adding two rows in a
  // row would be silent the second time. Read it AFTER that tick — reading
  // synchronously measures the deliberate blank and fails a working fix.
  const hasRegion = await page.evaluate(() => !!document.querySelector('[aria-live]'));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /add/i.test(x.textContent) && x.closest('.ste-wrap, .ste-box, form'));
    if (b) b.click();
  });
  await page.waitForTimeout(200);
  const live = await page.evaluate((has) => {
    const region = document.querySelector('[aria-live]');
    if (!region) return { has };
    return { has, text: (region.textContent || '').trim(), politeness: region.getAttribute('aria-live') };
  }, hasRegion);
  note(!!(live.has && live.text && live.politeness === 'polite'),
    '4.30: adding a row announces it in a polite live region',
    JSON.stringify(live));

  // ── round-trip: type five rows, save, reload, confirm they persisted ──
  const typed = [];
  await page.evaluate(() => {
    document.querySelectorAll('.ste-row').forEach((r, i) => {
      const lab = r.querySelector('.ste-lab');
      const val = r.querySelector('.ste-val');
      if (!lab || !val) return;
      lab.value = 'RT Label ' + i;
      lab.dispatchEvent(new Event('input', { bubbles: true }));
      val.value = 'RT Value ' + i;
      val.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  const wantRows = await page.evaluate(() =>
    [...document.querySelectorAll('.ste-row')].map((r) => [
      r.querySelector('.ste-lab').value, r.querySelector('.ste-val').value,
    ]).slice(0, 5));
  typed.push(...wantRows);

  await page.evaluate(() => {
    const f = [...document.querySelectorAll('form')].find((x) => x.querySelector('[name="specTable2_json"]'));
    f.querySelector('button[type="submit"]').click();
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  await page.goto(`${BASE}/admin/edit.php?sku=${encodeURIComponent(sku)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const reloaded = await page.evaluate(() =>
    [...document.querySelectorAll('.ste-row')].map((r) => [
      r.querySelector('.ste-lab').value, r.querySelector('.ste-val').value,
    ]).slice(0, 5));

  note(JSON.stringify(reloaded) === JSON.stringify(typed),
    '4.30: five typed rows survive save + reload with correct values',
    `typed=${JSON.stringify(typed)}\n         back =${JSON.stringify(reloaded)}`);

  await ctx.close();

  // ── restore the mirror and PROVE it ──
  for (const f of ['products-all.json', 'content.json', 'site-info.json']) {
    fs.copyFileSync(path.join(PRISTINE, f), path.join(MIRROR_DATA, f));
  }
  let restored = true;
  for (const f of ['products-all.json', 'content.json', 'site-info.json']) {
    try {
      execFileSync('cmp', ['-s', path.join(PRISTINE, f), path.join(MIRROR_DATA, f)]);
    } catch { restored = false; }
  }
  note(restored, '4.30: the mirror data/ is byte-identical to pristine again');
}

(async () => {
  const browser = await launch();
  await contentLabels(browser);
  await specTableEditor(browser);
  await browser.close();

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nplan4-admin: ${pass}/${results.length}`);
  process.exit(pass === results.length ? 0 : 1);
})();
