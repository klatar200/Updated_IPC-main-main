/**
 * SEC-3 (audit-runs/audit-2026-09-27.md; limits decided 2026-09-29) — the admin
 * session ends on the SERVER after 8 h without a page load and 12 h after
 * sign-in. Before, the only clock was session.gc_maxlifetime (probabilistic GC)
 * and unsaved.js's 5-minute keepalive touched the session, so an open tab
 * stayed signed in indefinitely.
 *
 * Time is moved by rewriting the stored timestamps in the real session file
 * (admin/.sessions/sess_<id>), not by mocking the clock.
 *
 *   idle        active_at 8 h + 1 min ago → GET redirects to sign-in, ping ok:false
 *   idle-ok     active_at 7 h 58 min ago → still signed in
 *   keepalive   ping.php does NOT move active_at; a real page load does
 *   absolute    auth_at 12 h + 1 min ago, active just now → signed out
 *   post        an expired POST gets the "session expired" page, not a 302
 *               (invariant 12)
 *   password    a password change keeps the original sign-in time
 *   legacy      a validly signed session with no timestamps (signed in before
 *               this shipped) stays signed in and is stamped
 *
 * Throwaway copy of the mirror, own `php -S` on :8724.
 *
 *   node _harness/sec3-sessionexpiry.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { adminHttp } = require('./adminhttp');

const MIRROR = path.join(__dirname, 'site');
const PORT = 8724;
const PW = 'audit-pass-123';
const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', `http://127.0.0.1:${PORT}/`]).status === 0) {
    console.log(`sec3-sessionexpiry: port ${PORT} is already in use`); process.exit(2);
  }
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-sec3-'));
  const SITE = path.join(TMP, 'site');
  fs.cpSync(path.join(MIRROR, 'admin'), path.join(SITE, 'admin'), { recursive: true,
    filter: (p) => !/\/admin\/(\.sessions|.*\.jsonl$|\.login-throttle\.json$)/.test(p) });
  fs.cpSync(path.join(MIRROR, 'data'), path.join(SITE, 'data'), { recursive: true });
  const SESS = path.join(SITE, 'admin', '.sessions');
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE], { cwd: SITE, stdio: 'ignore' });
  const now = () => Math.floor(Date.now() / 1000);
  const file = (a) => path.join(SESS, `sess_${a.jar.get('IPCADMIN')}`);
  const read = (a) => fs.readFileSync(file(a), 'utf8');
  const stamp = (a, key) => +((new RegExp(`${key}\\|i:(\\d+);`).exec(read(a)) || [])[1] || 0);
  const setStamp = (a, key, v) => fs.writeFileSync(file(a), read(a).replace(new RegExp(`${key}\\|i:\\d+;`), `${key}|i:${v};`));
  const signedIn = async (a) => (await a.req('GET', '/admin/index.php')).status === 200;
  const ping = async (a) => JSON.parse((await a.req('GET', '/admin/ping.php')).body).ok;
  const fresh = async () => { const a = adminHttp(PORT); if (!(await a.login(PW))) throw new Error('sign-in failed'); return a; };
  try {
    await new Promise((r) => setTimeout(r, 700));

    let a = await fresh();
    note(stamp(a, 'ipc_auth_at') > 0 && stamp(a, 'ipc_active_at') > 0, 'sign-in stores both timestamps in the session');
    setStamp(a, 'ipc_active_at', now() - 8 * 3600 + 120);
    note(await signedIn(a), 'idle-ok: 7 h 58 min idle is still signed in');
    setStamp(a, 'ipc_active_at', now() - 8 * 3600 - 60);
    note(!(await ping(a)), 'idle: ping.php reports signed out after 8 h 1 min idle');
    const g = await a.req('GET', '/admin/index.php');
    note(g.status === 302 && /auth\.php/.test(g.headers.location || ''), 'idle: a page load after 8 h 1 min redirects to sign-in', `status ${g.status}`);

    a = await fresh();
    const early = now() - 3 * 3600;
    setStamp(a, 'ipc_active_at', early);
    for (let i = 0; i < 3; i++) await ping(a);
    note(stamp(a, 'ipc_active_at') === early, 'keepalive: ping.php does not move the idle clock', `${stamp(a, 'ipc_active_at')} vs ${early}`);
    await a.req('GET', '/admin/help.php');
    note(now() - stamp(a, 'ipc_active_at') <= 5, 'keepalive: a real page load does move it');

    a = await fresh();
    setStamp(a, 'ipc_auth_at', now() - 12 * 3600 - 60);
    note(!(await signedIn(a)), 'absolute: 12 h 1 min after sign-in is signed out even while active');

    a = await fresh();
    const csrf = a.csrfOf((await a.req('GET', '/admin/settings.php')).body);
    setStamp(a, 'ipc_active_at', now() - 9 * 3600);
    const p = await a.post('/admin/settings.php', [['csrf_token', csrf], ['company_name', 'x']]);
    // csrf_fail_page() answers 403 on purpose; what invariant 12 forbids is the 302.
    note(p.status === 403 && /Your sign-in session expired/.test(p.body), 'post: an expired POST renders the session-expired page, not a 302 (invariant 12)', `status ${p.status}`);

    a = await fresh();
    const signedAt = now() - 3600;
    setStamp(a, 'ipc_auth_at', signedAt);
    const pg = await a.req('GET', '/admin/password.php');
    const NEWPW = 'sec3-new-password-123';
    await a.post('/admin/password.php', [['csrf_token', a.csrfOf(pg.body)], ['current_password', PW], ['new_password', NEWPW], ['confirm_password', NEWPW]]);
    note(await signedIn(a) && stamp(a, 'ipc_auth_at') === signedAt, 'password: a password change keeps the original sign-in time', `auth_at ${stamp(a, 'ipc_auth_at')} vs ${signedAt}`);
    await a.post('/admin/password.php', [['csrf_token', a.csrfOf((await a.req('GET', '/admin/password.php')).body)], ['current_password', NEWPW], ['new_password', PW], ['confirm_password', PW]]);

    a = await fresh();
    fs.writeFileSync(file(a), read(a).replace(/ipc_auth_at\|i:\d+;/, '').replace(/ipc_active_at\|i:\d+;/, ''));
    note(await signedIn(a) && stamp(a, 'ipc_auth_at') > 0, 'legacy: a signed session with no timestamps stays signed in and is stamped');
  } finally {
    srv.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nsec3-sessionexpiry ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
