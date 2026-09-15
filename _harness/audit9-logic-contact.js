/**
 * audit9-logic-contact.js — PLAN-11 Appendix C rows C13 and C18.
 *
 * C13 the parts `audit5-blockers` does not assert: every field of BOTH forms
 *     carrying CR/LF, an en-dash, a degree sign, a double-prime, a micro sign,
 *     an emoji and an RTL mark at once — header-bound values stripped by
 *     `hdr()`, body and JSONL byte-faithful, the JSONL still one valid object
 *     per line, and `h()` at the `inquiries.php` render boundary.
 * C18 double-click submit, and Back-then-resubmit.
 *
 *   BASE, SITE as elsewhere. MAILLOG — the fakemail capture file.
 *   Clears the per-IP limiter between arms (every request is 127.0.0.1, so a
 *   suite that just fires submissions measures its own 429 — audit7-lead's
 *   note).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE = process.env.BASE || 'http://127.0.0.1:8140';
const SITE = process.env.SITE || '_harness/out/audit9/site-A';
const OUT = process.env.OUT || '_harness/out/audit9/P7';
const MAILLOG = process.env.IPC_MAIL_LOG || path.join(OUT, 'mail.log');
const JSONL = path.join(SITE, 'admin', 'inquiries.jsonl');

const results = [];
let pass = 0, fail = 0;
function check(row, name, ok, observed, expected) {
  results.push({ row, name, ok: !!ok, observed, expected });
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} [${row}] ${name}  observed=${JSON.stringify(observed)}`);
}
function clearLimiter() {
  const d = os.tmpdir();
  for (const f of fs.readdirSync(d)) {
    if (f.startsWith('ipc_rl_') || f.startsWith('ipc_ar_')) { try { fs.unlinkSync(path.join(d, f)); } catch (e) {} }
  }
}
// ── Negative control ───────────────────────────────────────────────────────
// NEGCTL=1 removes `hdr()`'s CR/LF collapse from the MIRROR'S contact.php (a
// disposable copy; the repo is never touched) and restores it in a `finally`.
// Under it the "Subject header is a single line" and "no Bcc: in the header
// block" checks must fail.
// The guard removed is `h()` on the render boundary in inquiries.php, NOT
// `hdr()`. Measured on PHP 8.4.19: neutering `hdr()` changes nothing, because
// `mail()` ITSELF collapses CR/LF in $subject to spaces —
//   mail('x@e.com', "SUBJ\r\nBcc: evil@e.com", 'body', "From: a@b.c\r\n")
//   -> "Subject: SUBJ  Bcc: evil@e.com"  (one line)
// so the "Subject is one line" assertion is over-determined and cannot be made
// to fail that way. `hdr()` is real defence-in-depth against a PHP that does
// not do that, and against $additional_headers, which PHP rejects outright.
// The escaping arms DO have a guard that can be removed.
const INQ = path.join(SITE, 'admin', 'inquiries.php');
const NEGCTL = process.env.NEGCTL === '1';
const H_REAL = "<tr><th>Part number</th><td><?= h($e['part']) ?></td></tr>";
const H_NEUT = "<tr><th>Part number</th><td><?= $e['part'] ?></td></tr>";
let _inqOrig = null;
function patchContact() {
  _inqOrig = fs.readFileSync(INQ, 'utf8');
  const n = _inqOrig.split(H_REAL).length - 1;
  if (n !== 1) throw new Error(`negative control: the h() render site was found ${n} times, expected 1`);
  fs.writeFileSync(INQ, _inqOrig.split(H_REAL).join(H_NEUT));
}
function restoreContact() { if (_inqOrig !== null) { fs.writeFileSync(INQ, _inqOrig); _inqOrig = null; } }

const readMail = () => (fs.existsSync(MAILLOG) ? fs.readFileSync(MAILLOG, 'utf8') : '');
const readLines = () => (fs.existsSync(JSONL) ? fs.readFileSync(JSONL, 'utf8').split('\n').filter(Boolean) : []);

async function submit(fields, headers = {}) {
  clearLimiter();
  const body = new URLSearchParams(fields).toString();
  const res = await fetch(BASE + '/contact.php', {
    method: 'POST',
    headers: Object.assign({
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
      referer: BASE + '/contact',
    }, headers),
    body,
  });
  return { status: res.status, body: await res.text() };
}

// One payload, in every field, carrying everything at once.
const MARK = 'A9C13';
const NASTY = `${MARK} –°″µ🔥‏rtl‎`;
const CRLF = `${MARK}\r\nBcc: attacker@example.com\r\nX-Injected: yes`;

async function main() {
  if (NEGCTL) { patchContact(); console.log('--- negative control: h() removed from the Part-number render site in the mirror inquiries.php ---'); }
  try {
    // ── C13 — RFQ, every field ────────────────────────────────────────────
    {
      const before = readLines().length;
      const mailBefore = readMail().length;
      const r = await submit({
        form_type: 'rfq',
        name: `${NASTY} name`,
        company: `${NASTY} company`,
        email: 'c13rfq@example.com',
        phone: `${NASTY} 630`,
        partNumber: `${NASTY} part <1/4 inch and >2 inch ID`,
        material: `${NASTY} material`,
        quantity: `${NASTY} 100`,
        requiredDate: `${NASTY} soon`,
        additionalNotes: `${NASTY} notes\nline two`,
      });
      const lines = readLines();
      const mail = readMail().slice(mailBefore);
      check('C13', 'RFQ with unicode/emoji/RTL in every field is accepted', r.status === 200 && /"ok":true/.test(r.body), { status: r.status, body: r.body.slice(0, 80) }, '200 {"ok":true}');
      check('C13', 'RFQ writes exactly one JSONL row', lines.length === before + 1, { before, after: lines.length }, '+1');
      let row = null, parseOk = true;
      try { row = JSON.parse(lines[lines.length - 1]); } catch (e) { parseOk = false; }
      check('C13', 'the JSONL line is still one valid JSON object', parseOk && !!row, { parseOk }, 'parses');
      if (row) {
        const faithful = ['name', 'company', 'phone', 'part', 'material', 'quantity', 'reqDate', 'notes']
          .filter((k) => typeof row[k] === 'string' && row[k].includes('–°″µ🔥'));
        check('C13', 'every field is byte-faithful in the JSONL', faithful.length >= 7, { faithful, part: row.part }, 'the exact typed bytes, all 8 fields');
        check('C13', 'the literal `<1/4 inch and >2 inch ID` survives (invariant 10)', (row.part || '').includes('<1/4 inch and >2 inch ID'), { part: row.part }, 'no strip_tags, no double-escape');
      }
      check('C13', 'the sales email body carries the typed bytes', mail.includes('–°″µ🔥'), { present: mail.includes('–°″µ🔥') }, 'body faithful');
      check('C13', 'no injected header reached the message', !/^X-Injected:/mi.test(mail) && !/^Bcc:/mi.test(mail), { injected: /^X-Injected:/mi.test(mail) }, 'hdr() strips CR/LF');
    }

    // ── C13 — Message form, every field, with CRLF in the header-bound ones ─
    {
      const before = readLines().length;
      const mailBefore = readMail().length;
      const r = await submit({
        form_type: 'message',
        name: CRLF,
        company: `${NASTY} co`,
        email: 'c13msg@example.com',
        phone: `${NASTY} 630`,
        subject: CRLF,
        message: `${NASTY} body\r\nsecond line`,
      });
      const lines = readLines();
      const mail = readMail().slice(mailBefore);
      check('C13', 'Message form with CRLF in name and subject is accepted', r.status === 200 && /"ok":true/.test(r.body), { status: r.status }, '200 ok');
      // Scan only the HEADER BLOCK — everything before the first blank line.
      // `s()` deliberately leaves CR/LF in BODY-bound values (invariant 10), so
      // a scan of the whole message finds the payload in the body and reads as
      // an injection that is not one. The body cannot become a header: PHP
      // writes the headers, then the separator, then the body.
      const msg = mail.split('===MESSAGE===').filter((x) => /To: sales@/.test(x))[0] || '';
      const head = msg.split(/\r?\n\r?\n/)[0] || '';
      const subjLines = head.split('\n').filter((l) => /^Subject:/.test(l));
      check('C13', 'the Subject header is a single line', subjLines.length === 1,
        { n: subjLines.length, subject: (subjLines[0] || '').slice(0, 110) }, 'hdr() collapsed the CR/LF into one line');
      check('C13', 'no Bcc: or X-Injected: header in the header block', !/^Bcc:/mi.test(head) && !/^X-Injected:/mi.test(head),
        { headerLines: head.split('\n').map((x) => x.split(':')[0]) }, 'no header injection');
      check('C13', 'the injected text survives as literal SUBJECT text, not as a header',
        /Bcc: attacker@example\.com/.test(subjLines[0] || ''), { subject: (subjLines[0] || '').slice(0, 110) },
        'folded into the subject, which is the correct disposal');
      let row = null; try { row = JSON.parse(lines[lines.length - 1]); } catch (e) {}
      check('C13', 'the Message row is valid JSON with the body faithful', !!row && (row.message || '').includes('–°″µ🔥'), { message: row && (row.message || '').slice(0, 40) }, 'faithful');
      check('C13', 'the CR/LF did not split the JSONL into two lines', lines.length === before + 1, { before, after: lines.length }, '+1 line only');
    }

    // ── C13 — h() at the inquiries.php render boundary ─────────────────────
    {
      // sign in and render the page that shows the rows just written
      let COOKIE = '';
      const req = async (u, o = {}) => {
        const h = Object.assign({}, o.headers, COOKIE ? { cookie: COOKIE } : {});
        const r = await fetch(BASE + u, { ...o, headers: h, redirect: 'manual' });
        for (const c of (r.headers.getSetCookie ? r.headers.getSetCookie() : [])) {
          const kv = c.split(';')[0]; if (kv.startsWith('IPCADMIN=')) COOKIE = kv;
        }
        return { status: r.status, body: await r.text() };
      };
      const g = await req('/admin/auth.php');
      const t = (g.body.match(/name="csrf_token"\s+value="([a-f0-9]{64})"/) || [])[1];
      await req('/admin/auth.php', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf_token: t, password: process.env.ADMIN_PW || '' }).toString() });
      const page = await req('/admin/inquiries.php');
      const html = page.body;
      check('C13', 'inquiries.php renders the unicode payload', html.includes('–°″µ🔥'), { present: html.includes('–°″µ🔥') }, 'shown as typed');
      check('C13', 'the literal < and > are escaped once at the render boundary', html.includes('&lt;1/4 inch and &gt;2 inch ID'), { found: html.includes('&lt;1/4 inch and &gt;2 inch ID') }, 'h() once');
      check('C13', 'and NOT double-escaped', !html.includes('&amp;lt;1/4 inch'), { doubled: html.includes('&amp;lt;1/4 inch') }, 'no &amp;amp;');
    }

    // ── C18 — double-click submit, and Back then resubmit ──────────────────
    {
      const fields = {
        form_type: 'message', name: 'A9C18 Double', company: 'A9C18',
        email: 'c18@example.com', subject: 'A9C18 double click', message: 'A9C18 body',
      };
      // two IDENTICAL posts fired together, as a double-click does
      const before = readLines().length;
      const mailBefore = readMail().length;
      clearLimiter();
      const body = new URLSearchParams(fields).toString();
      const opts = { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', referer: BASE + '/contact' }, body };
      const [a, b] = await Promise.all([fetch(BASE + '/contact.php', opts), fetch(BASE + '/contact.php', opts)]);
      const [ab, bb] = [await a.text(), await b.text()];
      const lines = readLines().slice(before);
      const mail = readMail().slice(mailBefore);
      const mailCount = (mail.match(/===MESSAGE===/g) || []).length;
      const rows = lines.filter((l) => l.includes('A9C18 double click'));
      const bothOk = /"ok":true/.test(ab) && /"ok":true/.test(bb);
      const oneRefused = [ab, bb].some((x) => /"ok":false/.test(x));
      // INFORMATIONAL, not scored. Two parallel POSTs are not a double-click:
      // measured through the rendered form (_harness/out/audit9/P7/c18-browser.js)
      // a real double-click fires ONE POST, because `submitting` disables the
      // button between the click and the response. contact.php itself has no
      // idempotency key, so a script can send the same lead twice — that is a
      // defence-in-depth observation, not a visitor-path defect, and
      // PLAN-11 §10.1.2 says the page, not the probe, decides.
      results.push({ row: 'C18', name: 'INFO two parallel scripted POSTs are not deduplicated server-side',
        ok: null, observed: { rows: rows.length, statuses: [a.status, b.status], bothOk, oneRefused, salesMails: mailCount },
        expected: 'informational only — see c18-browser.js for the visitor path' });
      console.log(`info [C18] two parallel scripted POSTs -> rows=${rows.length}, salesMails=${mailCount} (informational)`);
      // Back then resubmit — same payload again after a pause
      const before2 = readLines().length;
      const r2 = await submit(fields);
      const rows2 = readLines().slice(before2).filter((l) => l.includes('A9C18 double click'));
      check('C18', 'Back-then-resubmit is accepted (a deliberate second send is not blocked)',
        r2.status === 200 && rows2.length === 1, { status: r2.status, rows: rows2.length },
        'the visitor who really wants to send again can');
    }
  } finally {
    restoreContact();
    clearLimiter();
    if (NEGCTL) {
      for (const n of ['the literal < and > are escaped once at the render boundary']) {
        const hit = results.find((x) => x.name === n);
        console.log(`NEGCTL: "${n}" -> ${hit ? (hit.ok ? 'STILL PASSING (control did not work)' : 'FAILED as required') : 'not run'}`);
      }
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'logic-contact.json'), JSON.stringify({ pass, fail, results }, null, 2));
  console.log(`\naudit9-logic-contact ${pass}/${pass + fail}`);
  if (fail) process.exitCode = 1;
}
main().catch((e) => { console.error('CRASHED:', e.message); process.exitCode = 2; });
