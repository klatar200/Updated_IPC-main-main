/**
 * Audit-5 High findings — regression guards.
 *
 * A-5.3 lost lead with JS off · A-5.4 audit log flooded out of usefulness
 * A-5.5 non-atomic catalog write · A-5.6 no signal that a lead arrived
 * A-5.7 unauthenticated fatal leaking the hash · A-5.8 silent loss of both
 * brute-force controls · A-5.9 abuse controls failing open silently
 *
 * Needs :8123 (php-mail.ini) and a synced mirror. Run from the repo root.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { launch } = require('./browser.js');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, '_harness/site');
let pass = 0, fail = 0;
const ok = (c, label, detail) => {
  if (c) { pass++; console.log(`ok   ${label}`); }
  else { fail++; console.log(`FAIL ${label}${detail ? '  — ' + detail : ''}`); }
};

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: 8123, ...opts }, (res) => {
      let out = '';
      res.on('data', (c) => (out += c));
      res.on('end', () => resolve({ status: res.statusCode, body: out, headers: res.headers }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}
const form = (o) => new URLSearchParams(o).toString();
const POST = (p, o, extra = {}) => req({ path: p, method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(extra.headers || {}) } }, form(o));

(async () => {
  // ── A-5.7 — array-typed inputs must fail closed, not fatal ──────────────
  // The login page is the only PRE-AUTH instance, and its stack trace printed
  // the server path and the first 16 characters of the live bcrypt hash.
  const authRes = await POST('/admin/auth.php', { 'password[]': 'x' });
  ok(!/TypeError|Fatal error/i.test(authRes.body), 'A-5.7 password[]=x does not fatal the login page');
  ok(!/\$2y\$/.test(authRes.body), 'A-5.7 no bcrypt hash fragment in the response');
  ok(!/\/home\/|\/var\/www|public_html/.test(authRes.body), 'A-5.7 no absolute server path in the response');

  // sign in for the authenticated checks
  const login = await POST('/admin/auth.php', { password: 'audit-pass-123' });
  const cookie = (login.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
  const AUTH = { headers: { Cookie: cookie } };

  for (const page of ['edit', 'delete', 'upload-image', 'upload-pdf']) {
    const r = await req({ path: `/admin/${page}.php?sku[]=IP33PO`, method: 'GET', ...AUTH });
    ok(!/TypeError|Fatal error/i.test(r.body), `A-5.7 ${page}.php?sku[]= does not fatal`);
  }
  const csrfRes = await POST('/admin/backups.php', { 'csrf_token[]': 'x', backup: 'x' }, AUTH);
  ok(!/TypeError|Fatal error/i.test(csrfRes.body), 'A-5.7 csrf_token[]=x does not fatal a mutating page');

  // ── A-5.3 — both contact forms must carry the discriminator ─────────────
  const br = await launch();
  const pg = await br.newPage();
  await pg.goto('http://127.0.0.1:8123/contact');
  await pg.waitForLoadState('networkidle');
  await pg.waitForTimeout(500);
  const rfq = await pg.evaluate(() => {
    const f = document.querySelector('form[action="/contact.php"]');
    const h = f && f.querySelector('input[type="hidden"][name="form_type"]');
    return { v: h ? h.value : null, sends: f ? [...new FormData(f).keys()].includes('form_type') : false };
  });
  ok(rfq.v === 'rfq' && rfq.sends, 'A-5.3 the RFQ form submits form_type=rfq natively', JSON.stringify(rfq));
  for (const b of await pg.$$('button')) {
    const t = (await b.textContent()) || '';
    if (/message/i.test(t)) { await b.click(); break; }
  }
  await pg.waitForTimeout(400);
  const msg = await pg.evaluate(() => {
    const f = document.querySelector('form[action="/contact.php"]');
    const h = f && f.querySelector('input[type="hidden"][name="form_type"]');
    return { v: h ? h.value : null, sends: f ? [...new FormData(f).keys()].includes('form_type') : false };
  });
  ok(msg.v === 'message' && msg.sends, 'A-5.3 the message form submits form_type=message natively', JSON.stringify(msg));
  await br.close();

  // and the server half: a native RFQ post is accepted and LOGGED
  const logPath = path.join(SITE, 'admin/inquiries.jsonl');
  const before = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).length : 0;
  const nat = await POST('/contact.php', {
    form_type: 'rfq', name: 'NoJS Buyer', email: 'nojs-suite@example.com',
    quantity: '250 ft', partNumber: 'IP30HS', website: '',
  });
  const after = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).length : 0;
  ok(nat.status === 200 && after === before + 1, 'A-5.3 a native RFQ post is accepted and logged', `status ${nat.status}, delta ${after - before}`);

  // ── A-5.4 — the filter must reach past a flood of sign-in noise ─────────
  const auditLog = path.join(SITE, 'admin/admin-log.jsonl');
  const saved = fs.existsSync(auditLog) ? fs.readFileSync(auditLog, 'utf8') : null;
  const rows = [];
  for (const sku of ['IP33PO', 'IP38FE', 'IP55FL']) {
    rows.push(JSON.stringify({ ts: '2026-08-10 09:15:00', action: 'edit', sku, detail: 'Description updated', ip: '70.1.2.3', ua: 'Mozilla/5.0' }));
  }
  for (let i = 0; i < 600; i++) {
    rows.push(JSON.stringify({ ts: '2026-08-18 12:00:00', action: 'sign-in-failed', sku: '-', detail: `Incorrect password (failure #${i})`, ip: '45.9.148.99', ua: 'python-requests/2.31' }));
  }
  fs.writeFileSync(auditLog, rows.join('\n') + '\n');
  const al = await req({ path: '/admin/audit-log.php?action=edit', method: 'GET', ...AUTH });
  const foundAll = ['IP33PO', 'IP38FE', 'IP55FL'].every((s) => al.body.includes(s));
  ok(foundAll, 'A-5.4 owner edits are still findable under 600 lines of sign-in noise');
  ok(!/No entries match/i.test(al.body), 'A-5.4 the filter does not report an empty result');
  if (saved === null) fs.unlinkSync(auditLog); else fs.writeFileSync(auditLog, saved);

  // rotation exists at all
  const cfg = fs.readFileSync(path.join(ROOT, 'admin/config.php'), 'utf8');
  ok(/ADMIN_LOG_ROTATE_BYTES/.test(cfg) && /admin-log-'\s*\.\s*date/.test(cfg),
     'A-5.4 admin-log.jsonl rotates instead of growing forever');

  // ── A-5.5 — a failed write must leave the live file untouched ───────────
  const probe = path.join(ROOT, '_harness/out/a55-probe.php');
  fs.mkdirSync(path.dirname(probe), { recursive: true });
  fs.writeFileSync(probe, `<?php
pcntl_signal(SIGXFSZ, SIG_IGN);            // short write instead of a killed process
require '${path.join(ROOT, 'admin/config.php')}';
$dir = sys_get_temp_dir() . '/ipc-a55-' . getmypid(); @mkdir($dir);
$live = $dir . '/products-all.json';
$good = json_encode(['products' => [['sku' => 'IP38FE']]]);
file_put_contents($live, $good);
$hash = md5_file($live);
$big  = json_encode(['products' => array_fill(0, 4000, ['sku' => 'X', 'name' => str_repeat('y', 60)])]);
$ok   = json_write_atomic($live, $big);
$intact = md5_file($live) === $hash && is_array(json_decode(file_get_contents($live), true));
$leftovers = count(glob($dir . '/*.tmp'));
$small = json_encode(['products' => [['sku' => 'IP55FL']]]);
$ok2 = json_write_atomic($live, $small);
$roundtrip = json_decode(file_get_contents($live), true)['products'][0]['sku'] ?? '';
echo json_encode(['failed_write_reported' => $ok, 'live_intact' => $intact, 'leftovers' => $leftovers, 'normal_write' => $ok2, 'roundtrip' => $roundtrip]);
array_map('unlink', glob($dir . '/*')); @rmdir($dir);
`);
  let a55 = {};
  try {
    a55 = JSON.parse(execFileSync('/bin/sh', ['-c', `ulimit -f 100; php ${probe} 2>/dev/null`], { encoding: 'utf8', cwd: ROOT }));
  } catch (e) { a55 = { error: e.message }; }
  ok(a55.failed_write_reported === false, 'A-5.5 a write that cannot complete is reported as failure', JSON.stringify(a55));
  ok(a55.live_intact === true, 'A-5.5 the live catalog is byte-identical after a failed write', JSON.stringify(a55));
  ok(a55.leftovers === 0, 'A-5.5 no temp file is left behind');
  ok(a55.normal_write === true && a55.roundtrip === 'IP55FL', 'A-5.5 an ordinary save still succeeds');
  fs.unlinkSync(probe);

  // ── A-5.6 — the owner must be TOLD a lead arrived ───────────────────────
  const seenFile = path.join(SITE, 'admin/.inquiries-seen.json');
  if (fs.existsSync(seenFile)) fs.unlinkSync(seenFile);
  const dash = await req({ path: '/admin/index.php', method: 'GET', ...AUTH });
  ok(/new inquir(y|ies) since you last looked/.test(dash.body), 'A-5.6 the dashboard announces unread leads');
  ok(/class="nav-badge"/.test(dash.body), 'A-5.6 the nav carries an unread badge');
  await req({ path: '/admin/inquiries.php', method: 'GET', ...AUTH });      // reading clears it
  const dash2 = await req({ path: '/admin/index.php', method: 'GET', ...AUTH });
  ok(!/new inquir(y|ies) since you last looked/.test(dash2.body), 'A-5.6 reading the page clears the announcement');
  ok(!/<span class="nav-badge"/.test(dash2.body), 'A-5.6 reading the page clears the badge');
  const inq = await req({ path: '/admin/inquiries.php', method: 'GET', ...AUTH });
  ok(!/>Emailed</.test(inq.body), 'A-5.6 no badge claims delivery mail() cannot observe');
  ok(/Sent to mail server/.test(inq.body), 'A-5.6 the badge says what actually happened');

  // ── A-5.8 / A-5.9 — the silent failures are named where they are seen ───
  const idx = fs.readFileSync(path.join(ROOT, 'admin/index.php'), 'utf8');
  ok(/cool-off that limits password guessing is switched off/.test(idx),
     'A-5.8 the health banner names the login cool-off as disabled');
  ok(/failed sign-ins are not being recorded/.test(idx),
     'A-5.8 the health banner names the audit log as disabled');
  ok(/temporary folder/.test(idx) && /spam rate limit is not counting/.test(idx),
     'A-5.9 an unwritable temp dir is surfaced in the dashboard');
  const cp = fs.readFileSync(path.join(ROOT, 'public/contact.php'), 'utf8');
  ok(/function ipc_rl_save\(string \$file, array \$state\): bool/.test(cp),
     'A-5.9 the limiter reports whether its state persisted');
  ok(/ipc_prune_limiter_files/.test(cp), 'A-5.9 stale limiter files are pruned');
  ok(/if \(!\$limiterPersisted\) \{\s*\$autoReplyOk = false;/.test(cp),
     'A-5.9 the auto-reply fails CLOSED when the cap cannot be stored');

  console.log(`\naudit5-high ${pass}/${pass + fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
