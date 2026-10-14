/**
 * AUDIT-12 owner decisions 18, 19, 42 and 43 — the lead path in
 * public/contact.php (and admin/inquiries.php, which reads its log).
 *
 *   43  IPC_TRUST_PROXY_FORWARDED (A12-L2-W5-G3-1): ships OFF; off, buyers
 *       behind one proxy address share the 5-per-10-minutes limit and a
 *       forwarded header changes nothing; on, each buyer is counted by the
 *       RIGHT-MOST X-Forwarded-For entry, and a rotated left-most (spoofed)
 *       entry does not buy a fresh allowance.
 *   42  the Inquiries row is written BEFORE mail() (A12-L4-W2-G4-1): pending
 *       while the mail server is busy, then a send-result line with the same
 *       id; a request killed inside mail() still leaves the lead; the
 *       Inquiries page merges row and result ("Sent to mail server", "Email
 *       failed", or "Not confirmed" when no result was written), counts each
 *       lead once (page total and nav badge), and still reads old-format rows.
 *
 * Runs on a private copy of the mirror (_harness/site) with its own
 * `php -S` servers, a sendmail stand-in and a private sys_temp_dir per server,
 * so neither the shared mirror's inquiry log nor the shared limiter files are
 * touched. Ports: LEADPATH12_PORT (default 8770) and the next three.
 *
 *   node _harness/leadpath12.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync, execFileSync } = require('child_process');
const { adminHttp } = require('./adminhttp');
const { rawRows, leads } = require('./inqrows');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(__dirname, 'site');
const P0 = Number(process.env.LEADPATH12_PORT || 8770);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-lp12-'));
const T = path.join(TMP, 'site');
const MAIL = path.join(TMP, 'mail.log');
const SLOW = path.join(TMP, 'slow');           // seconds the stand-in sendmail waits, when present
const FAILMAIL = path.join(TMP, 'fail');       // when present, the stand-in sendmail refuses
const INQ = path.join(T, 'admin', 'inquiries.jsonl');

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

const REC = path.join(TMP, 'rec.sh');
fs.writeFileSync(REC, `#!/bin/sh\nmsg=$(cat)\n[ -f "${SLOW}" ] && sleep "$(cat "${SLOW}")"\n[ -f "${FAILMAIL}" ] && exit 1\n{ echo "===MESSAGE==="; printf '%s\\n' "$msg"; echo; } >> "${MAIL}"\nexit 0\n`);
fs.chmodSync(REC, 0o755);

const servers = [];
function server(port, extra = []) {
  const t = fs.mkdtempSync(path.join(TMP, `t${port}-`));
  const p = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', T, '-c', path.join(__dirname, 'php-mail.ini'),
    '-d', `sendmail_path=${REC}`, '-d', `sys_temp_dir=${t}`, ...extra, path.join(__dirname, 'router.php')],
  { cwd: T, stdio: 'ignore', detached: true });
  servers.push(p);
  return p;
}
const stop = (p) => { try { process.kill(-p.pid, 'SIGKILL'); } catch (_) { try { p.kill('SIGKILL'); } catch (__) {} } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rows = () => leads(INQ);   // lead rows, send results merged (decision 42)
const messages = () => {
  try { return fs.readFileSync(MAIL, 'utf8').split('===MESSAGE===\n').filter((m) => m.trim()); } catch { return []; }
};

async function rfq(port, extra = {}, headers = {}) {
  const body = new FormData();
  body.append('form_type', 'rfq');
  body.append('name', extra.name || 'Lead Path Buyer');
  body.append('email', extra.email || 'buyer@example.com');
  body.append('partNumber', extra.part || 'IP30HS');
  body.append('quantity', '500 ft');
  for (const [k, v] of Object.entries(extra.fields || {})) body.append(k, v);
  const t0 = Date.now();
  const res = await fetch(`http://127.0.0.1:${port}/contact.php`, { method: 'POST', body, headers: { Accept: 'application/json', ...headers } });
  const text = await res.text();
  return { status: res.status, text, ms: Date.now() - t0 };
}

(async () => {
  for (let p = P0; p < P0 + 4; p++) {
    if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', `http://127.0.0.1:${p}/`]).status === 0) {
      console.log(`leadpath12: port ${p} is already in use — stop that server first, or set LEADPATH12_PORT`);
      process.exit(2);
    }
  }
  if (!fs.existsSync(path.join(SITE, 'contact.php'))) {
    console.log('leadpath12: no synced mirror — run npm run build && sh _harness/sync.sh');
    process.exit(2);
  }
  execFileSync('cp', ['-r', SITE, T]);
  fs.rmSync(path.join(T, 'admin', '.sessions'), { recursive: true, force: true });
  for (const f of fs.readdirSync(path.join(T, 'admin'))) {
    if (/^inquiries.*\.jsonl$/.test(f) || f === '.inquiry-log-failed.json' || f === '.inquiries-seen.json') fs.rmSync(path.join(T, 'admin', f));
  }
  const src = fs.readFileSync(path.join(ROOT, 'public', 'contact.php'), 'utf8');

  try {
    // ── 43 — the proxy switch ────────────────────────────────────────────
    note(/define\('IPC_TRUST_PROXY_FORWARDED', false\)/.test(src),
      '43 src: IPC_TRUST_PROXY_FORWARDED ships OFF (GO-LIVE C4 decides whether to turn it on)');
    {
      const off = server(P0);
      await sleep(900);
      const codes = [];
      for (let i = 0; i < 7; i++) codes.push((await rfq(P0, { email: `off${i}@example.com` }, { 'X-Forwarded-For': `203.0.113.${10 + i}` })).status);
      note(codes.slice(0, 5).every((c) => c === 200) && codes.slice(5).every((c) => c === 429),
        '43 off: seven buyers behind one proxy address share one limit (the 6th is refused), whatever X-Forwarded-For says', codes.join(' '));
      const ips = new Set(rows().map((r) => r.ip));
      note(ips.size === 1 && ips.has('127.0.0.1'), '43 off: every row records the connecting address', [...ips].join(', '));
      stop(off);
    }
    fs.rmSync(INQ, { force: true });
    {
      const PRE = path.join(TMP, 'trust-on.php');
      fs.writeFileSync(PRE, "<?php define('IPC_TRUST_PROXY_FORWARDED', true);\n");
      const on = server(P0 + 1, ['-d', `auto_prepend_file=${PRE}`]);
      await sleep(900);
      const codes = [];
      for (let i = 0; i < 7; i++) codes.push((await rfq(P0 + 1, { email: `on${i}@example.com` }, { 'X-Forwarded-For': `198.51.100.7, 203.0.113.${20 + i}` })).status);
      note(codes.every((c) => c === 200), '43 on: seven buyers through the proxy are each counted on their own (all accepted)', codes.join(' '));
      const ips = rows().map((r) => r.ip);
      note(ips.length === 7 && ips.every((ip, i) => ip === `203.0.113.${20 + i}`),
        '43 on: the row records the RIGHT-MOST forwarded address, the one the proxy appended', ips.join(', '));
      const spoof = [];
      for (let i = 0; i < 6; i++) spoof.push((await rfq(P0 + 1, { email: `sp${i}@example.com` }, { 'X-Forwarded-For': `10.0.${i}.1, 203.0.113.99` })).status);
      note(spoof.slice(0, 5).every((c) => c === 200) && spoof[5] === 429,
        '43 on: a rotated left-most (sender-written) entry does not buy a fresh allowance', spoof.join(' '));
      const junk = await rfq(P0 + 1, { email: 'junk@example.com' }, { 'X-Forwarded-For': 'not-an-address' });
      const last = rows().pop() || {};
      note(junk.status === 200 && last.ip === '127.0.0.1', '43 on: an unusable forwarded value falls back to the connecting address', `${junk.status} ip=${last.ip}`);
      stop(on);
    }

    // ── 42 — the row is written before mail() ───────────────────────────
    fs.rmSync(INQ, { force: true });
    fs.rmSync(path.join(T, 'admin', '.inquiries-seen.json'), { force: true });
    {
      const srv = server(P0 + 2);
      await sleep(900);
      fs.writeFileSync(SLOW, '3');
      const pending = rfq(P0 + 2, { name: 'Slow Mail Buyer', email: 'slow@example.com' });
      await sleep(1500);
      const mid = rawRows(INQ);
      note(mid.length === 1 && mid[0].name === 'Slow Mail Buyer' && mid[0].status === 'pending' && mid[0].sent === null && /^[0-9a-f]{16}$/.test(mid[0].id || ''),
        '42: while the mail server is still busy, the lead is already in the log, marked pending', JSON.stringify(mid).slice(0, 200));
      const r = await pending;
      const done = rawRows(INQ);
      note(r.status === 200 && done.length === 2 && done[1].type === 'send-result' && done[1].id === mid[0].id && done[1].sent === true,
        '42: after mail() returns, the send result is appended under the same id', JSON.stringify(done.slice(1)));
      fs.rmSync(SLOW, { force: true });

      // The mail server refuses: the row stays, its result says so.
      fs.writeFileSync(FAILMAIL, '');
      const rf = await rfq(P0 + 2, { name: 'Refused Mail Buyer', email: 'refused@example.com' });
      fs.rmSync(FAILMAIL, { force: true });
      const lf = leads(INQ).pop() || {};
      note(rf.status === 500 && lf.name === 'Refused Mail Buyer' && lf.sent === false && lf.status === 'failed',
        '42: a refused send keeps the lead, merged as failed', `${rf.status} ${JSON.stringify(lf).slice(0, 160)}`);

      // The host ends the request while mail() hangs (the finding's case B).
      fs.writeFileSync(SLOW, '30');
      rfq(P0 + 2, { name: 'Cut Off Buyer', email: 'cutoff@example.com' }).catch(() => {});
      await sleep(1500);
      stop(srv);
      await sleep(300);
      fs.rmSync(SLOW, { force: true });
      const cut = rawRows(INQ).filter((x) => x.name === 'Cut Off Buyer');
      note(cut.length === 1 && cut[0].status === 'pending' && !rawRows(INQ).some((x) => x.type === 'send-result' && x.id === cut[0].id),
        '42: a request killed inside mail() still leaves the lead in the log (pending, no result)', JSON.stringify(cut).slice(0, 160));
    }
    // An old-format row (before decision 42) is still read.
    fs.appendFileSync(INQ, JSON.stringify({ ts: '2026-10-01 09:00:00', type: 'message', name: 'Legacy Row Buyer', email: 'legacy@example.com', subject: 'old', message: 'old', ip: '127.0.0.1', sent: true }) + '\n');
    {
      const srv = server(P0 + 3);
      await sleep(900);
      const a = adminHttp(P0 + 3);
      const signedIn = await a.login('audit-pass-123');
      const dash = (await a.req('GET', '/admin/index.php')).body;
      const newCount = +((/(\d+) new inquir/.exec(dash) || [])[1] || 0);
      note(signedIn && newCount === 4, '42: the dashboard counts each lead once, not once per line (4 leads, 7 lines)', `signed in ${signedIn}; "${newCount} new"`);
      const html = (await a.req('GET', '/admin/inquiries.php')).body;
      const card = (name) => { const i = html.indexOf(name); const j = html.lastIndexOf('<details', i); return i < 0 || j < 0 ? '' : html.slice(j, i); };
      note(/Sent to mail server/.test(card('Slow Mail Buyer')), '42 page: a pending row with its result reads "Sent to mail server"', card('Slow Mail Buyer').replace(/\s+/g, ' ').slice(0, 200));
      note(/Email failed/.test(card('Refused Mail Buyer')), '42 page: a refused send reads "Email failed"');
      note(/Not confirmed/.test(card('Cut Off Buyer')) && !/Sent to mail server|Email failed/.test(card('Cut Off Buyer')),
        '42 page: a row with no result reads "Not confirmed"');
      note(/Sent to mail server/.test(card('Legacy Row Buyer')), '42 page: an old-format row (sent, no id) still reads "Sent to mail server"');
      const total = +((/stat-num">(\d+)<\/div><div class="stat-lbl">Total received/.exec(html) || [])[1] || -1);
      const refused = +((/stat-num[^"]*">(\d+)<\/div><div class="stat-lbl">Mail server refused/.exec(html) || [])[1] || -1);
      note(total === 4 && refused === 1 && (html.match(/<details class="inq/g) || []).length === 4,
        '42 page: four leads listed and counted once each; only the refused send counts as refused', `total ${total}, refused ${refused}`);
      note(/1 request is marked "Not confirmed"/.test(html), '42 page: the unconfirmed lead is explained above the list');
      stop(srv);
    }
  } finally {
    for (const p of servers) stop(p);
    await sleep(200);
    fs.rmSync(TMP, { recursive: true, force: true });
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nleadpath12 ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); for (const p of servers) stop(p); process.exit(1); });
