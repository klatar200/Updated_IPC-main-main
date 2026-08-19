/**
 * Audit-5 launch blockers — A-5.1 (auto-reply mail relay) and A-5.2 (robots.txt).
 *
 * A-5.1. `s()` deliberately does not HTML-escape (invariant 10) and its
 * control-character class excludes \x0A and \x0D, so newlines survive. Five
 * visitor-supplied RFQ fields were interpolated into the AUTO-REPLY body — a
 * mail sent to the visitor-supplied address, From the company domain. One
 * anonymous POST could therefore deliver freely line-broken, attacker-authored
 * prose to a third party under IPC's SPF/DKIM. Measured before the fix: a fake
 * "invoice overdue / pay online now" notice arrived intact.
 *
 * The fix is in the BODY SLOTS, not in `s()`: reply_slot() collapses newlines
 * and caps short, and it is applied only to the auto-reply's copies. The sales
 * notification to IPC and the JSONL lead record keep the value exactly as the
 * visitor typed it — asserted below, because narrowing those would be a
 * regression of invariant 10's intent and of "no lead is ever lost".
 *
 * A-5.2. The SPA is wholly client-rendered and builds every page from
 * /data/*.json. `Disallow: /data/` therefore made all 42 product pages render
 * the catalog-error state for any crawler that obeys robots.txt, while
 * sitemap.php advertised those URLs. Under REP the longest match wins, so the
 * rule beat `Allow: /`.
 *
 * Needs :8123 (php-mail.ini, capturing sendmail). Run from the repo root.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const MAIL_LOG = '/tmp/ipc-harness-mail.log';
let pass = 0, fail = 0;
const ok = (cond, label, detail) => {
  if (cond) { pass++; console.log(`ok   ${label}`); }
  else { fail++; console.log(`FAIL ${label}${detail ? '  — ' + detail : ''}`); }
};

// The per-IP limiter (5/10min) and the per-mailbox auto-reply cap (3/24h)
// both persist to the temp dir. A suite whose result depends on how many times
// it has been run is not a suite, so clear that state before each submission.
function clearLimiterState() {
  for (const f of fs.readdirSync('/tmp')) {
    if (/^ipc_(rl|ar)_[0-9a-f]{32}\.json$/.test(f)) {
      try { fs.unlinkSync(path.join('/tmp', f)); } catch { /* already gone */ }
    }
  }
}

// fakemail.sh appends from a subshell; give the write a moment to land rather
// than racing it and reporting a delivery failure that did not happen.
// Match the envelope recipient on its OWN line. A substring test for
// "To: <addr>" also matches the sales notification's "Reply-To: <addr>", which
// silently pointed every assertion at the wrong message — the auto-reply checks
// were reading the sales mail, where the raw text legitimately appears. A fix
// that changed nothing would have looked correct.
function recipientRe(addr) {
  return new RegExp('^To: ' + addr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'm');
}

async function waitForMessage(addr, tries = 20) {
  const re = recipientRe(addr);
  for (let i = 0; i < tries; i++) {
    const log = fs.existsSync(MAIL_LOG) ? fs.readFileSync(MAIL_LOG, 'utf8') : '';
    const all = log.split('===MESSAGE===').filter((m) => m.trim());
    const found = all.find((m) => re.test(m));
    if (found) return { found, all };
    await new Promise((r) => setTimeout(r, 100));
  }
  const log = fs.existsSync(MAIL_LOG) ? fs.readFileSync(MAIL_LOG, 'utf8') : '';
  return { found: '', all: log.split('===MESSAGE===').filter((m) => m.trim()) };
}

function post(body) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(body).toString();
    const req = http.request({
      host: '127.0.0.1', port: 8123, path: '/contact.php', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let out = '';
      res.on('data', (c) => (out += c));
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  // ── A-5.2 — robots.txt must not starve the renderer ──────────────────────
  const robots = fs.readFileSync(path.join(ROOT, 'public/robots.txt'), 'utf8');
  const disallowed = robots.split(/\r?\n/)
    .filter((l) => /^\s*Disallow:/i.test(l))
    .map((l) => l.replace(/^\s*Disallow:\s*/i, '').trim());

  ok(!disallowed.some((d) => d !== '' && '/data/products-all.json'.startsWith(d)),
     'A-5.2 robots.txt does not block /data/products-all.json',
     `Disallow rules: ${JSON.stringify(disallowed)}`);
  ok(!disallowed.some((d) => d !== '' && '/data/site-info.json'.startsWith(d)),
     'A-5.2 robots.txt does not block /data/site-info.json');
  ok(!disallowed.some((d) => d !== '' && '/data/content.json'.startsWith(d)),
     'A-5.2 robots.txt does not block /data/content.json');
  ok(disallowed.includes('/admin/'), 'A-5.2 robots.txt still blocks /admin/');

  // The files must stay out of the index by header rather than by robots, or
  // removing the Disallow simply trades one problem for another.
  const dataHt = fs.readFileSync(path.join(ROOT, 'data/.htaccess'), 'utf8');
  ok(/X-Robots-Tag/i.test(dataHt) && /noindex/i.test(dataHt),
     'A-5.2 data/.htaccess sends X-Robots-Tag: noindex instead');

  // ── A-5.1 — the auto-reply must not carry attacker-composed prose ────────
  try { fs.writeFileSync(MAIL_LOG, ''); } catch { /* sink may not exist yet */ }
  clearLimiterState();

  const HOSTILE_NAME = 'Valued Customer,\n\nACTION REQUIRED: invoice #48812 is 30 days overdue.';
  const HOSTILE_QTY  = 'Pay online now: https://evil.example/ipc-pay-invoice';
  const VICTIM       = 'purchasing@victim-corp.example';

  const res = await post({
    form_type: 'rfq',
    email: VICTIM,
    name: HOSTILE_NAME,
    quantity: HOSTILE_QTY,
    partNumber: 'Do not reply to this address.',
    material: 'Billing line: +1-555-0100',
    requiredDate: 'Regards,\nIPC Accounts Receivable',
    website: '',
  });
  ok(res.status === 200, 'A-5.1 hostile RFQ still accepted (no behaviour change for real senders)', `status ${res.status}`);

  const { found: reply, all: messages } = await waitForMessage(VICTIM);
  ok(reply !== '', 'A-5.1 auto-reply was sent (the cap and the send path still work)');

  // The weapon was multi-line composition: the attacker writing paragraphs that
  // read as the mail's own body. Every interpolated slot must now be one line.
  // The guarantee is not "no sender words reach the reply" — echoing the
  // request back is the feature. It is that the sender cannot COMPOSE: no line
  // of their own, no link, and nothing longer than a labelled value.
  ok(!/evil\.example/i.test(reply), 'A-5.1 the attacker URL never reaches the reply');
  ok(!/https?:\/\/|www\./i.test(reply.split(/\r?\n\r?\n/).slice(1).join('\n\n')),
     'A-5.1 no sender-supplied link survives in the reply body');
  ok(!/^\s*ACTION REQUIRED/m.test(reply),
     'A-5.1 no attacker text starts a line of its own in the reply');
  // Caps hold, so nothing the sender writes can run long enough to read as
  // prose rather than as a filled-in field.
  // Only the lines that carry sender text — IPC's own promise sentence is
  // legitimately longer, and measuring it instead would be measuring nothing.
  const slotLines = reply.split(/\r?\n/).filter((l) => /^(Hello |Part Number:|Material Type:|Quantity:|Required By:)/.test(l));
  const longestSlot = Math.max(0, ...slotLines.map((l) => l.length));
  ok(slotLines.length === 5 && longestSlot <= 100,
     'A-5.1 every sender-filled line stays within the slot caps',
     `${slotLines.length} slot lines, longest ${longestSlot}`);
  // The greeting is the prime lede slot. In the vulnerable build the template
  // resumed only after the attacker's paragraph, so assert the distance: the
  // "Hello …," line must be followed by exactly one blank line and then the
  // template's own sentence, with nothing of the sender's in between.
  const rLines = reply.split(/\r?\n/);
  const gi = rLines.findIndex((l) => /^Hello /.test(l));
  ok(gi !== -1 && rLines[gi + 1] === '' && /^Thank you for /.test(rLines[gi + 2] || ''),
     'A-5.1 the greeting is one line and the template resumes immediately',
     `after greeting: ${JSON.stringify((rLines.slice(gi + 1, gi + 3) || []).join(' | ').slice(0, 90))}`)

  // The sales notification and the lead record must be UNCHANGED — the fix is
  // scoped to the reply, and narrowing these would lose data IPC needs.
  const sales = messages.find((m) => m.includes('IPC QUOTE REQUEST')) || '';
  ok(sales.includes('ACTION REQUIRED: invoice #48812 is 30 days overdue.'),
     'A-5.1 sales notification still receives the raw text verbatim');
  ok(sales.includes(HOSTILE_QTY),
     'A-5.1 sales notification still receives the raw quantity verbatim');

  const jsonl = path.join(ROOT, '_harness/site/admin/inquiries.jsonl');
  const lastLine = fs.existsSync(jsonl)
    ? fs.readFileSync(jsonl, 'utf8').trim().split('\n').filter(Boolean).pop()
    : '';
  let rec = {};
  try { rec = JSON.parse(lastLine); } catch { /* leave empty, assertion reports it */ }
  ok(rec.quantity === HOSTILE_QTY,
     'A-5.1 lead record still stores the value exactly as typed',
     `got ${JSON.stringify(rec.quantity)}`);

  // A legitimate request must still read correctly.
  try { fs.writeFileSync(MAIL_LOG, ''); } catch { /* ignore */ }
  clearLimiterState();
  await post({
    form_type: 'rfq', email: 'jane.buyer@example.com', name: 'Jane Buyer',
    quantity: '500 ft', partNumber: 'IP38FE', material: 'PTFE',
    requiredDate: '2026-09-01', website: '',
  });
  const { found: reply2 } = await waitForMessage('jane.buyer@example.com');
  ok(/Hello Jane Buyer,/.test(reply2), 'A-5.1 ordinary reply still greets the sender by name');
  ok(/Part Number:\s+IP38FE/.test(reply2), 'A-5.1 ordinary reply still summarises the request');
  ok(/Quantity:\s+500 ft/.test(reply2), 'A-5.1 ordinary reply still carries the quantity');

  console.log(`\naudit5-blockers ${pass}/${pass + fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
