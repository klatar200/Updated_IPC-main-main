/**
 * DEP-2 = PUB-3 — contact.php's envelope sender (sendmail -f).
 * audit-runs/audit-2026-09-27.md §3 (DEP-2), measured in §9.
 *
 * mail() was called with no 5th argument, so the envelope sender (the address
 * SPF is checked against, and the one DMARC aligns with the From:) was
 * whatever the host MTA defaults to. The fix is `-f noreply@…`, but ONLY once
 * the domain's SPF authorises the host's mail servers: switching before that
 * makes delivery worse, not better. So it ships OFF behind one constant,
 * IPC_ENVELOPE_FROM, and GO-LIVE says when to turn it on.
 *
 * Two own `php -S` servers over the mirror, each with a sendmail stand-in that
 * records its argv, one quote request each (sales mail + auto-reply). 6 checks:
 *   off   as shipped -> neither message carries -f (host default unchanged);
 *         control: both messages were really sent
 *   on    IPC_ENVELOPE_FROM set (auto_prepend_file) -> both messages carry
 *         exactly -fnoreply@insulationproducts.com
 *   src   the shipped constant is '' (the switch has not been flipped early)
 *
 *   node _harness/dep2-envelope.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(__dirname, 'site');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-dep2-'));
const ADDR = 'noreply@insulationproducts.com';

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

// Records one line per message: the argv sendmail was given.
const REC = path.join(TMP, 'rec.sh');
fs.writeFileSync(REC, `#!/bin/sh\necho "ARGV:$*" >> "${path.join(TMP, 'argv.log')}"\ncat > /dev/null\nexit 0\n`);
fs.chmodSync(REC, 0o755);
const PREPEND = path.join(TMP, 'on.php');
fs.writeFileSync(PREPEND, `<?php define('IPC_ENVELOPE_FROM', '${ADDR}');\n`);

function server(port, extra) {
  const tmp = fs.mkdtempSync(path.join(TMP, `s${port}-`));
  return spawn('php', ['-S', `127.0.0.1:${port}`, '-t', SITE,
    '-d', `sendmail_path=${REC} -t -i`, '-d', `sys_temp_dir=${tmp}`, '-d', 'opcache.revalidate_freq=0',
    ...extra, path.join(__dirname, 'router.php')], { cwd: SITE, stdio: 'ignore' });
}

async function submit(port) {
  const body = new FormData();
  body.append('form_type', 'rfq');
  body.append('name', 'Envelope Test');
  body.append('email', 'envelope-test@example.com');
  body.append('partNumber', 'IP30HS');
  body.append('quantity', '500 ft');
  const res = await fetch(`http://127.0.0.1:${port}/contact.php`, { method: 'POST', body });
  return res.json().catch(() => ({}));
}

const argvLines = () => {
  try { return fs.readFileSync(path.join(TMP, 'argv.log'), 'utf8').split('\n').filter(Boolean); } catch { return []; }
};

(async () => {
  for (const p of [8710, 8711]) {
    if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', `http://127.0.0.1:${p}/`]).status === 0) {
      console.log(`dep2-envelope: port ${p} is already in use — stop that server first`);
      process.exit(2);
    }
  }
  const off = server(8710, []);
  const on = server(8711, ['-d', `auto_prepend_file=${PREPEND}`]);
  const inquiries = path.join(SITE, 'admin', 'inquiries.jsonl');
  const inqBefore = fs.existsSync(inquiries) ? fs.readFileSync(inquiries) : null;
  try {
    await new Promise((r) => setTimeout(r, 800));

    const r1 = await submit(8710);
    const offLines = argvLines();
    note(r1.ok === true && offLines.length === 2, 'off: control — the quote request and its auto-reply were both sent',
      `response ${JSON.stringify(r1)}; ${offLines.length} message(s)`);
    note(offLines.length > 0 && offLines.every((l) => !/(^|\s)-f/.test(l)), 'off: as shipped, no message carries -f (the host default is unchanged)',
      offLines.join(' | '));

    fs.writeFileSync(path.join(TMP, 'argv.log'), '');
    const r2 = await submit(8711);
    const onLines = argvLines();
    note(r2.ok === true && onLines.length === 2, 'on: control — both messages were sent', `${onLines.length} message(s)`);
    note(onLines.length === 2 && onLines.every((l) => l.includes(`-f${ADDR}`)),
      `on: with IPC_ENVELOPE_FROM set, both the sales mail and the auto-reply carry -f${ADDR}`, onLines.join(' | '));
    note(onLines.every((l) => (l.match(/(^|\s)-f/g) || []).length === 1), 'on: and exactly one -f each', onLines.join(' | '));

    const src = fs.readFileSync(path.join(ROOT, 'public', 'contact.php'), 'utf8');
    note(/define\('IPC_ENVELOPE_FROM',\s*''\)/.test(src), 'src: the shipped switch is OFF until GO-LIVE §A says SPF is published');
  } finally {
    off.kill();
    on.kill();
    // Both submissions append to the mirror's inquiry log; put it back.
    if (inqBefore === null) fs.rmSync(inquiries, { force: true });
    else fs.writeFileSync(inquiries, inqBefore);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\ndep2-envelope ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
