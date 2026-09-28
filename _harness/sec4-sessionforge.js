/**
 * SEC-4 — a session file planted by anything else on the host must not sign
 * anyone in. audit-runs/audit-2026-09-27.md SEC-4 / §6 (and the revocation half
 * of SEC-3).
 *
 * Sessions used PHP's default save_path — on shared hosting often a folder
 * every site can write — and "signed in" was the bare flag
 * `ipc_admin_authenticated|b:1;`. V1 measured it: a hand-written sess_<id> with
 * that line, sent as the IPCADMIN cookie, passed require_auth() and got the full
 * dashboard; use_strict_mode does not help because the id genuinely exists.
 *
 * Own `php -S` on :8706 over the mirror. 9 checks:
 *   forge-default   a forged old-style session in the DEFAULT save path is not
 *                   signed in (the store moved)
 *   forge-private   a forged old-style session in admin/.sessions/ is not
 *                   signed in either (the flag is now a keyed signature)
 *   login           the real form still signs in, and the session file lands
 *                   in admin/.sessions/, not the default path
 *   revoke          changing the password in session A signs out session B
 *                   and leaves A signed in
 * Restores the mirror's harness password (setpw.php) and removes the sessions
 * it made, in a finally.
 *
 *   node _harness/sec4-sessionforge.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(__dirname, 'site');
const SESS = path.join(SITE, 'admin', '.sessions');
const PORT = 8706;
const BASE = `http://127.0.0.1:${PORT}`;
const TMP = fs.mkdtempSync('/tmp/ipc-sec4-');   // the "default" save path for this server
const PW = 'audit-pass-123';
const NEWPW = 'sec4-new-password-9481';

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

// Minimal cookie-jar HTTP via curl, so the suite needs no browser.
const jar = (name) => path.join(TMP, `${name}.jar`);
const curl = (args) => spawnSync('curl', ['-s', '--max-time', '15', ...args], { encoding: 'utf8' });
const get = (url, j) => {
  const r = curl(['-b', j, '-c', j, '-o', '-', '-w', '\n%{http_code} %{redirect_url}', BASE + url]);
  const i = r.stdout.lastIndexOf('\n');
  const [code, redirect] = r.stdout.slice(i + 1).split(' ');
  return { code: Number(code), redirect: redirect || '', body: r.stdout.slice(0, i) };
};
const post = (url, j, fields) => {
  const args = ['-b', j, '-c', j, '-o', '-', '-w', '\n%{http_code} %{redirect_url}'];
  for (const [k, v] of Object.entries(fields)) args.push('--data-urlencode', `${k}=${v}`);
  const r = curl([...args, BASE + url]);
  const i = r.stdout.lastIndexOf('\n');
  const [code, redirect] = r.stdout.slice(i + 1).split(' ');
  return { code: Number(code), redirect: redirect || '', body: r.stdout.slice(0, i) };
};
const csrfFrom = (html) => (html.match(/name="csrf_token" value="([^"]+)"/) || [])[1] || '';
const signedIn = (j) => { const r = get('/admin/index.php', j); return r.code === 200 && /IPC Admin/.test(r.body) && !/type="password"/.test(r.body); };
const login = (j, pw) => {
  const f = get('/admin/auth.php', j);
  return post('/admin/auth.php', j, { csrf_token: csrfFrom(f.body), password: pw });
};
const forge = (dir, id) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `sess_${id}`), 'ipc_admin_authenticated|b:1;');
  fs.writeFileSync(jar(`forge-${id}`), `127.0.0.1\tFALSE\t/\tFALSE\t0\tIPCADMIN\t${id}\n`);
  return jar(`forge-${id}`);
};

(async () => {
  if (curl(['-o', '/dev/null', BASE + '/']).status === 0) {
    console.log(`sec4-sessionforge: port ${PORT} is already in use — stop that server first`);
    process.exit(2);
  }
  const hadSessDir = fs.existsSync(SESS);
  const before = hadSessDir ? fs.readdirSync(SESS) : [];
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, '-c', path.join(__dirname, 'php-mail.ini'),
    '-d', `sys_temp_dir=${TMP}`, '-d', `session.save_path=${TMP}`, path.join(__dirname, 'router.php')],
    { cwd: ROOT, stdio: 'ignore' });
  try {
    await new Promise((r) => setTimeout(r, 800));

    // ── forged sessions ──
    const idA = crypto.randomBytes(16).toString('hex');
    note(!signedIn(forge(TMP, idA)), 'forge-default: a planted "signed in" file in the default save path does not sign in');
    const idB = crypto.randomBytes(16).toString('hex');
    note(!signedIn(forge(SESS, idB)), 'forge-private: a planted old-style file in admin/.sessions/ does not sign in either');

    // ── real login ──
    const A = jar('A'), B = jar('B');
    login(A, PW);
    note(signedIn(A), 'login: the real sign-in form still works');
    const sid = (fs.readFileSync(A, 'utf8').match(/IPCADMIN\t(\S+)/) || [])[1] || '';
    note(sid && fs.existsSync(path.join(SESS, `sess_${sid}`)), 'login: the session file is written to admin/.sessions/',
      `sid=${sid.slice(0, 8)}… in .sessions: ${sid && fs.existsSync(path.join(SESS, `sess_${sid}`))}`);
    note(sid && !fs.existsSync(path.join(TMP, `sess_${sid}`)), 'login: and NOT to the shared default save path');
    note(fs.existsSync(path.join(SESS, '.htaccess')) && /Deny from all/.test(fs.readFileSync(path.join(SESS, '.htaccess'), 'utf8')),
      'login: admin/.sessions/ carries a deny-all .htaccess');

    // ── revoke on password change ──
    login(B, PW);
    note(signedIn(B), 'revoke: setup — a second browser (B) is signed in');
    const pf = get('/admin/password.php', A);
    const pr = post('/admin/password.php', A, { csrf_token: csrfFrom(pf.body), current_password: PW, new_password: NEWPW, confirm_password: NEWPW });
    note(/Password changed/.test(pr.body) && signedIn(A), 'revoke: the browser that changed the password (A) stays signed in',
      pr.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').match(/(Password changed[^.]*|[^.]*(error|must|incorrect)[^.]*)/i)?.[0]);
    note(!signedIn(B), 'revoke: every other browser (B) is signed out by the change');
  } finally {
    srv.kill();
    spawnSync('php', [path.join(__dirname, 'setpw.php')], { cwd: ROOT });
    if (fs.existsSync(SESS)) {
      for (const f of fs.readdirSync(SESS)) if (!before.includes(f) && f !== '.htaccess') fs.rmSync(path.join(SESS, f), { force: true });
      if (!hadSessDir) fs.rmSync(SESS, { recursive: true, force: true });
    }
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nsec4-sessionforge ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
