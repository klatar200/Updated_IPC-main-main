/**
 * A clean, private mirror for the Help-page / handoff-email screenshots, and a
 * php -S over it on :8140.
 *
 *   npm run build && bash _harness/sync.sh     # first: the sweep mirror
 *   node _harness/helpshots-site.js            # copy it, seed demo leads, serve
 *   node _harness/helpshots.js                 # (other terminal) take the shots
 *
 * Why a copy and not _harness/site: the sweep mirror's admin/inquiries.jsonl
 * and admin-log.jsonl hold hundreds of test rows ("Verbose Engineer", AAAA…),
 * which is not what the owner should see in a picture of his own dashboard.
 * Here both logs start empty, Inquiries gets five obviously-invented leads
 * (example.com addresses), and the data files are the repo's site-data/ as is.
 * The copy lives in _harness/out/ (ignored) and is rebuilt on every run.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(__dirname, 'site');
const DST = path.join(__dirname, 'out', 'shots-site');
const PORT = 8140;

if (!fs.existsSync(path.join(SRC, 'admin', 'config.local.php'))) {
  console.error('helpshots-site: run `bash _harness/sync.sh` first (no mirror password)');
  process.exit(2);
}
fs.rmSync(DST, { recursive: true, force: true });
fs.cpSync(SRC, DST, { recursive: true });
for (const f of ['site-info.json', 'content.json', 'products-all.json']) {
  fs.copyFileSync(path.join(ROOT, 'site-data', f), path.join(DST, 'site-data', f));
}
const adm = path.join(DST, 'admin');
for (const f of fs.readdirSync(adm)) {
  if (/^(admin-log|inquiries)(-\d.*)?\.jsonl$/.test(f) || /^\.(inquiries-seen|login-throttle|inquiry-log-failed|pdf-renames)\.json$/.test(f)) {
    fs.rmSync(path.join(adm, f), { force: true });
  }
}
fs.rmSync(path.join(adm, '.sessions'), { recursive: true, force: true });
for (const f of fs.readdirSync(path.join(DST, 'site-data'))) {
  if (/\.backup\./.test(f)) fs.rmSync(path.join(DST, 'site-data', f));
}

// Five invented leads, oldest first (the log is append-only, newest last).
const now = Date.now();
const stamp = (hoursAgo) => {
  const d = new Date(now - hoursAgo * 3600e3);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const rows = [];
let n = 0;
const lead = (h, o) => {
  const id = (0x1000000000 + ++n).toString(16).padStart(16, 'a');
  rows.push({ ts: stamp(h), ...o, ip: '203.0.113.' + (10 + n), id, sent: null, status: 'pending' });
  rows.push({ ts: stamp(h - 0.001), type: 'send-result', id, sent: true });
};
lead(70, { type: 'rfq', name: 'Dana Whitfield', company: 'Midwest Harness Co.', email: 'dana@example.com', phone: '(630) 555-0142', part: 'IP38FE', material: 'Fiberglass sleeving, black', quantity: '2,000 ft', reqDate: '', special: '', notes: 'Can you ship partial now and the rest next month?' });
lead(46, { type: 'message', name: 'Luis Ortega', company: 'Ortega Motor Rewind', email: 'luis@example.com', phone: '', subject: 'Datasheet question', message: 'Is the IP30HS rated for continuous use at 155°C? I could not find it on the sheet.' });
lead(26, { type: 'rfq', name: 'Priya Raman', company: 'Northline Appliance', email: 'priya@example.com', phone: '(312) 555-0188', part: 'IP13SP', material: '', quantity: '500 ft per size, 3 sizes', reqDate: '', special: 'Cut to 18 inch lengths', notes: '' });
lead(5, { type: 'rfq', name: 'Tom Becker', company: 'Becker Controls', email: 'tom@example.com', phone: '(815) 555-0107', part: 'IP12GA', material: '', quantity: '1,000 ft', reqDate: '', special: '', notes: 'Need by end of the month.' });
lead(1, { type: 'message', name: 'Sarah Kim', company: '', email: 'sarah@example.com', phone: '', subject: 'Samples', message: 'Do you send samples of your heat shrink tubing before a first order?' });
fs.writeFileSync(path.join(adm, 'inquiries.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

const env = { ...process.env };
if (!env.PHP_INI_SCAN_DIR) env.PHP_INI_SCAN_DIR = require('./php-local').ensure().scanDir;
const k = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', DST, '-c', path.join(__dirname, 'php-mail.ini'), path.join(__dirname, 'router.php')],
  { cwd: ROOT, env, stdio: 'inherit' });
console.log(`helpshots-site: http://127.0.0.1:${PORT}/  (admin password audit-pass-123), pid ${k.pid}`);
const stop = () => { k.kill(); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
