/**
 * Lows batch B — public/contact.php: PUB-5, PUB-8, PUB-9, PUB-13, NEW-V3-2,
 * NEW-N2-10 (audit-runs/audit-2026-09-27.md).
 *
 * Own `php -S` servers over the mirror with a sendmail stand-in that records
 * every message, and a private sys_temp_dir so the limiters start empty.
 *   PUB-5   Subject and auto-reply Subject are pure ASCII (RFC 2047 words)
 *           and decode back to the em dash and the visitor's accented name
 *   V3-2    both messages declare Content-Transfer-Encoding: 8bit
 *   PUB-8   a blank street falls back in the auto-reply signature
 *   PUB-9   the no-JS page for an RFQ says "Quote request sent" and shows the
 *           owner's own rfqSuccessBody
 *   N2-10   after a short (unterminated) line, the next lead is still a valid
 *           JSON line, and the failure marker is kept
 *   PUB-13  a request waits for the per-address limiter lock another
 *           request holds (the race itself did not reproduce outside Apache)
 * Restores the mirror's site-info.json, content.json and inquiry log.
 *
 *   node _harness/lowsB-contact.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const SITE = path.join(__dirname, 'site');
const DATA = path.join(SITE, 'data');
const ADMIN = path.join(SITE, 'admin');
const PRISTINE = path.join(__dirname, 'pristine');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-lowsB-'));
const MAIL = path.join(TMP, 'mail.log');
const INQ = path.join(ADMIN, 'inquiries.jsonl');
const MARKER = path.join(ADMIN, '.inquiry-log-failed.json');

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

const REC = path.join(TMP, 'rec.sh');
fs.writeFileSync(REC, `#!/bin/sh\n{ echo "===MESSAGE==="; cat; echo; } >> "${MAIL}"\nexit 0\n`);
fs.chmodSync(REC, 0o755);

function server(port, workers) {
  const t = fs.mkdtempSync(path.join(TMP, `t${port}-`));
  return spawn('php', ['-S', `127.0.0.1:${port}`, '-t', SITE, '-c', path.join(__dirname, 'php-mail.ini'),
    '-d', `sendmail_path=${REC}`, '-d', `sys_temp_dir=${t}`, path.join(__dirname, 'router.php')],
  { cwd: SITE, stdio: 'ignore', env: { ...process.env, ...(workers ? { PHP_CLI_SERVER_WORKERS: String(workers) } : {}) } });
}
const messages = () => {
  try { return fs.readFileSync(MAIL, 'utf8').split('===MESSAGE===\n').filter((m) => m.trim()); } catch { return []; }
};
const header = (m, name) => {
  const head = m.split(/\r?\n\r?\n/)[0];
  const r = new RegExp(`^${name}:\\s*(.*)$`, 'mi').exec(head);
  return r ? r[1].trim() : '';
};
const decodeWords = (v) => v.replace(/=\?UTF-8\?B\?([^?]*)\?=\s*/gi, (_, b) => Buffer.from(b, 'base64').toString('utf8')).trim();
async function rfq(port, extra = {}, headers = {}) {
  const body = new FormData();
  body.append('form_type', 'rfq');
  body.append('name', extra.name || 'Test Buyer');
  body.append('email', extra.email || 'buyer@example.com');
  body.append('partNumber', 'IP30HS');
  body.append('quantity', '500 ft');
  const res = await fetch(`http://127.0.0.1:${port}/contact.php`, { method: 'POST', body, headers });
  return { status: res.status, text: await res.text() };
}

(async () => {
  for (const p of [8716]) {
    if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', `http://127.0.0.1:${p}/`]).status === 0) {
      console.log(`lowsB-contact: port ${p} is already in use — stop that server first`);
      process.exit(2);
    }
  }
  const inqBefore = fs.existsSync(INQ) ? fs.readFileSync(INQ) : null;
  const markerBefore = fs.existsSync(MARKER) ? fs.readFileSync(MARKER) : null;
  const one = server(8716, 0);
  try {
    await new Promise((r) => setTimeout(r, 1000));

    // ── PUB-5 / V3-2 / PUB-8 ──
    const si = JSON.parse(fs.readFileSync(path.join(PRISTINE, 'site-info.json'), 'utf8'));
    si.address.street = '';
    fs.writeFileSync(path.join(DATA, 'site-info.json'), JSON.stringify(si, null, 4));
    const r1 = await rfq(8716, { name: 'José Ñandú' });
    const ms = messages();
    note(ms.length === 2, 'setup: the quote request and its auto-reply were both sent', `${ms.length} messages; ${r1.text.slice(0, 120)}`);
    const subj = ms.map((m) => header(m, 'Subject'));
    note(subj.length === 2 && subj.every((x) => /^[\x20-\x7e]+$/.test(x)), 'PUB-5: both Subject headers are plain ASCII on the wire', subj.join(' | '));
    note(/IPC Quote Request — IP30HS — José Ñandú/.test(decodeWords(subj[0] || '')) && /We received your quote request — /.test(decodeWords(subj[1] || '')),
      'PUB-5: and they decode back to the em dash and the accented name', subj.map(decodeWords).join(' | '));
    note(ms.length === 2 && ms.every((m) => /^Content-Transfer-Encoding: 8bit$/mi.test(m.split(/\r?\n\r?\n/)[0])),
      'V3-2: both messages declare Content-Transfer-Encoding: 8bit');
    const reply = ms[1] || '';
    note(/250 Gibraltar Dr, Bolingbrook/.test(reply) && !/\n, Bolingbrook/.test(reply),
      'PUB-8: a blank street falls back to the built-in one in the auto-reply signature', (reply.match(/.*Bolingbrook.*/) || [''])[0]);
    fs.copyFileSync(path.join(PRISTINE, 'site-info.json'), path.join(DATA, 'site-info.json'));

    // ── PUB-9 ──
    const c = JSON.parse(fs.readFileSync(path.join(PRISTINE, 'content.json'), 'utf8'));
    c.copy = c.copy || {};
    c.copy.contactForm = { ...(c.copy.contactForm || {}), rfqSuccessBody: 'LOWSB custom promise: back to you by Tuesday.' };
    fs.writeFileSync(path.join(DATA, 'content.json'), JSON.stringify(c, null, 4));
    const r9 = await rfq(8716, { email: 'nojs@example.com' }, { Accept: 'text/html' });
    note(/Quote request sent/.test(r9.text) && /LOWSB custom promise/.test(r9.text) && !/Message sent/.test(r9.text),
      'PUB-9: the no-JS RFQ page says "Quote request sent" with the owner\'s own text', (r9.text.match(/<h1[^>]*>[^<]*/) || [''])[0]);
    fs.copyFileSync(path.join(PRISTINE, 'content.json'), path.join(DATA, 'content.json'));

    // ── N2-10 ──
    fs.writeFileSync(INQ, (inqBefore ? inqBefore.toString() : '') + '{"ts":"2026-01-01","type":"rfq","name":"cut sho');
    fs.writeFileSync(MARKER, JSON.stringify({ ts: 'x', path: 'admin/inquiries.jsonl' }));
    await rfq(8716, { name: 'After The Cut', email: 'after@example.com' });
    const last = fs.readFileSync(INQ, 'utf8').trimEnd().split('\n').pop();
    let parsed = null;
    try { parsed = JSON.parse(last); } catch { /* stays null */ }
    note(parsed && parsed.name === 'After The Cut', 'N2-10: the lead after a short line is still its own valid JSON line', last.slice(0, 100));
    note(fs.existsSync(MARKER), 'N2-10: and the failure marker from the short line is kept, not cleared');

    // ── PUB-13 ── the limiter's read-modify-write must happen under a lock.
    // The race itself did not reproduce here (12 simultaneous `php` processes
    // and `php -S` workers both stayed within 5 against unfixed code; it was
    // measured on Apache prefork), so assert the mechanism instead: while
    // another process holds the per-address lock, a request must WAIT for it
    // rather than read the counter. Unfixed code takes no lock and answers at
    // once.
    const crypto = require('crypto');
    for (const [label, lockName, email] of [
      ['rate limit', `ipc_rl_${crypto.createHash('md5').update('203.0.113.7').digest('hex')}.json.lock`, 'lockprobe1@example.com'],
    ]) {
      const shared = fs.mkdtempSync(path.join(TMP, 'lock-'));
      const lockPath = path.join(shared, lockName);
      const holder = spawn('php', ['-r', `$f=fopen(${JSON.stringify(lockPath)},'c'); flock($f, LOCK_EX); echo "held\n"; usleep(2000000);`]);
      await new Promise((r) => holder.stdout.once('data', r));
      const t0 = Date.now();
      await new Promise((res) => {
        const p = spawn('php', ['-c', path.join(__dirname, 'php-mail.ini'), '-d', `sendmail_path=${REC}`, '-d', `sys_temp_dir=${shared}`, '-r',
          `$_SERVER['REQUEST_METHOD']='POST'; $_SERVER['REMOTE_ADDR']='203.0.113.7'; $_SERVER['HTTP_ACCEPT']='application/json';
           $_POST=['form_type'=>'rfq','name'=>'Lock Probe','email'=>${JSON.stringify(email)},'partNumber'=>'IP30HS','quantity'=>'5'];
           chdir(${JSON.stringify(SITE)}); include 'contact.php';`], { cwd: SITE, stdio: 'ignore' });
        p.on('close', res);
      });
      const waited = Date.now() - t0;
      holder.kill();
      note(waited >= 1500, `PUB-13: a request waits for the ${label} lock another request holds (waited ${waited} ms)`);
    }
  } finally {
    one.kill();
    for (const n of ['site-info.json', 'content.json']) fs.copyFileSync(path.join(PRISTINE, n), path.join(DATA, n));
    if (inqBefore === null) fs.rmSync(INQ, { force: true }); else fs.writeFileSync(INQ, inqBefore);
    if (markerBefore === null) fs.rmSync(MARKER, { force: true }); else fs.writeFileSync(MARKER, markerBefore);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nlowsB-contact ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
