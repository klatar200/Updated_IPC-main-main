#!/usr/bin/env node
'use strict';
/**
 * Audit 9 shared instrument I-admin (PLAN-11 §3.3).
 * Drives, in a FIXED order: every admin entry point signed out (GET+POST),
 * sign-in, every page signed in, every mutating POST once with valid data,
 * both public contact forms, and /sitemap.xml. One JSON record per step to
 * OUT/steps.jsonl, a human table to OUT/steps.md. Node 22 built-in fetch,
 * no dependencies. Never fails on what it observes: exit 0 once the drive
 * completes; exit 1 only if the drive itself could not be completed.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8148';
const MIRROR = path.resolve(process.env.MIRROR || '_harness/out/audit9/site-Iadmin');
const OUT = path.resolve(process.env.OUT || '_harness/out/audit9/I-admin');
const PASSWORD = 'audit-pass-123'; // never written to any output
const SKU = 'AUDIT9-TEST';
const DATA_DIR = path.join(MIRROR, 'data');
const ADMIN_DIR = path.join(MIRROR, 'admin');
const PRISTINE_DIR = path.resolve('_harness/pristine');
const ERROR_LOG = process.env.PHP_ERROR_LOG || '';

fs.mkdirSync(OUT, { recursive: true });
const stepsPath = path.join(OUT, 'steps.jsonl');
const mdPath = path.join(OUT, 'steps.md');
fs.writeFileSync(stepsPath, '');
fs.writeFileSync(mdPath, '# Audit 9 — I-admin steps\n\n| # | phase | method | path | status | data changed | note |\n|---|---|---|---|---|---|---|\n');

// ─── Cookie jar ──────────────────────────────────────────────
const jar = new Map();
const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
function absorbCookies(headers) {
  const set = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  for (const line of set) {
    const first = line.split(';')[0], eq = first.indexOf('=');
    if (eq !== -1) jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
  }
  return set;
}

// ─── Data-file hashing + backups ────────────────────────────
const DATA_FILES = {
  products: path.join(DATA_DIR, 'products-all.json'),
  siteInfo: path.join(DATA_DIR, 'site-info.json'),
  content: path.join(DATA_DIR, 'content.json'),
};
const sha256 = (p) => { try { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } catch { return null; } };
const hashAll = () => Object.fromEntries(Object.entries(DATA_FILES).map(([k, p]) => [k, sha256(p)]));

// backup_sort_key() port (admin/config.php) — [timestamp+seq], oldest first.
function backupSortKey(file) {
  const m = /\.backup\.(\d{8})-(\d{6})(?:-(\d{2,4}|[0-9a-f]{6}))?\.json$/.exec(path.basename(file));
  if (!m) return ['00000000000000', 0];
  const seq = m[3] === undefined || m[3] === '' ? 0 : (/^[0-9]+$/.test(m[3]) ? parseInt(m[3], 10) : 99);
  return [m[1] + m[2], seq];
}
function listBackups(prefix) {
  let files = [];
  try { files = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith(prefix + '.backup.') && f.endsWith('.json')); } catch { /* no data dir yet */ }
  files.sort((a, b) => { const ka = backupSortKey(a), kb = backupSortKey(b); return ka[0] !== kb[0] ? (ka[0] < kb[0] ? -1 : 1) : ka[1] - kb[1]; });
  return files; // oldest first
}
function allBackupFiles() {
  try { return fs.readdirSync(DATA_DIR).filter((f) => /\.backup\.\d{8}-\d{6}/.test(f)); } catch { return []; }
}

// ─── PHP error log delta (best-effort; PHP_ERROR_LOG env, default none) ─
let errorLogLineCount = 0;
function errorLogLines() {
  if (!ERROR_LOG) return null;
  try { const t = fs.readFileSync(ERROR_LOG, 'utf8'); return t.length ? t.split('\n').length - 1 : 0; } catch { return null; }
}
function errorLogDelta() {
  const now = errorLogLines();
  if (now === null) return null;
  const d = now - errorLogLineCount; errorLogLineCount = now; return d;
}

// ─── HTML helpers ────────────────────────────────────────────
function decodeEntities(s) {
  return s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
}
function extractCsrf(html) {
  const m = /name="csrf_token"\s+value="([^"]*)"/.exec(html);
  return m ? decodeEntities(m[1]) : '';
}
// nav.php's own sign-out <form> is included at the top of EVERY admin page,
// ahead of the page's real form — so "the first <form>" is nav's, not the
// content form. Every page this instrument scrapes (edit/settings/content)
// carries an optimistic-concurrency `orig_sig` hidden field, which nav's
// logout form does not, so that is what identifies the real one.
function mainForm(html) {
  const forms = html.match(/<form\b[\s\S]*?<\/form>/gi) || [];
  return forms.find((f) => f.includes('name="orig_sig"')) || forms[forms.length - 1] || '';
}
function parseAttrs(s) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'))?/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const name = m[1].toLowerCase();
    if (['novalidate', 'method', 'enctype', 'accept'].includes(name)) continue;
    const raw = m[3] !== undefined ? m[3] : m[4];
    attrs[name] = raw !== undefined ? decodeEntities(raw) : undefined;
  }
  return attrs;
}
// Ordered form-field scraper: reads <input>/<textarea>/<select> out of one
// <form>...</form> block in document order, exactly as a browser would
// submit it. Returns [name, value][] (repeats allowed, order preserved —
// content.php's form_complete truncation guard depends on that order).
function scrapeForm(formHtml) {
  const fields = [];
  const tagRe = /<input\b([^>]*)\/?>|<textarea\b([^>]*)>([\s\S]*?)<\/textarea>|<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  let m;
  while ((m = tagRe.exec(formHtml)) !== null) {
    if (m[1] !== undefined) {
      const a = parseAttrs(m[1]);
      const type = (a.type || 'text').toLowerCase();
      if (['submit', 'button', 'image', 'file', 'reset'].includes(type) || !a.name) continue;
      if (type === 'checkbox' || type === 'radio') { if ('checked' in a) fields.push([a.name, a.value ?? 'on']); }
      else fields.push([a.name, a.value ?? '']);
    } else if (m[2] !== undefined) {
      const a = parseAttrs(m[2]);
      if (a.name) fields.push([a.name, decodeEntities(m[3])]);
    } else if (m[4] !== undefined) {
      const a = parseAttrs(m[4]);
      if (!a.name) continue;
      const optRe = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
      let om, first = null, selected = [];
      while ((om = optRe.exec(m[5])) !== null) {
        const oa = parseAttrs(om[1]);
        const val = oa.value ?? decodeEntities(om[2]);
        if (first === null) first = val;
        if ('selected' in oa) selected.push(val);
      }
      if (!selected.length && first !== null) selected = [first];
      if ('multiple' in a) { for (const v of selected) fields.push([a.name, v]); }
      else if (selected.length) fields.push([a.name, selected[0]]);
    }
  }
  return fields;
}
function firstSelectOption(html, selectId) {
  const m = new RegExp(`<select\\b[^>]*id="${selectId}"[^>]*>([\\s\\S]*?)<\\/select>`, 'i').exec(html);
  if (!m) return '';
  const optRe = /<option\s+value="([^"]*)"/g;
  let om;
  while ((om = optRe.exec(m[1])) !== null) if (om[1] !== '') return decodeEntities(om[1]);
  return '';
}
const encodeFields = (pairs) => pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

// ─── HTTP driver ─────────────────────────────────────────────
let seq = 0;
const statusCounts = {};
let dataChangedSteps = 0, totalErrorLogLines = 0;

async function step(phase, label, method, urlPath, opts = {}) {
  seq += 1;
  const before = hashAll();
  const backupsBefore = new Set(allBackupFiles());
  const headers = Object.assign({ Cookie: cookieHeader() }, opts.headers || {});
  let body = opts.body;
  if (opts.form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = encodeFields(opts.form); }
  let status = 0, setCookies = [], bodyBuf = Buffer.alloc(0), bodyText = '', errNote = '';
  try {
    const res = await fetch(BASE_URL + urlPath, { method, headers, body: method === 'GET' ? undefined : body, redirect: 'manual' });
    bodyBuf = Buffer.from(await res.arrayBuffer());
    bodyText = bodyBuf.slice(0, 200).toString('utf8').replace(/[\r\n]+/g, ' ');
    setCookies = absorbCookies(res.headers);
    status = res.status;
  } catch (e) {
    errNote = 'request failed: ' + (e && e.message ? e.message : String(e));
  }
  const after = hashAll();
  const changed = Object.keys(before).filter((k) => before[k] !== after[k]);
  if (changed.length) dataChangedSteps += 1;
  const backupsNew = allBackupFiles().filter((f) => !backupsBefore.has(f));
  const elDelta = errorLogDelta();
  if (elDelta) totalErrorLogLines += elDelta;
  statusCounts[status] = (statusCounts[status] || 0) + 1;
  const note = errNote || opts.note || '';
  const record = {
    seq, phase, label, method, path: urlPath, status, set_cookie: setCookies, body_prefix: bodyText,
    data_sha256_before: before, data_sha256_after: after, data_changed: changed,
    backups_new: backupsNew, error_log_delta: elDelta, note,
  };
  fs.appendFileSync(stepsPath, JSON.stringify(record) + '\n');
  fs.appendFileSync(mdPath, `| ${seq} | ${phase} | ${method} | ${urlPath} | ${status} | ${changed.join(',') || '-'} | ${note.replace(/\|/g, '/')} |\n`);
  record._body = bodyBuf;
  return record;
}
const get = (phase, label, p) => step(phase, label, 'GET', p, {});
const post = (phase, label, p, fields) => step(phase, label, 'POST', p, { form: fields });
// Multipart upload — global FormData/Blob so fetch sets its own boundary.
async function stepUpload(phase, label, urlPath, fields, fileField, buf, fileName, mime) {
  const form = new FormData();
  for (const [k, v] of fields) form.append(k, v);
  form.append(fileField, new Blob([buf], { type: mime }), fileName);
  return step(phase, label, 'POST', urlPath, { body: form });
}
// GET a page, scrape its csrf token, POST extraFields+csrf_token to postPath.
async function csrfPost(phase, label, getPath, postPath, extraFields) {
  const g = await get(phase, label + ' (form)', getPath);
  const csrf = extractCsrf(g._body.toString('utf8'));
  await post(phase, label, postPath, [...extraFields, ['csrf_token', csrf]]);
}

// ─── Fixtures: minimal valid PDF and PNG ────────────────────
function makePdf() {
  const parts = []; let offset = 0; const off = [0];
  const push = (s) => { parts.push(s); offset += Buffer.byteLength(s); };
  push('%PDF-1.4\n');
  off[1] = offset; push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  off[2] = offset; push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  off[3] = offset; push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> >>\nendobj\n');
  const xrefOffset = offset;
  let xref = 'xref\n0 4\n0000000000 65535 f \n';
  for (let i = 1; i <= 3; i++) xref += String(off[i]).padStart(10, '0') + ' 00000 n \n';
  push(xref);
  push('trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF');
  return Buffer.from(parts.join(''), 'latin1');
}
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function makePng() {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); // 1x1 truecolor, 8-bit (real IHDR, not a stub)
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  const idat = zlib.deflateSync(Buffer.from([0, 255, 0, 0])); // filter byte + 1 RGB pixel
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// ─── The drive ───────────────────────────────────────────────
const ENTRY_POINTS = [
  ['index.php', 'index.php'], ['auth.php', 'auth.php'], ['add.php', 'add.php'],
  ['edit.php?sku=' + SKU, 'edit.php'], ['delete.php?sku=' + SKU, 'delete.php'],
  ['upload-pdf.php?sku=' + SKU, 'upload-pdf.php'], ['upload-image.php?sku=' + SKU, 'upload-image.php'],
  ['settings.php', 'settings.php'], ['content.php', 'content.php'], ['backups.php', 'backups.php'],
  ['audit-log.php', 'audit-log.php'], ['inquiries.php', 'inquiries.php'], ['password.php', 'password.php'],
  ['help.php', 'help.php'], ['ping.php', 'ping.php'],
];

async function main() {
  errorLogLineCount = errorLogLines() || 0;

  // (1) Every admin entry point, signed OUT: GET, then POST with an empty body.
  for (const [p, label] of ENTRY_POINTS) await get('signed-out-get', label, '/admin/' + p);
  for (const [p, label] of ENTRY_POINTS) await post('signed-out-post', label, '/admin/' + p, []);

  // (2) Sign in.
  const authGet = await get('sign-in', 'auth.php (form)', '/admin/auth.php');
  await post('sign-in', 'auth.php (login)', '/admin/auth.php', [
    ['password', PASSWORD], ['csrf_token', extractCsrf(authGet._body.toString('utf8'))],
  ]);

  // (3) Every admin page, signed IN.
  for (const [p, label] of ENTRY_POINTS) await get('signed-in-get', label, '/admin/' + p);

  // (4) Mutating flow.
  let g = await get('mutate', 'add.php (form)', '/admin/add.php');
  let html = g._body.toString('utf8');
  await post('mutate', 'add.php (create ' + SKU + ')', '/admin/add.php', [
    ['sku', SKU], ['partType', firstSelectOption(html, 'partType')],
    ['name', 'Audit 9 Test Product'], ['csrf_token', extractCsrf(html)],
  ]);

  g = await get('mutate', 'edit.php (form)', '/admin/edit.php?sku=' + SKU);
  await post('mutate', 'edit.php (save ' + SKU + ')', '/admin/edit.php?sku=' + SKU, scrapeForm(mainForm(g._body.toString('utf8'))));

  g = await get('mutate', 'upload-pdf.php (form)', '/admin/upload-pdf.php?sku=' + SKU);
  await stepUpload('mutate', 'upload-pdf.php (upload)', '/admin/upload-pdf.php?sku=' + SKU,
    [['csrf_token', extractCsrf(g._body.toString('utf8'))]], 'pdf_file', makePdf(), 'audit9-test.pdf', 'application/pdf');

  g = await get('mutate', 'upload-image.php (form)', '/admin/upload-image.php?sku=' + SKU);
  await stepUpload('mutate', 'upload-image.php (upload)', '/admin/upload-image.php?sku=' + SKU,
    [['csrf_token', extractCsrf(g._body.toString('utf8'))]], 'image_file', makePng(), 'audit9-test.png', 'image/png');

  await csrfPost('mutate', 'upload-pdf.php (remove)', '/admin/upload-pdf.php?sku=' + SKU, '/admin/upload-pdf.php?sku=' + SKU, [['action', 'remove']]);
  await csrfPost('mutate', 'upload-image.php (remove)', '/admin/upload-image.php?sku=' + SKU, '/admin/upload-image.php?sku=' + SKU, [['action', 'remove']]);

  // settings.php — unchanged (expect inv.16 no-op path).
  g = await get('mutate', 'settings.php (form)', '/admin/settings.php');
  await post('mutate', 'settings.php (save, unchanged)', '/admin/settings.php', scrapeForm(mainForm(g._body.toString('utf8'))));

  // settings.php — one field changed, then restored.
  g = await get('mutate', 'settings.php (form, fresh sig)', '/admin/settings.php');
  let settingsFields = scrapeForm(mainForm(g._body.toString('utf8')));
  const sloganIdx = settingsFields.findIndex(([k]) => k === 'company_slogan');
  const originalSlogan = sloganIdx !== -1 ? settingsFields[sloganIdx][1] : '';
  await post('mutate', 'settings.php (save, one field changed)', '/admin/settings.php',
    settingsFields.map((f) => (f[0] === 'company_slogan' ? [f[0], originalSlogan + ' (audit9 probe)'] : f)));

  g = await get('mutate', 'settings.php (form, post-change)', '/admin/settings.php');
  await post('mutate', 'settings.php (save, restored)', '/admin/settings.php',
    scrapeForm(mainForm(g._body.toString('utf8'))).map((f) => (f[0] === 'company_slogan' ? [f[0], originalSlogan] : f)));

  // content.php — unchanged, every field incl. form_complete LAST (as scraped).
  g = await get('mutate', 'content.php (form)', '/admin/content.php');
  await post('mutate', 'content.php (save, unchanged)', '/admin/content.php', scrapeForm(mainForm(g._body.toString('utf8'))));

  // backups.php — restore the newest content.json backup, if one exists.
  const contentBackups = listBackups('content'); // oldest..newest
  g = await get('mutate', 'backups.php (list)', '/admin/backups.php');
  if (contentBackups.length) {
    const newest = contentBackups[contentBackups.length - 1];
    await post('mutate', 'backups.php (restore ' + newest + ')', '/admin/backups.php',
      [['backup', newest], ['csrf_token', extractCsrf(g._body.toString('utf8'))]]);
  } else {
    seq += 1;
    const rec = { seq, phase: 'mutate', label: 'backups.php (restore content — SKIPPED)', method: 'POST', path: '/admin/backups.php', status: null, note: 'no content.backup.*.json exists in MIRROR/data — nothing to restore' };
    fs.appendFileSync(stepsPath, JSON.stringify(rec) + '\n');
    fs.appendFileSync(mdPath, `| ${seq} | mutate | POST | /admin/backups.php | - | - | SKIPPED: no content backup present |\n`);
  }

  // password.php — WRONG current password (expect rejection; never actually changed).
  await csrfPost('mutate', 'password.php (wrong current password)', '/admin/password.php', '/admin/password.php',
    [['current_password', 'definitely-not-the-password'], ['new_password', 'DoesNotMatter123'], ['confirm_password', 'DoesNotMatter123']]);

  // index.php close-reset-window (open the window first, then close it).
  fs.mkdirSync(ADMIN_DIR, { recursive: true });
  fs.writeFileSync(path.join(ADMIN_DIR, 'ALLOW-PASSWORD-RESET'), '');
  await csrfPost('mutate', 'index.php (close-reset-window)', '/admin/index.php', '/admin/index.php', [['close_reset_window', '1']]);

  await csrfPost('mutate', 'delete.php (delete ' + SKU + ')', '/admin/delete.php?sku=' + SKU, '/admin/delete.php?sku=' + SKU, []);

  // Sign out — reuse whatever csrf token is already in hand (session-scoped, non-rotating).
  const outGet = await get('sign-out', 'index.php (pre-signout form)', '/admin/index.php');
  await post('sign-out', 'auth.php (logout)', '/admin/auth.php', [['logout', '1'], ['csrf_token', extractCsrf(outGet._body.toString('utf8'))]]);

  // (5) Public contact forms + sitemap.
  await post('contact', 'contact.php (rfq)', '/contact.php', [
    ['form_type', 'rfq'], ['name', 'Audit Nine Bot'], ['email', 'audit9@example.com'], ['phone', '555-0100'],
    ['company', 'Audit Co'], ['partNumber', 'IP33PO'], ['material', 'PVC'], ['quantity', '100'],
    ['requiredDate', ''], ['specialReqs', ''], ['additionalNotes', 'Audit 9 I-admin instrument RFQ probe.'], ['website', ''],
  ]);
  await post('contact', 'contact.php (message)', '/contact.php', [
    ['form_type', 'message'], ['name', 'Audit Nine Bot'], ['email', 'audit9@example.com'], ['phone', '555-0100'],
    ['company', 'Audit Co'], ['subject', 'Audit 9 probe'], ['message', 'Audit 9 I-admin instrument message probe.'], ['website', ''],
  ]);
  await get('sitemap', 'sitemap.xml', '/sitemap.xml');

  // Restore MIRROR/data/*.json from pristine and prove byte-equality.
  const restore = {};
  for (const [key, file] of Object.entries(DATA_FILES)) {
    const pristineFile = path.join(PRISTINE_DIR, path.basename(file));
    try { fs.copyFileSync(pristineFile, file); restore[key] = sha256(file) === sha256(pristineFile) ? 'byte-equal' : 'MISMATCH'; }
    catch (e) { restore[key] = 'restore failed: ' + e.message; }
  }

  const statusLine = Object.entries(statusCounts).sort((a, b) => a[0] - b[0]).map(([s, c]) => `${s}:${c}`).join(',');
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({
    base_url: BASE_URL, mirror: MIRROR, out: OUT, steps: seq, status_counts: statusCounts,
    data_changed_steps: dataChangedSteps, error_log_lines: totalErrorLogLines, restore,
  }, null, 2));
  fs.appendFileSync(mdPath, `\n## Restore\n\nMIRROR/data/*.json restored from _harness/pristine/: ${JSON.stringify(restore)}\n` +
    `(the mirror itself, ${MIRROR}, is otherwise left as the drive produced it — disposable.)\n`);

  console.log(`steps ${seq} · statuses {${statusLine}} · data-changed-steps ${dataChangedSteps} · error-log-lines ${totalErrorLogLines}`);
  console.log('restore: ' + JSON.stringify(restore));
}

main().catch((e) => { console.error('I-admin instrument could not complete the drive:', e); process.exit(1); });
