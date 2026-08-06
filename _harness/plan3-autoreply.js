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
 * Usage: node _harness/plan3-autoreply.js
 */

const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8123';
const MAIL_LOG = process.env.IPC_MAIL_LOG || '/tmp/ipc-harness-mail.log';
const INQUIRIES = path.join(__dirname, 'site/admin/inquiries.jsonl');
const AR_MAX = 3;    // contact.php's $arMax
const SALES = 'sales@insulationproducts.com';

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const tmpFiles = (prefix) => fs.readdirSync('/tmp').filter((f) => f.startsWith(prefix));
const clearTmp = (prefix) => { for (const f of tmpFiles(prefix)) { try { fs.unlinkSync('/tmp/' + f); } catch {} } };

/** Every To: address in the captured mail, in send order. */
function capturedRecipients() {
  if (!fs.existsSync(MAIL_LOG)) return [];
  return fs.readFileSync(MAIL_LOG, 'utf8')
    .split('===MESSAGE===').slice(1)
    .map((m) => (m.match(/^To:\s*(.+)$/m) || [])[1])
    .filter(Boolean)
    .map((s) => s.trim());
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

  clearTmp('ipc_ar_');
  clearTmp('ipc_rl_');

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nplan3-autoreply: ${pass}/${results.length}`);
  process.exit(pass === results.length ? 0 : 1);
})();
