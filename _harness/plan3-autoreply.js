/**
 * PLAN-3 4.15b — plus- and dot-addressing defeats the auto-reply cap.
 *
 * contact.php caps the courtesy auto-reply per recipient, keyed on the address
 * AS SUBMITTED. Gmail treats a@gmail.com, a+1@gmail.com and a.b@gmail.com as
 * one mailbox, so a sender cycling +1/+2/+3 gets a fresh auto-reply every time
 * — i.e. the site can be used to mail a third party, from IPC's domain, under
 * IPC's From:.
 *
 * The fix normalises the CAP KEY ONLY. Two things must NOT change, and both are
 * asserted here because getting either wrong is worse than the defect:
 *   - the sales notification must still fire for EVERY submission (suppressing
 *     a lead to fix a spam nuisance is a strictly worse outcome)
 *   - inquiries.jsonl must record each address exactly as submitted, dots and
 *     plus tags intact, or Rick's lead record is corrupted
 *
 * And dot-stripping must apply to the Gmail family ONLY. Dots are significant
 * almost everywhere else; collapsing them would merge genuinely different
 * people onto one cap and silently deny a real prospect their confirmation.
 *
 * Needs the mirror on :8123 started with -c _harness/php-mail.ini, so mail()
 * succeeds (otherwise contact.php exits 500 before the cap block ever runs).
 *
 * PLAN-6 item 3 (2026-08-07) added the owner-editable promise text and its
 * assertions live here too, because they share the same captured-mail rig and
 * because the thing most likely to break when the auto-reply body starts
 * reading content.json is the guarantee this file already protects: the SALES
 * NOTIFICATION FIRES FOR EVERY SUBMISSION. A corrupt content.json must cost a
 * nicety, never a lead.
 *
 * Usage: node _harness/plan3-autoreply.js
 */

const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8123';
const MAIL_LOG = process.env.IPC_MAIL_LOG || '/tmp/ipc-harness-mail.log';
const INQUIRIES = path.join(__dirname, 'site/admin/inquiries.jsonl');
const AR_MAX = 3;    // contact.php's $arMax
const SALES = 'sales@insulationproducts.com';
const CONTENT = path.join(__dirname, 'site/data/content.json');
const PRISTINE_CONTENT = path.join(__dirname, 'pristine/content.json');

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const tmpFiles = (prefix) => fs.readdirSync('/tmp').filter((f) => f.startsWith(prefix));
const clearTmp = (prefix) => { for (const f of tmpFiles(prefix)) { try { fs.unlinkSync('/tmp/' + f); } catch {} } };

/** Every captured message as {to, subject, body}, in send order. */
function capturedMessages() {
  if (!fs.existsSync(MAIL_LOG)) return [];
  return fs.readFileSync(MAIL_LOG, 'utf8')
    .split('===MESSAGE===').slice(1)
    .map((m) => ({
      to: ((m.match(/^To:\s*(.+)$/m) || [])[1] || '').trim(),
      subject: ((m.match(/^Subject:\s*(.+)$/m) || [])[1] || '').trim(),
      body: m,
    }));
}

/** Every To: address in the captured mail, in send order. */
function capturedRecipients() {
  if (!fs.existsSync(MAIL_LOG)) return [];
  return fs.readFileSync(MAIL_LOG, 'utf8')
    .split('===MESSAGE===').slice(1)
    .map((m) => (m.match(/^To:\s*(.+)$/m) || [])[1])
    .filter(Boolean)
    .map((s) => s.trim());
}

/** Rewrite the MIRROR's content.json copy.contactForm. Restored at the end. */
function writeCopy(patch) {
  const doc = JSON.parse(fs.readFileSync(PRISTINE_CONTENT, 'utf8'));
  doc.copy = doc.copy || {};
  doc.copy.contactForm = { ...(doc.copy.contactForm || {}), ...patch };
  fs.writeFileSync(CONTENT, JSON.stringify(doc, null, 2));
}

async function submitRfq(email, extra = {}) {
  clearTmp('ipc_rl_');
  const body = new FormData();
  body.append('form_type', 'rfq');
  body.append('name', 'Copy Test');
  body.append('email', email);
  body.append('partNumber', 'IP30HS');
  body.append('quantity', '500 ft');
  for (const [k, v] of Object.entries(extra)) body.append(k, v);
  const res = await fetch(`${BASE}/contact.php`, { method: 'POST', body });
  return res.json();
}

async function submit(email) {
  // The 5-per-10-minute IP limiter would otherwise swallow the tail of this
  // run — it is a separate guard with its own suite, not what is under test.
  clearTmp('ipc_rl_');
  const body = new FormData();
  body.append('form_type', 'message');
  body.append('name', 'Cap Test');
  body.append('email', email);
  body.append('message', 'checking the auto-reply cap');
  const res = await fetch(`${BASE}/contact.php`, { method: 'POST', body });
  return res.json();
}

/** Run a set of addresses through the form and report what each one produced. */
async function run(addresses) {
  const before = capturedRecipients().length;
  const out = [];
  for (const email of addresses) {
    const n = capturedRecipients().length;
    const json = await submit(email);
    const sent = capturedRecipients().slice(n);
    out.push({
      email,
      ok: json.ok === true,
      notified: sent.includes(SALES),
      autoReplied: sent.some((r) => r.toLowerCase() === email.toLowerCase()),
    });
  }
  return { rows: out, totalSent: capturedRecipients().length - before };
}

(async () => {
  if (!fs.existsSync(INQUIRIES)) fs.writeFileSync(INQUIRIES, '');
  const inqBefore = fs.readFileSync(INQUIRIES, 'utf8').split('\n').filter(Boolean).length;

  // ── Gmail family: four spellings of one mailbox ───────────────────────────
  clearTmp('ipc_ar_');
  try { fs.unlinkSync(MAIL_LOG); } catch {}

  const GMAIL = ['capa@gmail.com', 'capa+1@gmail.com', 'capa+2@gmail.com', 'ca.pa@gmail.com'];
  const gmail = await run(GMAIL);

  note(gmail.rows.every((r) => r.ok), 'gmail: every submission was accepted',
    JSON.stringify(gmail.rows.map((r) => [r.email, r.ok])));

  note(gmail.rows.every((r) => r.notified),
    'gmail: the SALES NOTIFICATION fired for every submission',
    JSON.stringify(gmail.rows.map((r) => [r.email, r.notified])));

  const keys = tmpFiles('ipc_ar_').length;
  note(keys === 1, 'gmail: the four spellings collapse to ONE cap key', `distinct cap files: ${keys}`);

  const replied = gmail.rows.filter((r) => r.autoReplied);
  note(replied.length === AR_MAX,
    `gmail: exactly ${AR_MAX} auto-replies went out, then the cap held`,
    `auto-replied: ${JSON.stringify(replied.map((r) => r.email))}`);

  note(gmail.rows.length === 4 && !gmail.rows[3].autoReplied,
    'gmail: the 4th spelling was refused an auto-reply',
    `${GMAIL[3]} autoReplied=${gmail.rows[3] && gmail.rows[3].autoReplied}`);

  // ── Everyone else: dots stay significant ──────────────────────────────────
  clearTmp('ipc_ar_');
  const OTHER = ['ca.pa@example.com', 'capa@example.com'];
  const other = await run(OTHER);

  note(other.rows.every((r) => r.notified),
    'non-gmail: the sales notification fired for every submission');
  note(other.rows.every((r) => r.autoReplied),
    'non-gmail: a.b@ and ab@ BOTH get their auto-reply',
    JSON.stringify(other.rows.map((r) => [r.email, r.autoReplied])));
  const otherKeys = tmpFiles('ipc_ar_').length;
  note(otherKeys === 2, 'non-gmail: a.b@ and ab@ remain DISTINCT cap keys',
    `distinct cap files: ${otherKeys}`);

  // ── The lead record is untouched ──────────────────────────────────────────
  const lines = fs.readFileSync(INQUIRIES, 'utf8').split('\n').filter(Boolean);
  const added = lines.slice(inqBefore).map((l) => { try { return JSON.parse(l); } catch { return {}; } });
  const loggedEmails = added.map((e) => e.email);
  const wanted = [...GMAIL, ...OTHER];
  note(JSON.stringify(loggedEmails) === JSON.stringify(wanted),
    'inquiries.jsonl records every address EXACTLY as submitted',
    `wanted ${JSON.stringify(wanted)}\n         got    ${JSON.stringify(loggedEmails)}`);

  // ── Every auto-reply went to the address as typed, not the normalised key ──
  const recips = capturedRecipients();
  const badTo = recips.filter((r) => r !== SALES && !wanted.includes(r));
  note(badTo.length === 0,
    'every auto-reply was addressed to the visitor as they typed it',
    `unexpected recipients: ${JSON.stringify(badTo)}`);

  // ── PLAN-6 item 3: the auto-reply's promise is owner-editable ────────────
  //
  // Everything AROUND the promise already came from site-info.json — business
  // name, phone, fax, email, hours, address — but the commitment itself
  // ("respond within one business day") was a string literal, so the owner
  // could not soften it for a holiday shutdown or a week without an estimator.
  //
  // Asserted against the CAPTURED MAIL, not the source: this is about what
  // lands in the customer's inbox.
  const RFQ_TEXT = 'Harness RFQ promise: two business days over the holiday.';
  const MSG_TEXT = 'Harness message promise: we answer within three days.';
  const NOTICE   = 'Harness notice: closed 24 Dec - 2 Jan.';
  try {
    clearTmp('ipc_ar_');
    try { fs.unlinkSync(MAIL_LOG); } catch {}
    writeCopy({
      autoReplyRfqPromise: RFQ_TEXT,
      autoReplyMsgPromise: MSG_TEXT,
      autoReplyNotice: NOTICE,
    });

    await submitRfq('copy-rfq@example.com');
    await submit('copy-msg@example.com');
    const msgs = capturedMessages();
    const rfqReply = msgs.find((m) => m.to === 'copy-rfq@example.com');
    const msgReply = msgs.find((m) => m.to === 'copy-msg@example.com');

    note(!!rfqReply && rfqReply.body.includes(RFQ_TEXT),
      'the RFQ auto-reply carries the promise text set in the admin',
      rfqReply ? rfqReply.body.slice(0, 300) : 'no auto-reply captured');
    note(!!msgReply && msgReply.body.includes(MSG_TEXT),
      'the message auto-reply carries its own promise text',
      msgReply ? msgReply.body.slice(0, 300) : 'no auto-reply captured');
    note(!!rfqReply && rfqReply.body.includes(NOTICE) &&
         !!msgReply && msgReply.body.includes(NOTICE),
      'the optional notice appears in both when set',
      JSON.stringify({ rfq: !!rfqReply && rfqReply.body.includes(NOTICE),
                       msg: !!msgReply && msgReply.body.includes(NOTICE) }));
    // The structured summary is deliberately NOT editable — it is data, and a
    // templating syntax in an admin textarea is a way to produce broken emails.
    note(!!rfqReply && /Part Number:\s*IP30HS/.test(rfqReply.body),
      'the request summary is still built by the code, not by the copy field',
      rfqReply ? rfqReply.body.slice(0, 400) : '');

    // An EMPTY notice must add nothing — not a blank line, not a stray dash.
    clearTmp('ipc_ar_');
    try { fs.unlinkSync(MAIL_LOG); } catch {}
    writeCopy({ autoReplyRfqPromise: RFQ_TEXT, autoReplyMsgPromise: MSG_TEXT, autoReplyNotice: '' });
    await submitRfq('copy-nonotice@example.com');
    const noNotice = capturedMessages().find((m) => m.to === 'copy-nonotice@example.com');
    note(!!noNotice && !noNotice.body.includes(NOTICE) && !/\n\n\n/.test(noNotice.body),
      'an empty notice adds nothing at all — no blank gap left behind',
      noNotice ? JSON.stringify(noNotice.body.slice(0, 400)) : 'no auto-reply captured');

    // ── A newline in a copy field is normalised to a space ──────────────────
    //
    // This assertion started life as "a CRLF cannot inject a mail header" and
    // PASSED WITH THE STRIP REMOVED, because that is not what the strip does.
    // Measured both ways: mail() takes body and headers as separate arguments,
    // so "Promise\r\nBcc: x" lands on its own line INSIDE the body either way
    // and the header block is untouched. 4.16 was a genuine injection because
    // company_name really was interpolated into a From: header; this is not
    // that, and claiming it was would be claiming protection nobody added.
    //
    // What the strip really guarantees is single-line prose — no line that
    // reads like a header to a naive client or a forwarding chain, and a value
    // that stays safe if any of these is ever moved into a SUBJECT. That is
    // falsifiable, so that is what is asserted.
    clearTmp('ipc_ar_');
    try { fs.unlinkSync(MAIL_LOG); } catch {}
    writeCopy({
      autoReplyRfqPromise: "Promise\r\nBcc: attacker@example.com",
      autoReplyMsgPromise: MSG_TEXT,
      autoReplyNotice: "Notice\r\nCc: attacker@example.com",
    });
    await submitRfq('copy-inject@example.com');
    const inj = capturedMessages().find((m) => m.to === 'copy-inject@example.com');
    note(!!inj && /^Promise Bcc: attacker@example\.com$/m.test(inj.body) &&
                 /^Notice Cc: attacker@example\.com$/m.test(inj.body),
      'a newline inside a copy field is normalised to a space, so the prose stays one line',
      inj ? JSON.stringify(inj.body.split(/\r?\n/).filter((l) => /Promise|Notice/.test(l))) : 'no reply');
    // And the header block is clean — true by construction here, kept as the
    // regression guard for the day one of these moves into a subject.
    const headerBlock = inj ? inj.body.split(/\r?\n\r?\n/)[0] : '';
    note(!!inj && !/^(Bcc|Cc):/im.test(headerBlock),
      'the auto-reply header block carries no Bcc or Cc',
      `header block:\n${headerBlock}`);

    // ── A corrupt or missing content.json must not stop a lead ──────────────
    for (const [label, write] of [
      ['corrupt', () => fs.writeFileSync(CONTENT, '{ not json')],
      ['missing', () => fs.rmSync(CONTENT, { force: true })],
    ]) {
      clearTmp('ipc_ar_');
      try { fs.unlinkSync(MAIL_LOG); } catch {}
      write();
      const json = await submitRfq(`copy-${label}@example.com`);
      const sent = capturedMessages();
      note(json.ok === true && sent.some((m) => m.to === SALES),
        `a ${label} content.json does not stop the SALES NOTIFICATION`,
        JSON.stringify({ ok: json.ok, to: sent.map((m) => m.to) }));
      const reply = sent.find((m) => m.to === `copy-${label}@example.com`);
      note(!!reply && /one business day/i.test(reply.body),
        `a ${label} content.json falls back to the built-in promise text`,
        reply ? reply.body.slice(0, 300) : 'no auto-reply captured');
    }
  } finally {
    fs.copyFileSync(PRISTINE_CONTENT, CONTENT);
  }
  note(fs.readFileSync(CONTENT).equals(fs.readFileSync(PRISTINE_CONTENT)),
    'the mirror\'s content.json is byte-identical to pristine afterwards');

  clearTmp('ipc_ar_');
  clearTmp('ipc_rl_');

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nplan3-autoreply: ${pass}/${results.length}`);
  process.exit(pass === results.length ? 0 : 1);
})();
