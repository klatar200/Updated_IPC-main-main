/**
 * The contact form's HAPPY PATH, end to end, through the real UI.
 *
 * Why this file exists. Three suites already touch the contact form and none
 * of them submits a valid enquiry through the rendered page:
 *
 *   - `plan3-contact.js`  drives the UI but only ever submits INVALID forms —
 *                         it is about 4.5, the inline error region.
 *   - `plan3-autoreply.js` submits valid enquiries but POSTs to contact.php
 *                         directly with `fetch`, so the React form, its field
 *                         names, its FormData assembly and its confirmation
 *                         panel are never exercised.
 *   - `plan10-rfqscroll.js` measures where an invalid field lands and stops.
 *
 * So the one journey the whole site exists for — a visitor types a quote
 * request, presses the button, and sales receives it — was covered only in
 * halves that meet nowhere. A rename of a single `name=` attribute in App.jsx
 * would pass all three: the browser suites never read the mail, and the mail
 * suite never reads the browser. That gap is what this closes.
 *
 * Asserts, for BOTH forms, driven through the rendered page:
 *   - the submission is accepted and the confirmation panel replaces the form
 *   - EXACTLY TWO messages leave: the sales notification, then the auto-reply
 *   - every value the visitor typed reaches the sales email VERBATIM, matched
 *     field by field against what was typed — not "the body is non-empty"
 *   - the reply path is correct: Reply-To is the visitor, From is the domain
 *     no-reply, and no Cc/Bcc appears in either header block
 *   - inquiries.jsonl gains one entry carrying the same values, `sent: true`
 *   - the business details in the auto-reply come from site-info.json, so the
 *     admin's Business Details edits reach a customer-facing email
 *   - a real quote-request spec string (`<1/4 inch and >2 inch ID, 1/2" wall`,
 *     `O'Brien & Sons`) survives the whole path unmangled — invariant 10, the
 *     strip_tags()/htmlspecialchars() incident, checked at the far end
 *   - ?part= and ?industry= prefill and reach the email (4.6, C31)
 *   - the honeypot is invisible AND unreachable by keyboard, and a filled one
 *     is logged rather than dropped (4.18)
 *   - the browser's own required-field validation stops an empty submit before
 *     a request is made
 *   - the 429 reaches the visitor as the inline panel with the phone number in
 *     it, not as a dead button
 *   - the submit button cannot be double-fired
 *   - Submit Another, and Back from the confirmation, both return an empty
 *     form and send nothing
 *   - every `name=` the forms post is a key contact.php actually reads
 *
 * Needs the mirror on :8123 started with `-c _harness/php-mail.ini`, so mail()
 * succeeds and the messages are captured. Writes nothing under data/.
 *
 * Usage: node _harness/contactflow.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'contactflow');
// os.tmpdir(), not '/tmp' — contact.php writes these through PHP's
// sys_get_temp_dir(). Same reasoning as plan3-contact.js.
const MAIL_LOG = process.env.IPC_MAIL_LOG || path.join(os.tmpdir(), 'ipc-harness-mail.log');
const INQUIRIES = path.join(__dirname, 'site/admin/inquiries.jsonl');
const SITE_INFO = path.join(__dirname, 'site/data/site-info.json');
const CONTACT_PHP = path.join(__dirname, 'site/contact.php');

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

// `--only=<tag>` runs one scenario. This exists for `contactflow-selftest.js`,
// which mutates the tree once per assertion it wants to see fail: a full run
// per mutation is ~90 s and the selftest makes eight of them.
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const want = (tag) => !ONLY || tag === ONLY;

// ── Captured mail ──────────────────────────────────────────────────────────
// fakemail.sh appends the FULL message — headers included, because PHP invokes
// sendmail with -t — after a ===MESSAGE=== marker.
function capturedMessages() {
  if (!fs.existsSync(MAIL_LOG)) return [];
  return fs.readFileSync(MAIL_LOG, 'utf8')
    .split('===MESSAGE===').slice(1)
    .map((m) => {
      const header = (name) => ((m.match(new RegExp('^' + name + ':\\s*(.+)$', 'mi')) || [])[1] || '').trim();
      return {
        raw: m,
        to: header('To'),
        subject: header('Subject'),
        from: header('From'),
        replyTo: header('Reply-To'),
        // The body is everything past the blank line that ends the header block.
        body: m.split(/\r?\n\r?\n/).slice(1).join('\n\n'),
      };
    });
}
const clearMail = () => { try { fs.writeFileSync(MAIL_LOG, ''); } catch {} };

// ── Rate-limit / auto-reply cap state ──────────────────────────────────────
const clearTmp = (prefix) => {
  for (const f of fs.readdirSync(os.tmpdir())) {
    if (f.startsWith(prefix)) { try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch {} }
  }
};
// Both, before every scenario. The 5-per-10-min IP limiter and the 3-per-24h
// per-recipient auto-reply cap are separate guards with their own suites; left
// alone they would swallow the tail of this run and the failure would look
// like a broken form.
const clearGuards = () => { clearTmp('ipc_rl_'); clearTmp('ipc_ar_'); };

// ── Inquiry log ────────────────────────────────────────────────────────────
function inquiryLines() {
  if (!fs.existsSync(INQUIRIES)) return [];
  return fs.readFileSync(INQUIRIES, 'utf8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}
const inquiryCount = () => inquiryLines().length;
const lastInquiry = () => inquiryLines().slice(-1)[0] || null;

const SITE = JSON.parse(fs.readFileSync(SITE_INFO, 'utf8'));
const SALES = (SITE.contact && SITE.contact.email) || 'sales@insulationproducts.com';

// ── The values a real visitor types ────────────────────────────────────────
// Deliberately hostile in the ways that have actually cost this company a
// lead: an angle-bracketed fraction (strip_tags ate one), an inch mark and an
// ampersand-plus-apostrophe company name (htmlspecialchars double-escaped one),
// and a non-ASCII character, because the /u modifier incident (NB6) means the
// byte-wise regex in s() has to be proven safe on real UTF-8 rather than
// assumed.
const SPEC = '<1/4 inch and >2 inch ID, 1/2" wall';
const COMPANY = "O'Brien & Sons";
const UNICODE = 'Ø3 µm — café';

const RFQ = {
  name: 'Dana Whitfield',
  email: 'dana.whitfield@example-aero.test',
  phone: '312-555-0147',
  company: COMPANY,
  partNumber: 'IP30HS',
  material: `Fiberglass ${UNICODE}`,
  quantity: '500 ft',
  requiredDate: 'week of Sept 8',
  specialReqs: SPEC,
  additionalNotes: 'Repeat order, PO to follow. Ship to dock 4.',
};

const MSG = {
  name: 'Priya Raman',
  email: 'priya.raman@example-mfg.test',
  phone: '630-555-0182',
  company: COMPANY,
  subject: `Sleeving for ${UNICODE} harness`,
  message: `Need a quote on ${SPEC}. Please confirm lead time.`,
};

// ── Page helpers ───────────────────────────────────────────────────────────
async function openContact(ctx, { tab = 'rfq', query = '' } = {}) {
  const page = await ctx.newPage();
  const dialogs = [];
  const posts = [];
  page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
  page.on('request', (r) => { if (r.url().includes('/contact.php')) posts.push(r.method()); });
  await page.goto(`${BASE}/contact${query}`, { waitUntil: 'networkidle' });
  if (tab !== 'rfq') {
    await page.click('text=Send a Message');
    await page.waitForTimeout(200);
  }
  const form = page.locator('form').filter({ has: page.locator('button[type="submit"]') }).first();
  return { page, form, dialogs, posts };
}

/** Type every value through the real controls, as a visitor would. */
async function fillForm(form, values) {
  for (const [k, v] of Object.entries(values)) {
    await form.locator(`[name="${k}"]`).fill(v);
  }
}

/** Submit and wait for the confirmation panel (or for an error to render). */
async function submitAndSettle(page, form) {
  await form.locator('button[type="submit"]').click();
  await page.waitForTimeout(1200);
}

/** What the confirmation panel looks like, measured in the page. */
async function readConfirmation(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[role="status"]');
    const active = document.activeElement;
    return {
      present: !!el,
      focused: !!el && (el === active || el.contains(active)),
      live: el ? el.getAttribute('aria-live') : null,
      text: el ? (el.textContent || '').trim() : '',
      heading: (document.querySelector('h1') || {}).textContent || '',
      formPresent: !!document.querySelector('form button[type="submit"]'),
      url: location.pathname + location.search,
    };
  });
}

/** Every field value in the visible form, keyed by name. */
async function readFormValues(form) {
  return form.evaluate((f) =>
    Object.fromEntries([...f.elements]
      .filter((el) => el.name && el.type !== 'submit')
      .map((el) => [el.name, el.value])));
}

// Assert every typed value appears verbatim in a captured body, and say WHICH
// field failed — "the body is missing something" is not an actionable failure.
function missingFields(body, values) {
  return Object.entries(values).filter(([, v]) => v !== '' && !body.includes(v)).map(([k]) => k);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();

  // ═══ 1. RFQ happy path, through the rendered form ════════════════════════
  if (want('rfq')) {
    clearGuards();
    clearMail();
    const before = inquiryCount();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, form, dialogs } = await openContact(ctx);

    await fillForm(form, RFQ);
    await submitAndSettle(page, form);

    const conf = await readConfirmation(page);
    note(dialogs.length === 0, 'rfq: no browser dialog on a successful submit', JSON.stringify(dialogs));
    note(conf.present, 'rfq: the confirmation panel replaced the form');
    note(!conf.formPresent, 'rfq: the form itself is gone, so nothing can be re-submitted by accident');
    note(conf.focused, 'rfq: focus moves into the confirmation (B16)');
    note(conf.live === 'polite', 'rfq: the confirmation is announced politely', `aria-live=${conf.live}`);
    note(conf.url === '/contact?sent=1', 'rfq: the confirmation has its own URL (B17)', `url=${conf.url}`);

    const mail = capturedMessages();
    note(mail.length === 2, 'rfq: exactly two messages left — sales, then the visitor',
      `captured ${mail.length}: ${JSON.stringify(mail.map((m) => m.to))}`);

    const sales = mail[0] || { raw: '', body: '', to: '', subject: '', from: '', replyTo: '' };
    note(sales.to === SALES, 'rfq: the sales notification went to the address in site-info.json',
      `to=${sales.to} wanted=${SALES}`);
    note(sales.subject === `IPC Quote Request — ${RFQ.partNumber} — ${RFQ.name}`,
      'rfq: the subject names the part number and the sender', `subject=${JSON.stringify(sales.subject)}`);
    const missing = missingFields(sales.body, RFQ);
    note(missing.length === 0, 'rfq: EVERY typed value reached the sales email verbatim',
      `missing from the body: ${missing.join(', ')}`);
    note(sales.body.includes(SPEC),
      'rfq: the angle-bracketed spec survived — nothing was stripped (invariant 10)',
      `body did not contain ${JSON.stringify(SPEC)}`);
    note(sales.body.includes(COMPANY) && !sales.body.includes('&amp;') && !sales.body.includes('&#039;'),
      'rfq: the company name is not HTML-escaped on its way to a text/plain email',
      `body has &amp;=${sales.body.includes('&amp;')} &#039;=${sales.body.includes('&#039;')}`);
    note(sales.replyTo === RFQ.email, 'rfq: Reply-To is the visitor, so sales can just hit reply',
      `reply-to=${sales.replyTo}`);
    note(/noreply@insulationproducts\.com/.test(sales.from),
      'rfq: From is the domain no-reply (Network Solutions outbound filter)', `from=${sales.from}`);
    note(!/^(Bcc|Cc):/mi.test(sales.raw.split(/\r?\n\r?\n/)[0] || ''),
      'rfq: the sales header block carries no Cc or Bcc');

    const reply = mail[1] || { body: '', to: '', subject: '', raw: '' };
    note(reply.to === RFQ.email, 'rfq: the auto-reply went to the visitor', `to=${reply.to}`);
    note(reply.subject.startsWith('We received your quote request'),
      'rfq: the auto-reply subject confirms the quote request', `subject=${JSON.stringify(reply.subject)}`);
    // The auto-reply quotes the business details. These come from site-info.json,
    // which is what the owner edits under Business Details — a hardcoded copy
    // here would mean a phone-number change never reaching a customer.
    const biz = [SITE.contact.phone, SITE.contact.fax, SALES, SITE.address.street, SITE.address.city];
    const bizMissing = biz.filter((v) => v && !reply.body.includes(v));
    note(bizMissing.length === 0, 'rfq: the auto-reply quotes the LIVE business details from site-info.json',
      `missing: ${bizMissing.join(', ')}`);
    note(reply.body.includes(RFQ.partNumber) && reply.body.includes(RFQ.quantity),
      'rfq: the auto-reply summarises what was actually requested');

    const entry = lastInquiry();
    note(inquiryCount() === before + 1, 'rfq: exactly one line was appended to inquiries.jsonl',
      `${before} -> ${inquiryCount()}`);
    note(!!entry && entry.type === 'rfq' && entry.sent === true,
      'rfq: the inquiry is logged as a sent RFQ', JSON.stringify(entry && { type: entry.type, sent: entry.sent }));
    const logMismatch = entry ? Object.entries({
      name: RFQ.name, email: RFQ.email, phone: RFQ.phone, company: RFQ.company,
      part: RFQ.partNumber, material: RFQ.material, quantity: RFQ.quantity,
      reqDate: RFQ.requiredDate, special: RFQ.specialReqs, notes: RFQ.additionalNotes,
    }).filter(([k, v]) => entry[k] !== v).map(([k]) => k) : ['no entry'];
    note(logMismatch.length === 0, 'rfq: the logged lead matches what was typed, field for field',
      `differing: ${logMismatch.join(', ')}`);

    await page.screenshot({ path: path.join(OUT, 'rfq-confirmation.png') });
    await ctx.close();
  }

  // ═══ 2. Message happy path ═══════════════════════════════════════════════
  if (want('message')) {
    clearGuards();
    clearMail();
    const before = inquiryCount();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, form, dialogs } = await openContact(ctx, { tab: 'message' });

    await fillForm(form, MSG);
    await submitAndSettle(page, form);

    const conf = await readConfirmation(page);
    note(dialogs.length === 0, 'message: no browser dialog on a successful submit');
    note(conf.present && !conf.formPresent, 'message: the confirmation panel replaced the form');
    note(conf.url === '/contact?sent=1', 'message: the confirmation has its own URL', `url=${conf.url}`);

    const mail = capturedMessages();
    note(mail.length === 2, 'message: exactly two messages left',
      `captured ${mail.length}: ${JSON.stringify(mail.map((m) => m.to))}`);

    const sales = mail[0] || { body: '', to: '', subject: '', replyTo: '' };
    note(sales.to === SALES, 'message: the sales notification went to the configured address', `to=${sales.to}`);
    note(sales.subject === `IPC Contact Form — ${MSG.subject} — ${MSG.name}`,
      'message: the subject carries the visitor\'s own subject line', `subject=${JSON.stringify(sales.subject)}`);
    const missing = missingFields(sales.body, MSG);
    note(missing.length === 0, 'message: EVERY typed value reached the sales email verbatim',
      `missing from the body: ${missing.join(', ')}`);
    note(sales.replyTo === MSG.email, 'message: Reply-To is the visitor', `reply-to=${sales.replyTo}`);

    const reply = mail[1] || { body: '', to: '', subject: '' };
    note(reply.to === MSG.email, 'message: the auto-reply went to the visitor', `to=${reply.to}`);
    note(reply.subject.startsWith('We received your message'),
      'message: the auto-reply subject matches the message form, not the RFQ one',
      `subject=${JSON.stringify(reply.subject)}`);

    const entry = lastInquiry();
    note(inquiryCount() === before + 1, 'message: exactly one line was appended to inquiries.jsonl');
    note(!!entry && entry.type === 'message' && entry.sent === true,
      'message: the inquiry is logged as a sent message');
    const logMismatch = entry ? Object.entries({
      name: MSG.name, email: MSG.email, phone: MSG.phone,
      company: MSG.company, subject: MSG.subject, message: MSG.message,
    }).filter(([k, v]) => entry[k] !== v).map(([k]) => k) : ['no entry'];
    note(logMismatch.length === 0, 'message: the logged lead matches what was typed, field for field',
      `differing: ${logMismatch.join(', ')}`);

    await page.screenshot({ path: path.join(OUT, 'message-confirmation.png') });
    await ctx.close();
  }

  // ═══ 3. Prefill from a product page and from Industries ══════════════════
  // 4.6 (?part=) and C31 (?industry=). The prefill is only worth anything if
  // the value survives all the way into the email, so it is asserted there.
  if (want('prefill')) {
    clearGuards();
    clearMail();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, form } = await openContact(ctx, { query: '?part=IP75AD&industry=Aerospace' });

    const prefilled = await readFormValues(form);
    note(prefilled.partNumber === 'IP75AD', 'prefill: ?part= lands in the Part Number field (4.6)',
      `partNumber=${JSON.stringify(prefilled.partNumber)}`);
    note((prefilled.additionalNotes || '').includes('Aerospace'),
      'prefill: ?industry= lands in the notes (C31)', `notes=${JSON.stringify(prefilled.additionalNotes)}`);

    await fillForm(form, { name: 'Sam Ortiz', email: 'sam.ortiz@example-x.test', quantity: '200 ft' });
    await submitAndSettle(page, form);
    const mail = capturedMessages();
    const sales = mail[0] || { body: '', subject: '' };
    note(sales.subject.includes('IP75AD') && sales.body.includes('IP75AD'),
      'prefill: the prefilled part number reaches the sales email');
    note(sales.body.includes('Aerospace'), 'prefill: the industry context reaches the sales email');
    await ctx.close();
  }

  // ═══ 4. The honeypot ═════════════════════════════════════════════════════
  if (want('honeypot')) {
    clearGuards();
    clearMail();
    const before = inquiryCount();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, form } = await openContact(ctx);

    // Invisible to a sighted visitor AND unreachable by keyboard. An
    // honest-but-tabbable honeypot catches the keyboard user, not the bot.
    const pot = await form.evaluate((f) => {
      const el = f.querySelector('[name="website"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        tabIndex: el.tabIndex,
        inViewport: r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight,
        hiddenFromA11y: !!el.closest('[aria-hidden="true"]'),
        autoComplete: el.autocomplete,
      };
    });
    note(!!pot && pot.tabIndex === -1, 'honeypot: not reachable by keyboard', JSON.stringify(pot));
    note(!!pot && !pot.inViewport, 'honeypot: painted off-screen, invisible to a sighted visitor', JSON.stringify(pot));
    note(!!pot && pot.hiddenFromA11y, 'honeypot: hidden from the accessibility tree too', JSON.stringify(pot));
    note(!!pot && pot.autoComplete === 'off', 'honeypot: autocomplete is off so a password manager is less likely to fill it');

    // A bot fills every field, the hidden one included.
    await fillForm(form, { name: 'Bot Spam', email: 'bot@example-spam.test', quantity: '1' });
    await form.locator('[name="website"]').evaluate((el) => {
      el.value = 'http://spam.example';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await submitAndSettle(page, form);

    const conf = await readConfirmation(page);
    note(conf.present, 'honeypot: the bot is shown the ordinary confirmation, learning nothing');
    note(capturedMessages().length === 0, 'honeypot: NO mail was sent',
      `captured ${capturedMessages().length}`);
    const entry = lastInquiry();
    note(inquiryCount() === before + 1 && entry && entry.type === 'honeypot',
      'honeypot: the submission is still logged, so a false positive is recoverable (4.18)',
      JSON.stringify(entry && entry.type));
    await ctx.close();
  }

  // ═══ 5. The browser's own validation stops an empty submit ═══════════════
  if (want('validation')) {
    clearGuards();
    clearMail();
    const before = inquiryCount();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, form, posts } = await openContact(ctx);
    await form.locator('button[type="submit"]').click();
    await page.waitForTimeout(500);
    note(posts.length === 0, 'validation: an empty form makes NO request to contact.php',
      `requests: ${JSON.stringify(posts)}`);
    const state = await form.evaluate((f) => {
      const first = [...f.elements].find((el) => el.willValidate && !el.checkValidity());
      return { first: first ? first.name : null, focused: document.activeElement === first };
    });
    note(state.first === 'name', 'validation: the browser stops on the first required field',
      `first invalid = ${state.first}`);
    note(inquiryCount() === before, 'validation: nothing was logged for a submit that never happened');
    await ctx.close();
  }

  // ═══ 6. The rate limit reaches the visitor ═══════════════════════════════
  // Five direct POSTs consume the window (that guard has its own coverage);
  // the SIXTH goes through the UI, because what is being checked here is that
  // a 429 becomes a readable panel with the phone number in it rather than a
  // button that does nothing.
  if (want('ratelimit')) {
    clearGuards();
    clearMail();
    for (let i = 0; i < 5; i++) {
      const b = new FormData();
      // A-04 (audit-runs/audit1.md): contact.php now enforces the two fields
      // the rendered form already marks required. This fixture predates that
      // and omitted subject, so the POST 422s and the assertions below measure a
      // submission that never happened. The real form always sends it.
      // (audit-runs/audit3.md C-04)
      b.append('form_type', 'message');
      b.append('name', 'Window Filler');
      b.append('email', `filler${i}@example-rl.test`);
      b.append('subject', 'Rate-limit filler');
      b.append('message', 'consuming a rate-limit slot');
      await fetch(`${BASE}/contact.php`, { method: 'POST', body: b });
    }
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, form, dialogs } = await openContact(ctx);
    await fillForm(form, { name: 'Sixth Caller', email: 'sixth@example-rl.test', quantity: '10 ft' });
    await submitAndSettle(page, form);
    const r = await form.evaluate((f) => {
      const el = f.querySelector('[role="alert"]');
      return el ? { text: (el.textContent || '').trim(), kind: el.getAttribute('data-error-kind') } : null;
    });
    note(dialogs.length === 0, 'rate limit: no browser dialog');
    note(!!r, 'rate limit: the refusal is shown as the inline panel, not a dead button');
    note(!!r && r.text.includes(SITE.contact.phone),
      'rate limit: the message tells the visitor to call, with the live phone number',
      `text=${JSON.stringify(r && r.text)}`);
    note(!!r && r.kind === 'validation',
      'rate limit: it is a server refusal, not reported as a network failure', `kind=${r && r.kind}`);
    const entry = lastInquiry();
    note(!!entry && entry.type === 'rate-limited',
      'rate limit: the refused lead is still recoverable from the inquiry log', JSON.stringify(entry && entry.type));
    await ctx.close();
    clearGuards();
  }

  // ═══ 7. The submit button cannot be double-fired ═════════════════════════
  if (want('double')) {
    clearGuards();
    clearMail();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, form } = await openContact(ctx);
    // Hold the response open so the in-flight state can be observed at all.
    await page.route('**/contact.php', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await fillForm(form, { name: 'Impatient Buyer', email: 'impatient@example-d.test', quantity: '5 ft' });
    const btn = form.locator('button[type="submit"]');
    let posts = 0;
    page.on('request', (r) => { if (r.url().includes('/contact.php')) posts++; });
    await btn.click();
    await page.waitForTimeout(250);
    const midFlight = await btn.evaluate((b) => ({ disabled: b.disabled, label: (b.textContent || '').trim() }));
    note(midFlight.disabled, 'double-submit: the button disables itself while the request is in flight');
    note(midFlight.label.length > 0, 'double-submit: it says what it is doing', `label=${JSON.stringify(midFlight.label)}`);
    await btn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
    note(posts === 1, 'double-submit: a second click sends nothing — one enquiry, not two', `posts=${posts}`);
    await ctx.close();
  }

  // ═══ 8. Submit Another, and Back ═════════════════════════════════════════
  if (want('reset')) {
    clearGuards();
    clearMail();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, form } = await openContact(ctx);
    await fillForm(form, { name: 'Rae Lindgren', email: 'rae@example-again.test', quantity: '25 ft', partNumber: 'IP30HS' });
    await submitAndSettle(page, form);
    note((await readConfirmation(page)).present, 'reset: submitted once to get to the confirmation');
    const sentSoFar = capturedMessages().length;

    await page.click('text=Submit Another');
    await page.waitForTimeout(400);
    const after = await readConfirmation(page);
    note(after.formPresent, 'reset: Submit Another brings the form back');
    note(after.url === '/contact', 'reset: and clears ?sent= from the URL', `url=${after.url}`);
    const vals = await readFormValues(page.locator('form').filter({ has: page.locator('button[type="submit"]') }).first());
    const leftover = Object.entries(vals).filter(([k, v]) => k !== 'form_type' && v !== '').map(([k]) => k);
    note(leftover.length === 0, 'reset: every field is empty again — no stale lead half-typed into the next one',
      `still filled: ${leftover.join(', ')}`);

    // Back from the confirmation must return to the form and re-post nothing.
    await page.goBack();
    await page.waitForTimeout(400);
    const back = await readConfirmation(page);
    note(back.formPresent || back.present, 'back: the Back button leaves the app in a rendered state', JSON.stringify(back.url));
    note(capturedMessages().length === sentSoFar, 'back: navigating back re-sends nothing',
      `${sentSoFar} -> ${capturedMessages().length}`);
    await ctx.close();
  }

  // ═══ 9. Field-name drift: what the forms post vs what the PHP reads ══════
  // Measured in the browser, then matched against contact.php's own source.
  // A renamed input is invisible to every other suite: the browser ones never
  // read the mail and the mail one never renders the form.
  if (want('drift')) {
    const php = fs.readFileSync(CONTACT_PHP, 'utf8');
    const read = new Set([...php.matchAll(/\$_POST\[\s*'([^']+)'\s*\]/g)].map((m) => m[1]));
    note(read.size > 0, 'drift: contact.php\'s $_POST keys were readable', `found ${read.size}`);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    for (const tab of ['rfq', 'message']) {
      const { page, form } = await openContact(ctx, { tab });
      const names = await form.evaluate((f) =>
        [...new Set([...f.elements].filter((el) => el.name).map((el) => el.name))]);
      const orphans = names.filter((n) => !read.has(n));
      note(orphans.length === 0, `drift: every field the ${tab} form posts is one contact.php reads`,
        `contact.php never reads: ${orphans.join(', ')}`);
      note(names.includes('name') && names.includes('email'),
        `drift: the ${tab} form still posts the fields the server requires`, names.join(','));
      await page.close();
    }
    await ctx.close();
  }

  // ═══ 10. Oversized input is truncated, not dropped ═══════════════════════
  if (want('truncation')) {
    clearGuards();
    clearMail();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page, form } = await openContact(ctx, { tab: 'message' });
    const huge = 'A'.repeat(6000);
    await fillForm(form, {
      name: 'Verbose Engineer', email: 'verbose@example-long.test',
      subject: 'Long spec', message: huge,
    });
    await submitAndSettle(page, form);
    note((await readConfirmation(page)).present, 'truncation: an oversized message is still accepted');
    const sales = capturedMessages()[0] || { body: '' };
    note(sales.body.includes('[truncated'),
      'truncation: the cut is announced in the email, so nobody quotes half a spec back',
      'no truncation notice in the body');
    note(sales.body.length < 20000, 'truncation: the email is bounded', `body length ${sales.body.length}`);
    await ctx.close();
    clearGuards();
  }

  // ═══ 11. Every field is labelled, and labelled with its OWN label ════════
  // The acceptance check for the message-tab label defect (WHATS_LEFT §2).
  // Four labels on that tab carried `htmlFor="rfq-subject"`, a copy-paste from
  // the RFQ form: measured, `input[name=name].labels` was EMPTY there while
  // the Subject input had FIVE labels, four of them naming other fields, and
  // clicking "Full Name" moved focus to Subject.
  //
  // Asserted by ASSOCIATION AND BY TEXT, on both tabs. Association alone would
  // pass if all four pointed at one input each carrying the wrong words, and
  // the text comparison alone would pass on the broken tree, because the right
  // words were on screen the whole time — sitting above the wrong input.
  if (want('labels')) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    for (const tab of ['rfq', 'message']) {
      const { page, form } = await openContact(ctx, { tab });
      const fields = await form.evaluate((f) =>
        [...f.elements]
          .filter((el) => el.name && el.name !== 'website' && el.type !== 'submit')
          .map((el) => {
            // The label the visitor sees: the one rendered in this field's own
            // wrapper, which is what the eye associates regardless of the DOM.
            const visible = el.parentElement ? el.parentElement.querySelector('label') : null;
            return {
              name: el.name,
              id: el.id || null,
              labelCount: (el.labels || []).length,
              labelText: (el.labels || []).length ? el.labels[0].textContent.trim() : null,
              visibleText: visible ? visible.textContent.trim() : null,
            };
          }));
      const dupes = await page.evaluate(() => {
        const seen = new Map();
        for (const el of document.querySelectorAll('[id]')) seen.set(el.id, (seen.get(el.id) || 0) + 1);
        return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
      });

      const unlabelled = fields.filter((f) => f.labelCount === 0).map((f) => f.name);
      note(unlabelled.length === 0, `labels: every ${tab} field has an associated label`,
        `no label: ${unlabelled.join(', ')}`);
      const overLabelled = fields.filter((f) => f.labelCount > 1).map((f) => `${f.name}(${f.labelCount})`);
      note(overLabelled.length === 0, `labels: no ${tab} field collects labels meant for other fields`,
        `multiply labelled: ${overLabelled.join(', ')}`);
      const mismatched = fields.filter((f) => f.labelText !== f.visibleText)
        .map((f) => `${f.name}: hears ${JSON.stringify(f.labelText)}, sees ${JSON.stringify(f.visibleText)}`);
      note(mismatched.length === 0,
        `labels: the ${tab} label a screen reader announces is the one printed above the field`,
        mismatched.join(' | '));
      note(dupes.length === 0, `labels: no duplicate ids on the ${tab} tab`, dupes.join(', '));

      // And the sighted-mouse half: clicking a label must focus its own field.
      const misdirected = [];
      for (const f of fields) {
        const landed = await form.evaluate((form_, name) => {
          const el = [...form_.elements].find((x) => x.name === name);
          const lab = el.labels && el.labels.length ? el.labels[0] : null;
          if (!lab) return '(no label)';
          lab.click();
          return document.activeElement ? document.activeElement.name || document.activeElement.tagName : null;
        }, f.name);
        if (landed !== f.name) misdirected.push(`${f.name} -> ${landed}`);
      }
      note(misdirected.length === 0, `labels: clicking a ${tab} label focuses that field, not another one`,
        misdirected.join(', '));
      await page.close();
    }
    await ctx.close();
  }

  // ═══ 12. The owner can actually read the lead ════════════════════════════
  // The form "working" ends at the person who has to quote it. inquiries.jsonl
  // is the safety net for a failed mail(), and it is only a safety net if the
  // viewer renders it — and renders it correctly: invariant 10 puts the
  // escaping at THIS boundary, so the spec string that survived contact.php
  // unescaped has to arrive here as literal text, not as markup and not
  // double-escaped into `&amp;#039;`.
  if (want('viewer')) {
    clearGuards();
    clearMail();
    const marker = `VERIFY-${Date.now()}`;
    const body = new FormData();
    // A-04 (audit-runs/audit1.md): contact.php now enforces the two fields
    // the rendered form already marks required. This fixture predates that
    // and omitted quantity, so the POST 422s and the assertions below measure a
    // submission that never happened. The real form always sends it.
    // (audit-runs/audit3.md C-04)
    body.append('form_type', 'rfq');
    body.append('name', `Lead ${marker}`);
    body.append('email', 'viewer@example-read.test');
    body.append('company', COMPANY);
    body.append('partNumber', 'IP30HS');
    body.append('quantity', '500 ft');
    body.append('specialReqs', SPEC);
    await fetch(`${BASE}/contact.php`, { method: 'POST', body });

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="password"]', 'audit-pass-123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(400);
    await page.goto(`${BASE}/admin/inquiries.php`, { waitUntil: 'domcontentloaded' });

    const seen = await page.evaluate((m) => {
      const row = [...document.querySelectorAll('details')]
        .find((d) => (d.textContent || '').includes(m));
      if (!row) return null;
      row.open = true;
      const cells = [...row.querySelectorAll('td')].map((td) => td.textContent.trim());
      return { text: row.textContent, cells, html: row.innerHTML };
    }, marker);

    note(!!seen, 'viewer: the lead appears in admin/inquiries.php', 'the entry was not found on the page');
    note(!!seen && seen.cells.includes(SPEC),
      'viewer: the spec string renders LITERALLY — nothing stripped, nothing double-escaped (invariant 10)',
      `cells: ${JSON.stringify(seen && seen.cells)}`);
    note(!!seen && seen.text.includes(COMPANY) && !seen.text.includes('&#039;') && !seen.text.includes('&amp;'),
      'viewer: the company name is not double-escaped',
      `text had &#039;=${!!seen && seen.text.includes('&#039;')} &amp;=${!!seen && seen.text.includes('&amp;')}`);
    note(!!seen && !/<script|<b>|<i>/i.test(seen.html.replace(/<\/?(details|summary|div|table|tbody|tr|th|td|p|a|span|small)\b[^>]*>/gi, '')),
      'viewer: nothing in the lead was parsed as markup');
    await page.screenshot({ path: path.join(OUT, 'inquiry-viewer.png'), fullPage: false });
    await ctx.close();
    clearGuards();
  }

  await browser.close();

  const pass = results.filter((r) => r.ok).length;
  console.log(`\ncontactflow: ${pass}/${results.length}`);
  console.log(`screenshots -> ${OUT}`);
  process.exit(pass === results.length ? 0 : 1);
})();
