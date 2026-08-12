/**
 * PLAN-10 item 3 — a rejected quote form must show the field it is complaining
 * about.
 *
 * The defect (AUDIT-10 A10-012): /contact's forms use native constraint
 * validation — the required fields carry `required` and neither form is
 * noValidate. Pressing Submit on an empty form focuses input[name=name] and
 * the browser scrolls it to the very TOP of the viewport, which is underneath
 * the 65px sticky header (src/App.jsx:568-575, position:sticky, z-index 50).
 * Measured: 46.0 of the field's 46.0px hidden at mobile-390 with its
 * "Full Name *" label at -21.8 (off-screen entirely), 45.5 of 46.0 at
 * desktop-1440. The browser IS complaining — validationMessage is "Please fill
 * out this field." and valueMissing is true — at a field the visitor cannot
 * see, so the submit looks like it did nothing.
 *
 * BOTH TABS. A10-012 measured only the RFQ tab. /contact has two forms with
 * required fields — the RFQ tab (src/App.jsx:5103, onRfqSubmit) and the message
 * tab (src/App.jsx:5386, onMsgSubmit) — and PLAN-10 §4 item 3 requires the
 * second to be MEASURED rather than assumed. This suite measures both at all
 * four viewports, so the record is the measurement.
 *
 * What this suite asserts, per tab per viewport:
 *   1. the focused field's top is >= the header's bottom (65px) and 0px of it
 *      is under the header
 *   2. its <label> is fully below the header too — the field alone is not
 *      enough, the visitor needs to know WHICH field
 *   3. native validation still fires: valueMissing true, a non-empty
 *      validationMessage, and form.noValidate still false. The fix is a
 *      scroll-margin, NOT taking validation over in JS (PLAN-10 item 3,
 *      "what not to do") — this check is what proves the mechanism did not
 *      change.
 *
 * Usage: node _harness/plan10-rfqscroll.js       (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan10');
fs.mkdirSync(OUT, { recursive: true });

const VPS = [
  { n: 'mobile-390', w: 390, h: 844, mobile: true },
  { n: 'tablet-834', w: 834, h: 1112, mobile: true },
  { n: 'tablet-1024', w: 1024, h: 768, mobile: false },
  { n: 'desktop-1440', w: 1440, h: 900, mobile: false },
];
const TABS = [
  { id: 'rfq', label: 'the RFQ tab', index: 0 },
  { id: 'message', label: 'the message tab', index: 1 },
];

const READ = () => {
  const a = document.activeElement;
  const h = document.querySelector('header');
  const hr = h ? h.getBoundingClientRect() : null;
  const ar = a ? a.getBoundingClientRect() : null;
  /* The label the VISITOR sees, which is not always the one the DOM associates.
     On the message tab all four mapped labels used to carry htmlFor="rfq-subject",
     a copy-paste from the RFQ form, so input[name=name].labels was EMPTY there
     and the visible "Full Name *" above it was associated with a different input
     entirely. That was a real defect and it was NOT item 3's; it is FIXED as of
     2026-08-12 and its acceptance check is the `labels` scenario of
     `contactflow.js`, which asserts association and text on both tabs.
     The wrapper fallback STAYS. It is what let this suite measure the message
     tab while the defect was live, it is what `labelVia` exists to report, and
     a check that quietly starts depending on the fix cannot measure the next
     regression of it. `labelVia` should now read `labels` on both tabs. */
  let lab = a && a.labels && a.labels.length ? a.labels[0] : null;
  const labelVia = lab ? 'labels' : 'wrapper';
  if (!lab && a && a.parentElement) lab = a.parentElement.querySelector('label');
  const lr = lab ? lab.getBoundingClientRect() : null;
  const under = (r) => (r && hr ? Math.max(0, Math.min(r.bottom, hr.bottom) - Math.max(r.top, hr.top)) : 0);
  // the form the focused control belongs to, not "the first form on the page"
  const form = a ? a.closest('form') : null;
  return {
    active: a ? `${a.tagName.toLowerCase()}[name=${a.name || ''}]` : null,
    scrollY: Math.round(window.scrollY),
    headerBottom: hr ? +hr.bottom.toFixed(1) : null,
    headerPosition: h ? getComputedStyle(h).position : null,
    fieldTop: ar ? +ar.top.toFixed(1) : null,
    fieldHeight: ar ? +ar.height.toFixed(1) : null,
    underHeaderPx: +under(ar).toFixed(1),
    labelText: lab ? lab.textContent.trim().slice(0, 30) : null,
    labelVia,
    labelTop: lr ? +lr.top.toFixed(1) : null,
    labelUnderHeaderPx: +under(lr).toFixed(1),
    scrollMarginTop: a ? getComputedStyle(a).scrollMarginTop : null,
    valueMissing: a && a.validity ? a.validity.valueMissing : null,
    validationMessage: a ? a.validationMessage : null,
    formNoValidate: form ? form.noValidate : null,
    formAction: form ? (form.getAttribute('action') || '') : null,
  };
};

const results = [];
function note(ok, msg, detail) {
  results.push({ ok, msg });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}${!ok && detail ? `  <- ${detail}` : ''}`);
}

(async () => {
  const browser = await launch();
  const rows = {};

  for (const vp of VPS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      ...(vp.mobile ? { hasTouch: true, isMobile: true } : {}),
    });
    rows[vp.n] = {};
    for (const tab of TABS) {
      const page = await ctx.newPage();
      await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      if (tab.index > 0) {
        // The two tabs are the aria-pressed buttons above the form
        // (src/App.jsx:5029-5035). Selected by role rather than by copy so a
        // wording change in content.json cannot silently skip this half.
        const btns = page.locator('button[aria-pressed]');
        await btns.nth(tab.index).click();
        await page.waitForTimeout(400);
      }
      // Scroll the form into view first, exactly as a visitor reaches it, so
      // the measurement is of the browser's own validation scroll and not of
      // an artificial starting offset (the Refuted §1 lesson from A10-056).
      await page.locator('form button[type="submit"]').first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await page.locator('form button[type="submit"]').first().click().catch(() => {});
      await page.waitForTimeout(900);
      const r = await page.evaluate(READ);
      rows[vp.n][tab.id] = r;
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();

  fs.writeFileSync(path.join(OUT, 'rfqscroll.json'), JSON.stringify(rows, null, 1));

  for (const tab of TABS) {
    for (const vp of VPS) {
      const r = rows[vp.n][tab.id];
      const where = `${vp.n} / ${tab.label}`;

      // ── 3 first: if native validation is not what fired, the other two
      //    assertions are measuring the wrong thing entirely.
      note(r.valueMissing === true && !!r.validationMessage && r.formNoValidate === false,
        `${where}: native constraint validation still fires (valueMissing, "${r.validationMessage}", noValidate=${r.formNoValidate})`,
        `active=${r.active} valueMissing=${r.valueMissing} msg=${JSON.stringify(r.validationMessage)} noValidate=${r.formNoValidate}`);

      // ── 1. the field the browser is complaining about is visible
      note(r.fieldTop !== null && r.fieldTop >= r.headerBottom && r.underHeaderPx === 0,
        `${where}: the invalid field sits below the sticky header ` +
        `(top ${r.fieldTop} >= ${r.headerBottom}, ${r.underHeaderPx}px hidden)`,
        `top ${r.fieldTop} vs header bottom ${r.headerBottom} — ${r.underHeaderPx} of ${r.fieldHeight}px hidden ` +
        `(scroll-margin-top ${r.scrollMarginTop})`);

      // ── 2. and so is the label that says which field it is
      note(r.labelTop !== null && r.labelTop >= r.headerBottom && r.labelUnderHeaderPx === 0,
        `${where}: its "${r.labelText}" label is fully in view (top ${r.labelTop} >= ${r.headerBottom}, via ${r.labelVia})`,
        `label "${r.labelText}" top ${r.labelTop} vs header bottom ${r.headerBottom}, ${r.labelUnderHeaderPx}px under it`);
    }
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan10-rfqscroll ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'rfqscroll.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
