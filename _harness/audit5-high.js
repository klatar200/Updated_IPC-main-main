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
const { leads } = require('./inqrows');
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
  // AUDIT-12 decision 42 — leads, not lines: a lead is its row plus a send-result line.
  const before = leads(logPath).length;
  const nat = await POST('/contact.php', {
    form_type: 'rfq', name: 'NoJS Buyer', email: 'nojs-suite@example.com',
    quantity: '250 ft', partNumber: 'IP30HS', website: '',
  });
  const after = leads(logPath).length;
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

  // rotation HAPPENS: the real audit_log() in a temp copy of admin/, over a
  // sparse log at the rotation ceiling. This was a grep for the constant's
  // name and stayed green with the rotation branch switched off
  // (AUDIT-12 A12-L13-W1-G1-1).
  {
    const t = fs.mkdtempSync(path.join(require('os').tmpdir(), 'a54-'));
    fs.mkdirSync(path.join(t, 'admin')); fs.mkdirSync(path.join(t, 'data'));
    for (const f of fs.readdirSync(path.join(ROOT, 'admin'))) {
      if (/\.php$/.test(f) && f !== 'config.local.php') fs.copyFileSync(path.join(ROOT, 'admin', f), path.join(t, 'admin', f));
    }
    let rot;
    try {
      rot = JSON.parse(execFileSync('php', ['-r', `require 'admin/config.php';
        $log = 'admin/admin-log.jsonl'; $fh = fopen($log, 'w'); ftruncate($fh, ADMIN_LOG_ROTATE_BYTES); fclose($fh);
        $okw = audit_log('edit', 'A54PROBE', 'rotation probe'); clearstatcache();
        $arch = glob('admin/admin-log-*.jsonl');
        echo json_encode(['ok' => $okw, 'archives' => count($arch), 'archived' => $arch ? filesize($arch[0]) : 0,
          'live' => filesize($log), 'row' => strpos(file_get_contents($log), 'A54PROBE') !== false]);`],
        { encoding: 'utf8', cwd: t, stdio: ['ignore', 'pipe', 'pipe'] }));
    } catch (e) { rot = { error: String(e.stderr || e.message).slice(0, 200) }; }
    fs.rmSync(t, { recursive: true, force: true });
    ok(rot.ok === true && rot.archives === 1 && rot.archived >= 16 * 1024 * 1024 && rot.live < 4096 && rot.row === true,
       'A-5.4 admin-log.jsonl rotates instead of growing forever', JSON.stringify(rot));
  }

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
  // BEHAVIOUR, not source text. These seven checks used to grep for a string
  // inside the branch, a function's own definition or a constant's name, and
  // stayed 30/30 with every one of the behaviours switched off
  // (AUDIT-12 A12-L13-W1-G1-1). Two private servers over a COPY of the mirror:
  //   :8750  as root, its temp dir private, for the limiter / auto-reply arms;
  //   :8751  as `nobody` with admin/ and data/ root-owned (so not writable) and
  //          a temp dir that does not exist — the state the banners describe.
  //          Root writes everywhere, so only another user can measure this.
  const os = require('os');
  const { spawn, spawnSync } = require('child_process');
  const TT = fs.mkdtempSync(path.join(os.tmpdir(), 'a5h-'));
  const servers = [];
  try {
    fs.chmodSync(TT, 0o755);
    const T = path.join(TT, 'site');
    execFileSync('cp', ['-r', SITE, T]);
    fs.rmSync(path.join(T, 'admin', '.sessions'), { recursive: true, force: true });
    fs.copyFileSync(path.join(__dirname, 'router.php'), path.join(TT, 'router.php'));
    fs.copyFileSync(path.join(__dirname, 'fakemail.sh'), path.join(TT, 'fakemail.sh'));
    const MAIL = path.join(TT, 'mail.log'); fs.writeFileSync(MAIL, ''); fs.chmodSync(MAIL, 0o666);
    const SESS = path.join(TT, 'sess'); fs.mkdirSync(SESS); fs.chmodSync(SESS, 0o1777);
    const TA = path.join(TT, 'tmpA'); fs.mkdirSync(TA);
    execFileSync('chmod', ['-R', 'a+rX', TT]);
    const start = (port, tmp, asNobody) => {
      const args = ['-S', `127.0.0.1:${port}`, '-t', T, '-c', path.join(__dirname, 'php-mail.ini'),
        '-d', `sys_temp_dir=${tmp}`, '-d', `sendmail_path=${path.join(TT, 'fakemail.sh')}`, '-d', `session.save_path=${SESS}`,
        path.join(TT, 'router.php')];
      const p = asNobody ? spawn('runuser', ['-u', 'nobody', '--', 'php', ...args], { cwd: T, env: { ...process.env, IPC_MAIL_LOG: MAIL }, stdio: 'ignore' })
        : spawn('php', args, { cwd: T, env: { ...process.env, IPC_MAIL_LOG: MAIL }, stdio: 'ignore' });
      servers.push(p);
      return p;
    };
    const up = async (port) => {
      for (let i = 0; i < 50; i++) {
        try { await req({ port, path: '/robots.txt', method: 'GET' }); return true; } catch (_) { await new Promise((r) => setTimeout(r, 100)); }
      }
      return false;
    };
    const mails = () => fs.readFileSync(MAIL, 'utf8').split('===MESSAGE===').filter((m) => m.trim());
    const autoRepliedTo = (addr) => mails().some((m) => new RegExp(`^To:.*${addr.replace(/[.]/g, '\\.')}`, 'mi').test(m));
    // AUDIT-12 decision 18 — contact.php answers BEFORE it sends the auto-reply. `php -S` serves one request at a time, so this second request returns only once that one has finished, auto-reply included.
    const lead = async (port, email) => {
      const r = await req({ port, path: '/contact.php', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } },
        form({ form_type: 'message', name: 'A59 Probe', company: 'X', email, phone: '6305550100', subject: 'General', message: 'auto-reply cap probe', website: '' }));
      await req({ port, path: '/robots.txt', method: 'GET' }).catch(() => {});
      return r;
    };

    // :8750 — control first: an ordinary lead gets its auto-reply, and the
    // limiter file it writes tells us this client's name for it.
    start(8750, TA, false);
    if (!(await up(8750))) throw new Error(':8750 did not start (port taken?)');
    const c1 = await lead(8750, 'a59-control@example.com');
    const rl = fs.readdirSync(TA).filter((f) => /^ipc_rl_.*\.json$/.test(f));
    ok(c1.status === 200 && autoRepliedTo('a59-control@example.com') && rl.length === 1,
       'A-5.9 control: a lead whose limiter state persists gets its auto-reply', `status ${c1.status}, rl files ${rl.join(',')}`);
    // Now make THAT limiter file unwritable (a directory of the same name), and
    // only that: the auto-reply cap's own file still writes, so the only thing
    // withholding the reply is `!$limiterPersisted`.
    fs.rmSync(path.join(TA, rl[0] || 'none'), { force: true });
    fs.mkdirSync(path.join(TA, rl[0] || 'ipc_rl_none.json'));
    const c2 = await lead(8750, 'a59-unstored@example.com');
    ok(c2.status === 200 && mails().some((m) => /a59-unstored@example\.com/.test(m)),
       'A-5.9 the lead itself still reaches sales when the limiter cannot store its state', `status ${c2.status}`);
    ok(!autoRepliedTo('a59-unstored@example.com'),
       'A-5.9 the auto-reply fails CLOSED when the cap cannot be stored');

    // :8751 — the dashboard as Rick sees it on a host with admin/, data/ and the
    // temp dir unwritable.
    if (process.getuid && process.getuid() === 0 && spawnSync('runuser', ['--help']).status === 0) {
      start(8751, path.join(TT, 'no-such-temp-dir'), true);
      if (!(await up(8751))) throw new Error(':8751 did not start (port taken, or runuser/nobody unavailable)');
      const li = await req({ port: 8751, path: '/admin/auth.php', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, form({ password: 'audit-pass-123' }));
      const ck = (li.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
      const d = await req({ port: 8751, path: '/admin/index.php', method: 'GET', headers: { Cookie: ck } });
      const signedIn = d.status === 200 && /Dashboard|healthProblems|not writable/i.test(d.body);
      ok(signedIn && /cool-off that limits password guessing is switched off/.test(d.body),
         'A-5.8 the health banner names the login cool-off as disabled', `status ${d.status}`);
      ok(signedIn && /failed sign-ins are not being recorded/.test(d.body),
         'A-5.8 the health banner names the audit log as disabled');
      ok(signedIn && /temporary folder/.test(d.body) && /spam rate limit is not counting/.test(d.body),
         'A-5.9 an unwritable temp dir is surfaced in the dashboard');
    } else {
      for (const l of ['A-5.8 the health banner names the login cool-off as disabled', 'A-5.8 the health banner names the audit log as disabled',
        'A-5.9 an unwritable temp dir is surfaced in the dashboard']) ok(false, l, 'needs root and runuser to serve as another user — not measured');
    }
    // …and none of the three on the healthy :8123 mirror (the banners are conditional).
    ok(!/cool-off that limits password guessing|spam rate limit is not counting/.test(dash2.body),
       'A-5.8/A-5.9 control: a healthy host shows neither warning');
  } catch (e) {
    ok(false, 'A-5.8/A-5.9 private servers', e.message);
  } finally {
    for (const p of servers) { try { p.kill(); } catch (_) {} }
    await new Promise((r) => setTimeout(r, 300));
    // runuser leaves php as its child; stop it by its port, by PID.
    for (const port of [8750, 8751]) {
      const ps = spawnSync('ps', ['-eo', 'pid,args'], { encoding: 'utf8' }).stdout || '';
      for (const line of ps.split('\n')) if (line.includes(`php -S 127.0.0.1:${port}`) && line.includes(TT)) { try { process.kill(parseInt(line, 10)); } catch (_) {} }
    }
    fs.rmSync(TT, { recursive: true, force: true });
  }

  const cp = fs.readFileSync(path.join(ROOT, 'public/contact.php'), 'utf8');
  ok(/function ipc_rl_save\(string \$file, array \$state\): bool/.test(cp),
     'A-5.9 the limiter reports whether its state persisted');
  // Pruning: run the REAL function (read out of contact.php) over a temp dir
  // holding a 3-day-old and a fresh limiter file, until its 1-in-25 draw
  // fires; and the call itself must be live code, not commented out.
  {
    const at = cp.search(/function ipc_prune_limiter_files\s*\(/);
    let dd = 0, end = -1;
    for (let i = cp.indexOf('{', at); i < cp.length; i++) {
      if (cp[i] === '{') dd++; else if (cp[i] === '}') { dd--; if (dd === 0) { end = i + 1; break; } }
    }
    const pd = fs.mkdtempSync(path.join(os.tmpdir(), 'a59p-'));
    const pf = path.join(pd, 'prune.php');
    fs.writeFileSync(pf, `<?php\n${cp.slice(at, end)}\n$d = sys_get_temp_dir();
      touch("$d/ipc_rl_old.json", time() - 3 * 86400); touch("$d/ipc_ar_old.json", time() - 3 * 86400); touch("$d/ipc_rl_new.json");
      for ($i = 0; $i < 2000 && file_exists("$d/ipc_rl_old.json"); $i++) ipc_prune_limiter_files(time());
      echo json_encode(['old' => file_exists("$d/ipc_rl_old.json") || file_exists("$d/ipc_ar_old.json"), 'fresh' => file_exists("$d/ipc_rl_new.json")]);`);
    let pr;
    try { pr = JSON.parse(execFileSync('php', ['-d', `sys_temp_dir=${pd}`, pf], { encoding: 'utf8' })); } catch (e) { pr = { error: e.message }; }
    fs.rmSync(pd, { recursive: true, force: true });
    const live = cp.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*(\/\/|#).*$/gm, '');
    ok(at >= 0 && pr.old === false && pr.fresh === true && /^\s*ipc_prune_limiter_files\(\$now\);/m.test(live),
       'A-5.9 stale limiter files are pruned', JSON.stringify(pr));
  }

  console.log(`\naudit5-high ${pass}/${pass + fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
