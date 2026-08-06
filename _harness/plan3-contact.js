/**
 * PLAN-3 4.5 — every contact-form error was a browser alert().
 *
 * Four call sites, two per form. A native alert() on mobile is a system dialog
 * that reads as "this site is broken"; dismissing it leaves no trace of what
 * went wrong or which field; screen-reader users get nothing announced inside
 * the form; and some mobile browsers suppress alert() during certain
 * interactions entirely, so the failure can be COMPLETELY SILENT. Every one of
 * those costs a sales enquiry — the same standard CLAUDE.md invariant 11 is
 * held to.
 *
 * Asserts, on BOTH forms (Request a Quote and Send a Message), at 1440 and 375:
 *   - no alert() is raised at all (a raised dialog is captured and fails)
 *   - an inline region appears inside the form carrying role="alert"
 *   - focus lands in that region (or on an invalid field inside the form)
 *   - the SERVER's specific message is shown verbatim — asserted against the
 *     real string contact.php returns, not a generic fallback
 *   - a server message containing  <1/4 inch and >2 inch ID, 1/2" wall
 *     renders LITERALLY: exact textContent, and no element injected into the
 *     region (invariant 10 — contact.php deliberately does not HTML-escape,
 *     because its destinations are a text/plain email and a JSONL line, so the
 *     escaping has to happen here at the render boundary)
 *   - a network failure shows the network copy, DISTINCT from the validation
 *     copy, and is machine-distinguishable
 *   - the copy still comes from the owner-editable cf.networkError
 *
 * Needs the mirror on :8123 (started with -t _harness/site). Posts only invalid
 * submissions plus intercepted ones; never writes data/.
 *
 * Usage: node _harness/plan3-contact.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan3');

// The literal strings contact.php returns for a submission missing required
// fields. Asserted verbatim: "the server's specific message is displayed, not a
// generic one" is the whole point of the item.
const SERVER_MSG = {
  rfq: 'Name and a valid email address are required.',
  message: 'Name, a valid email address, and a message are required.',
};

// cf.networkError, straight out of the pristine content.json — the copy is
// owner-editable through content.php and must not be hardcoded in the app.
const CONTENT = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine/content.json'), 'utf8'));
const NETWORK_MSG = (function find(o) {
  if (!o || typeof o !== 'object') return null;
  if (typeof o.networkError === 'string') return o.networkError;
  for (const v of Object.values(o)) { const r = find(v); if (r) return r; }
  return null;
})(CONTENT);

// A real quote request. strip_tags() ate this exact string out of one once.
const SPECY = '<1/4 inch and >2 inch ID, 1/2" wall';

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

// WCAG 2.1 relative luminance / contrast ratio, over computed rgb() strings.
const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const lum = (c) => {
  const [r, g, b] = rgb(c).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const TABS = [
  { id: 'rfq', label: 'Request a Quote' },
  { id: 'message', label: 'Send a Message' },
];

/**
 * Open the contact page on the given tab, with alert()/confirm() captured
 * rather than auto-dismissed, so raising one is a detectable failure.
 */
async function openForm(ctx, tab) {
  const page = await ctx.newPage();
  const dialogs = [];
  page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
  await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
  if (tab.id !== 'rfq') {
    await page.click(`text=${tab.label}`);
    await page.waitForTimeout(200);
  }
  // The form that carries the submit button — nav.php-style stray forms and the
  // tab strip must not be matched by a bare form[method=POST] selector.
  const form = page.locator('form').filter({ has: page.locator('button[type="submit"]') }).first();
  return { page, dialogs, form };
}

/**
 * Submit past the browser's own required-field validation, so the SERVER's
 * message is what comes back. Real submissions reach this state too: an older
 * browser, a paste-then-submit, or a bot posting directly.
 */
async function submitBypassingClientValidation(page, form) {
  await form.evaluate((f) => { f.noValidate = true; });
  await form.locator('button[type="submit"]').click();
  await page.waitForTimeout(600);
}

/** Whatever the app renders as its error region, plus how it renders it. */
async function readErrorRegion(form) {
  return form.evaluate((f) => {
    const el = f.querySelector('[role="alert"]');
    if (!el) return { present: false };
    const active = document.activeElement;
    // The message itself, not the region: the region legitimately contains a
    // decorative <svg>, so asserting "no markup" against the whole region would
    // be asserting against the icon. The message node is where an injection
    // would land.
    const msg = el.querySelector('span');
    return {
      present: true,
      text: (el.textContent || '').trim(),
      role: el.getAttribute('role'),
      live: el.getAttribute('aria-live'),
      kind: el.getAttribute('data-error-kind'),
      msgFound: !!msg,
      msgText: msg ? msg.textContent : null,
      msgHtml: msg ? msg.innerHTML : null,
      msgElementChildren: msg ? msg.children.length : -1,
      html: el.innerHTML,
      focusInRegion: el === active || el.contains(active),
      focusInForm: f.contains(active),
      activeTag: active ? active.tagName.toLowerCase() : null,
      fg: getComputedStyle(el).color,
      bg: getComputedStyle(el).backgroundColor,
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    };
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // ── Static: no alert() may survive in the app source ──────────────────────
  const src = fs.readFileSync(path.join(__dirname, '../src/App.jsx'), 'utf8');
  const alertCount = (src.match(/(^|[^.\w])alert\(/g) || []).length;
  note(alertCount === 0, 'src/App.jsx contains no alert( call', `found ${alertCount}`);
  // The plan's acceptance is a literal `grep -c "alert(" src/App.jsx` -> 0.
  // Checked as written, not just in spirit — a comment mentioning alert( fails
  // it, so the comments are worded to avoid the token.
  const literal = (src.match(/alert\(/g) || []).length;
  note(literal === 0, 'grep -c "alert(" src/App.jsx is 0, as the plan states', `found ${literal}`);

  note(!!NETWORK_MSG, 'cf.networkError is readable from content.json', 'not found');

  const browser = await launch();

  for (const width of [1440, 375]) {
    for (const tab of TABS) {
      const tag = `${tab.id}@${width}`;

      // ── 1. Real server validation error ──────────────────────────────────
      {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        // The 5-per-10-min limiter is keyed on IP and these all come from
        // 127.0.0.1; clear it so the suite tests the validation path and not
        // the 429.
        for (const f of fs.readdirSync('/tmp')) {
          if (f.startsWith('ipc_rl_')) { try { fs.unlinkSync('/tmp/' + f); } catch {} }
        }
        const { page, dialogs, form } = await openForm(ctx, tab);
        await submitBypassingClientValidation(page, form);
        const r = await readErrorRegion(form);

        note(dialogs.length === 0, `${tag}: no browser alert() raised`, `raised: ${JSON.stringify(dialogs)}`);
        note(r.present, `${tag}: an inline role="alert" region is rendered`);
        note(!!r.visible, `${tag}: the error region is actually visible`);
        note(r.text === SERVER_MSG[tab.id],
          `${tag}: shows the server's own message verbatim`,
          `wanted ${JSON.stringify(SERVER_MSG[tab.id])}, got ${JSON.stringify(r.text)}`);
        note(!!(r.focusInRegion || (r.focusInForm && r.activeTag !== 'body')),
          `${tag}: focus moves into the error region or an offending field`,
          `activeElement=${r.activeTag} inRegion=${r.focusInRegion} inForm=${r.focusInForm}`);

        // The region's colors are fixed rather than brand-derived on purpose —
        // an error has to stay legible whatever the owner picks in Branding.
        // Measured, not asserted from the source.
        const cr = contrast(r.fg, r.bg);
        note(cr >= 4.5, `${tag}: the error text meets AA against its own panel`,
          `${r.fg} on ${r.bg} = ${cr.toFixed(2)}:1`);

        await page.screenshot({ path: path.join(OUT, `${tab.id}-validation-${width}.png`), fullPage: false });
        await ctx.close();
      }

      // ── 2. Literal rendering of a spec string (invariant 10) ─────────────
      {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        const { page, dialogs, form } = await openForm(ctx, tab);
        await page.route('**/contact.php', (r) =>
          r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, error: SPECY }) }));
        await submitBypassingClientValidation(page, form);
        const r = await readErrorRegion(form);

        note(dialogs.length === 0, `${tag}: no alert() on the echoed-spec error`);
        note(r.present && r.text === SPECY,
          `${tag}: a spec string renders literally in the error region`,
          `wanted ${JSON.stringify(SPECY)}, got ${JSON.stringify(r.text)}`);
        note(r.msgFound && r.msgElementChildren === 0 && r.msgText === SPECY
             && r.msgHtml.includes('&lt;1/4') && r.msgHtml.includes('&gt;2'),
          `${tag}: the spec is a TEXT NODE — "<1/4" escaped, nothing parsed as markup`,
          `children=${r.msgElementChildren} innerHTML=${JSON.stringify(r.msgHtml)}`);
        await ctx.close();
      }

      // ── 3. Network failure, distinct from validation ─────────────────────
      {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        const { page, dialogs, form } = await openForm(ctx, tab);
        await page.route('**/contact.php', (r) => r.abort('failed'));
        await submitBypassingClientValidation(page, form);
        const r = await readErrorRegion(form);

        note(dialogs.length === 0, `${tag}: no alert() on network failure`);
        note(r.present && r.text === NETWORK_MSG,
          `${tag}: network failure shows cf.networkError`,
          `wanted ${JSON.stringify(NETWORK_MSG)}, got ${JSON.stringify(r.text)}`);
        note(r.present && r.text !== SERVER_MSG[tab.id] && r.kind === 'network',
          `${tag}: network failure is distinguishable from a validation failure`,
          `kind=${r.kind}`);

        await page.screenshot({ path: path.join(OUT, `${tab.id}-network-${width}.png`), fullPage: false });
        await ctx.close();
      }
    }
  }

  await browser.close();

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nplan3-contact: ${pass}/${results.length}`);
  console.log(`screenshots -> ${OUT}`);
  process.exit(pass === results.length ? 0 : 1);
})();
