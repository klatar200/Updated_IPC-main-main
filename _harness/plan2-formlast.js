/**
 * PLAN-2 `form_complete` — the truncation sentinel must be the LAST named
 * control in the rendered form.
 *
 * invariants.js INV6 checks the SOURCE order. That is necessary but not
 * sufficient: content.php builds rows from PHP loops and a <template>, and
 * content-editor.js adds and renumbers fields at runtime, so what determines
 * the POST order is the DOM the browser ends up with — not the order of the
 * lines in the file. This loads the real page and asserts against that.
 *
 * Why it matters: the guard only detects a truncated POST because
 * `form_complete` is the last variable sent. Anything after it is dropped in
 * the same truncation, the sentinel still arrives, and the guard sees a
 * complete form. That is the DEPLOY_READINESS_v2 T3.7 data-loss bug restored.
 *
 * Also asserts the invariant survives the two runtime mutations the editor
 * performs: adding a row, and removing one.
 *
 * Needs the mirror on :8123. Read-only — never saves.
 *
 * Usage: node _harness/plan2-formlast.js
 */

const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/** Every named control the browser would submit, in DOM order. */
async function namedControls(page) {
  return page.evaluate(() => {
    // NOT form[method="POST"] — nav.php renders the Sign Out form earlier in the
    // DOM, so the generic selector picks that one up and reports 2 controls.
    // Anchor on orig_sig, which only the content form carries.
    const sig = document.querySelector('input[name="orig_sig"]');
    const form = sig ? sig.closest('form') : null;
    if (!form) return null;
    return [...form.querySelectorAll('input[name], select[name], textarea[name], button[name]')]
      // A <template>'s contents are inert and are never submitted.
      .filter((el) => !el.closest('template'))
      .filter((el) => !el.disabled)
      .map((el) => el.getAttribute('name'));
  });
}

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="password"]', PW);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');
    note(!/auth\.php/.test(page.url()), 'signed in');

    await page.goto(`${BASE}/admin/content.php`, { waitUntil: 'domcontentloaded' });

    const names = await namedControls(page);
    note(Array.isArray(names) && names.length > 0, 'the content form has named controls',
      `got ${names && names.length}`);
    note(names.includes('form_complete'), 'form_complete is present in the rendered form');

    const last = names[names.length - 1];
    note(last === 'form_complete',
      `form_complete is the LAST of ${names.length} named controls`,
      `last was "${last}"; ${names.length - 1 - names.indexOf('form_complete')} control(s) follow the sentinel`);

    // It must appear exactly once — two sentinels and the "last" test is
    // satisfied by a copy while the real POST order is still wrong.
    const count = names.filter((n) => n === 'form_complete').length;
    note(count === 1, 'form_complete appears exactly once', `found ${count}`);

    // ── after the editor adds a row ──────────────────────────────────────────
    await page.click('[data-action="add"]');
    await page.waitForTimeout(120);
    const afterAdd = await namedControls(page);
    note(afterAdd[afterAdd.length - 1] === 'form_complete',
      `form_complete is still last after adding a row (${afterAdd.length} controls)`,
      `last was "${afterAdd[afterAdd.length - 1]}"`);
    note(afterAdd.length > names.length, 'adding a row really did add controls',
      `${names.length} -> ${afterAdd.length}`);

    // ── after the editor removes a row ───────────────────────────────────────
    page.on('dialog', async (d) => { await d.accept(); });
    await page.click('.content-row [data-action="remove"]');
    await page.waitForTimeout(120);
    const afterRemove = await namedControls(page);
    note(afterRemove[afterRemove.length - 1] === 'form_complete',
      `form_complete is still last after removing a row (${afterRemove.length} controls)`,
      `last was "${afterRemove[afterRemove.length - 1]}"`);
  } catch (e) {
    note(false, 'suite ran without throwing', e.message);
  } finally {
    await browser.close();
  }

  const failing = results.filter((r) => !r.ok).length;
  console.log(`\nplan2-formlast ${results.length - failing}/${results.length}`);
  process.exit(failing === 0 ? 0 : 1);
})();
