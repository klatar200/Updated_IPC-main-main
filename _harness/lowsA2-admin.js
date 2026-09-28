/**
 * Lows batch A2 — the admin logic Lows of audit-runs/audit-2026-09-27.md:
 * ADM-5, ADM-13, ADM-14, NEW-N1-15, N1-16, N2-3, N2-4, N2-8, N2-9, N2-11,
 * N2-12, N2-13, V1-1, V2-1.
 *
 * Own `php -S` on :8715 over the mirror (php-mail.ini), the real admin pages
 * through `adminhttp.js`, plus PHP CLI calls into the mirror's config.php.
 * Restores data/, pdfs/, the inquiry log and marks, the audit log and the
 * mirror's uploads in a finally.
 *
 *   node _harness/lowsA2-admin.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const { adminHttp } = require('./adminhttp');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(__dirname, 'site');
const ADMIN = path.join(SITE, 'admin');
const DATA = path.join(SITE, 'data');
const PRISTINE = path.join(__dirname, 'pristine');
const PORT = 8715;
const BASE = `http://127.0.0.1:${PORT}`;
const a = adminHttp(PORT);

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};
const php = (code) => spawnSync('php', ['-r', `$_SERVER['REQUEST_METHOD']='GET'; require ${JSON.stringify(path.join(ADMIN, 'config.php'))}; ${code}`],
  { encoding: 'utf8' }).stdout.trim();
const catalog = () => JSON.parse(fs.readFileSync(path.join(DATA, 'products-all.json'), 'utf8'));
const info = () => JSON.parse(fs.readFileSync(path.join(DATA, 'site-info.json'), 'utf8'));
const restoreData = () => {
  for (const n of ['products-all.json', 'content.json', 'site-info.json']) fs.copyFileSync(path.join(PRISTINE, n), path.join(DATA, n));
  for (const x of fs.readdirSync(DATA)) if (/\.backup\./.test(x)) fs.rmSync(path.join(DATA, x));
};
const backups = () => fs.readdirSync(DATA).filter((x) => /\.backup\./.test(x)).length;
const errorsOf = (html) => [...html.matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map((m) => m[1]).join(' | ');

async function addProduct(sku) {
  const g = await a.req('GET', '/admin/add.php');
  const f = a.formFields(g.body, /name="sku"/);
  const pairs = f.map(([k, v]) => [k, k === 'sku' ? sku : k === 'name' ? `Lows A2 ${sku}` : v]);
  const pt = pairs.find(([k]) => k === 'partType');
  if (pt && pt[1] === '') pt[1] = (/<select id="partType"[\s\S]*?<option value="([^"]+)"/.exec(g.body) || [, 'Accessory'])[1];
  return a.post('/admin/add.php', pairs);
}
async function editProduct(sku, patch, raw = '') {
  const u = `/admin/edit.php?sku=${encodeURIComponent(sku)}`;
  const g = await a.req('GET', u);
  const f = a.formFields(g.body, /name="orig_sig"/);
  const pairs = f.map(([k, v]) => [k, k in patch ? patch[k] : v]);
  const body = pairs.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&') + raw;
  return a.postRaw(u, body);
}
async function saveSettings(patch) {
  const g = await a.req('GET', '/admin/settings.php');
  const f = a.formFields(g.body, /name="company_name"/);
  return a.post('/admin/settings.php', f.map(([k, v]) => [k, k in patch ? patch[k] : v]));
}

// A real PNG (gd), then padding past 3 MB, then a PHP open tag.
function pngWithLateTag() {
  const out = path.join(require('os').tmpdir(), `lowsA2-${process.pid}.png`);
  spawnSync('php', ['-r', `$i=imagecreatetruecolor(40,40); imagepng($i, ${JSON.stringify(out)});`]);
  const png = fs.readFileSync(out);
  fs.rmSync(out, { force: true });
  return Buffer.concat([png, Buffer.alloc(3 * 1024 * 1024, 0x20), Buffer.from('<' + '?php echo 1; ?' + '>')]);
}

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`lowsA2-admin: port ${PORT} is already in use — stop that server first`);
    process.exit(2);
  }
  const keep = {};
  const keepFiles = ['inquiries.jsonl', '.inquiries-seen.json', 'admin-log.jsonl'].map((n) => path.join(ADMIN, n));
  for (const p of keepFiles) keep[p] = fs.existsSync(p) ? fs.readFileSync(p) : null;
  const pdfsBefore = fs.readdirSync(path.join(SITE, 'pdfs'));
  const imgsBefore = fs.readdirSync(path.join(SITE, 'uploads', 'images'));
  restoreData();
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, '-c', path.join(__dirname, 'php-mail.ini'),
    path.join(__dirname, 'router.php')], { cwd: SITE, stdio: 'ignore' });
  try {
    await new Promise((r) => setTimeout(r, 800));
    note(await a.login('audit-pass-123'), 'setup: signed in');

    // ── V2-1 first: needs the untouched shipped data ──
    const bytes0 = fs.readFileSync(path.join(DATA, 'products-all.json'));
    const e0 = await editProduct('CC', {});
    note(e0.status === 302 && fs.readFileSync(path.join(DATA, 'products-all.json')).equals(bytes0) && backups() === 0,
      'V2-1: an unchanged save of a shipped product writes nothing and takes no backup slot', `status ${e0.status}, backups ${backups()}`);
    const s0 = fs.readFileSync(path.join(DATA, 'site-info.json'));
    const r0 = await saveSettings({});
    note(r0.status === 302 && /nochange/.test(r0.headers.location || '') && fs.readFileSync(path.join(DATA, 'site-info.json')).equals(s0),
      'V2-1: an unchanged Business Details save of the shipped file is a no-op', `status ${r0.status} → ${r0.headers.location}`);

    // ── ADM-5 ──
    const r5a = await addProduct('cc');
    note(r5a.status === 200 && /too close to the existing SKU (&quot;|")CC(&quot;|")/.test(r5a.body), 'ADM-5: adding "cc" next to "CC" is refused', errorsOf(r5a.body));
    const r5b = await addProduct('zz test 1/2');
    const r5c = await addProduct('ZZ-TEST-1-2');
    note(r5b.status === 302 && r5c.status === 200 && /too close/.test(r5c.body), 'ADM-5: "ZZ-TEST-1-2" is refused once "zz test 1/2" exists; control: the first one saved',
      `first ${r5b.status}, second ${r5c.status}: ${errorsOf(r5c.body)}`);
    const r5d = await editProduct('CCS', { sku: 'C.C' });
    note(r5d.status === 200 && /too close/.test(r5d.body), 'ADM-5: renaming CCS to "C.C" (the same as CC) is refused', errorsOf(r5d.body));
    restoreData();

    // ── ADM-13 / N1-15 ──
    for (const [field, val, want] of [
      ['company_foundedYear', 'Since 1974', /Founded Year/],
      ['contact_phoneDial', 'call us', /click-to-call/],
      ['theme_logo', 'javascript:alert(1)', /logo URL/],
      ['hours_opens', '8am', /Opens must be/],
      ['hours_days', 'Mon, Tue', /Open Days/],
    ]) {
      const r = await saveSettings({ [field]: val });
      note(r.status === 200 && want.test(r.body) && fs.readFileSync(path.join(DATA, 'site-info.json')).equals(s0),
        `ADM-13: ${field} = "${val}" is refused and nothing is saved`, `status ${r.status}: ${errorsOf(r.body)}`);
    }
    const r13 = await saveSettings({ hours_days: 'monday, Tuesday', company_foundedYear: '1974' });
    note(r13.status === 302 && JSON.stringify(info().hours.days) === '["Monday","Tuesday"]', 'ADM-13: control — valid values save (day names normalised)',
      `status ${r13.status}: ${errorsOf(r13.body)}`);
    const r15 = await saveSettings({ contact_phone: '(312) 555-0199', contact_phoneDial: '' });
    note(r15.status === 302 && info().contact.phoneDial === '+13125550199',
      'N1-15: a blank click-to-call number is worked out from the new phone, not left to dial the old one', `phoneDial ${info().contact.phoneDial}`);
    restoreData();

    // ── N1-16 / N2-4 ──
    const si = info();
    si.hours.days = 'Monday';
    si.certifications.other = 'UL';
    si.theme.primaryColor = '#abc';
    si.theme.darkColor = '';
    fs.writeFileSync(path.join(DATA, 'site-info.json'), JSON.stringify(si, null, 4));
    const g16 = await a.req('GET', '/admin/settings.php');
    note(g16.status === 200 && !/Fatal error|TypeError/.test(g16.body) && /name="company_name"/.test(g16.body),
      'N1-16: Business Details opens when a list field holds a string', (g16.body.match(/Fatal error[^<]{0,150}/) || [''])[0]);
    const colorOf = (id) => (new RegExp(`id="${id}"[^>]*value="([^"]*)"`).exec(g16.body) || [, ''])[1];
    note(colorOf('theme_primary') === '#aabbcc' && colorOf('theme_dark') === '#0d2d52',
      'N2-4: a short hex is expanded and a blank color shows the built-in one (never black)', `primary ${colorOf('theme_primary')}, dark ${colorOf('theme_dark')}`);
    restoreData();

    // ── ADM-14 ──
    const d14 = await a.req('GET', '/admin/delete.php?sku=IP33PO');
    note(/Industries page links to this product/.test(d14.body), 'ADM-14: deleting a product an Industries card links to warns first');
    const d14c = await a.req('GET', '/admin/delete.php?sku=CC');
    note(d14c.status === 200 && !/Industries page links to this product/.test(d14c.body), 'ADM-14: control — a product no card links to gets no warning');
    const e14 = await editProduct('IP56DR', { sku: 'IP56DRX' });
    const i14 = await a.req('GET', '/admin/index.php');
    note(e14.status === 302 && /Industries page links to the old SKU/.test(i14.body), 'ADM-14: renaming one says which Industries links now break');
    restoreData();

    // ── N2-3 ── a save that fails AFTER the data sheet was renamed
    fs.copyFileSync(path.join(ROOT, 'pdfs', 'CC.pdf'), path.join(SITE, 'pdfs', 'CC.pdf'));
    const e3 = await editProduct('CC', { sku: 'CCRENAMED3' }, '&caption=%FF%FE');   // invalid UTF-8: json_encode fails
    const ccThere = fs.existsSync(path.join(SITE, 'pdfs', 'CC.pdf'));
    const newThere = fs.existsSync(path.join(SITE, 'pdfs', 'CCRENAMED3.pdf'));
    note(e3.status === 200 && /Failed to save/.test(e3.body), 'N2-3: setup — the save really failed');
    note(ccThere && !newThere, 'N2-3: the data sheet is put back under the name the catalog still uses',
      `CC.pdf ${ccThere ? 'present' : 'MISSING'}, CCRENAMED3.pdf ${newThere ? 'present' : 'absent'}`);
    restoreData();

    // ── N2-13 ──
    const e13 = await editProduct('CC', { name: '0', description: 'first\n0\nlast' });
    const cc = catalog().find((p) => p.sku === 'CC');
    note(e13.status === 302 && cc.name === '0' && (cc.description || []).includes('0'),
      'N2-13: a name of "0" saves on edit, and a description line "0" is kept', `status ${e13.status}; ${JSON.stringify(cc && cc.description)}`);
    restoreData();

    // ── N2-8 / N2-9 (CLI + page) ──
    const INQ = path.join(ADMIN, 'inquiries.jsonl');
    const line = (type) => JSON.stringify({ ts: new Date().toISOString(), type, name: 'x', email: 'x@example.com', sent: true }) + '\n';
    fs.writeFileSync(INQ, line('rfq') + line('message'));
    php('inquiries_mark_seen(2);');
    fs.appendFileSync(INQ, line('honeypot') + line('rate-limited') + line('blocked-referer') + line('rfq'));
    note(php('echo inquiries_new_count();') === '1', 'N2-8: the "new" count ignores submissions blocked as spam (3 blocked + 1 lead → 1)',
      `count ${php('echo inquiries_new_count();')}`);
    const nav = await a.req('GET', '/admin/index.php');
    note(/class="nav-badge"[^>]*>1</.test(nav.body), 'N2-8: and the nav badge shows 1');
    // Rotation: a NEW file that has grown past the old mark.
    php('inquiries_mark_seen(6);');
    fs.writeFileSync(INQ, Array.from({ length: 25 }, () => line('rfq')).join(''));
    note(php('echo inquiries_new_count();') === '25', 'N2-9: after a rotation every lead in the new log counts (25, not the bytes past the old mark)',
      `count ${php('echo inquiries_new_count();')}`);

    // ── N2-11 ──
    const LOG = path.join(ADMIN, 'admin-log.jsonl');
    const arch = path.join(ADMIN, 'admin-log-2020-01-01-000000.jsonl');
    fs.writeFileSync(arch, JSON.stringify({ ts: '2020-01-01 00:00:00', action: 'edit', sku: 'ARCHIVEDSKU1', detail: 'old' }) + '\n');
    fs.writeFileSync(LOG, Array.from({ length: 30 }, (_, i) => JSON.stringify({ ts: '2026-01-01 00:00:00', action: 'login', sku: 'admin', detail: `n${i}` })).join('\n') + '\n');
    const l1 = await a.req('GET', '/admin/audit-log.php?sku=ARCHIVEDSKU1');
    note(/ARCHIVEDSKU1/.test(l1.body.replace(/value="ARCHIVEDSKU1"/g, '')), 'N2-11: a filter finds an entry that is only in a rotated archive');
    const l2 = await a.req('GET', '/admin/audit-log.php?sku=NOTHINGMATCHES');
    note(!/Showing the most recent/.test(l2.body), 'N2-11: "Showing the most recent 500" is not claimed when nothing is shown');
    fs.rmSync(arch, { force: true });

    // ── N2-12 (CLI) ──
    const stamp = php("echo date('Ymd-His', time() + 3600);");   // PHP's timezone, not Node's
    fs.writeFileSync(path.join(DATA, `products-all.backup.${stamp}.json`), '[]');
    // Ordered by backup_list() — a plain string compare is exactly the wrong
    // order invariant 5 is about ("-01" sorts before ".json").
    const newest = php(`$p = backup_path(${JSON.stringify(DATA)}, 'products-all'); file_put_contents($p, '[]'); $l = backup_list(${JSON.stringify(DATA)}, 'products-all'); echo basename(end($l)) === basename($p) ? 'newest' : basename(end($l));`);
    note(newest === 'newest', 'N2-12: a backup made while the clock reads earlier than the newest one still sorts after it', newest);
    restoreData();

    // ── V1-1 ──
    const png = pngWithLateTag();
    const g1 = await a.req('GET', '/admin/upload-image.php?sku=CC');
    const b = '----lowsA2' + Date.now();
    const body = Buffer.concat([
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n${a.csrfOf(g1.body)}\r\n`),
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="image_file"; filename="late.png"\r\nContent-Type: image/png\r\n\r\n`),
      png, Buffer.from(`\r\n--${b}--\r\n`),
    ]);
    const u1 = await a.req('POST', '/admin/upload-image.php?sku=CC', body, { 'Content-Type': `multipart/form-data; boundary=${b}` });
    const landed = fs.readdirSync(path.join(SITE, 'uploads', 'images')).filter((x) => !imgsBefore.includes(x));
    note(landed.length === 0 && /program code|not a usable image|cannot be opened/i.test(u1.body),
      'V1-1: a PHP tag 3 MB into a valid PNG is found and the upload refused', `landed ${landed.join(', ') || 'none'}; ${errorsOf(u1.body).slice(0, 160)}`);
  } finally {
    srv.kill();
    restoreData();
    for (const p of keepFiles) { if (keep[p] === null) fs.rmSync(p, { force: true }); else fs.writeFileSync(p, keep[p]); }
    for (const x of fs.readdirSync(path.join(SITE, 'pdfs'))) if (!pdfsBefore.includes(x)) fs.rmSync(path.join(SITE, 'pdfs', x));
    for (const x of pdfsBefore) if (!fs.existsSync(path.join(SITE, 'pdfs', x))) fs.copyFileSync(path.join(ROOT, 'pdfs', x), path.join(SITE, 'pdfs', x));
    for (const x of fs.readdirSync(path.join(SITE, 'uploads', 'images'))) if (!imgsBefore.includes(x)) fs.rmSync(path.join(SITE, 'uploads', 'images', x), { force: true, recursive: true });
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nlowsA2-admin ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
