/**
 * Lows batch A1 — the admin security Lows of audit-runs/audit-2026-09-27.md
 * (§2, verified in §6): SEC-6, 8, 9, 10, 11, 12 (= ADM-15), 13, 14, 16.
 *
 * Own `php -S` on :8712 over the mirror (php-mail.ini), a cookie-jar HTTP
 * client, plus PHP CLI calls into the mirror's own config.php. 21 checks:
 *   SEC-6   IPv6 addresses in one /64 share a throttle record (6 free
 *           attempts across ::1..::6, the 7th from ::7 is refused); control:
 *           another /64 is untouched. A throttle file of 20,000 records is cut
 *           to the cap on the next write.
 *   SEC-8   an extra-PDF link of //evil… or /\evil… is refused; control: a
 *           normal /pdfs/… link still saves
 *   SEC-9   index.php?msg=…&type=error renders nothing; control: a real
 *           redirect message ("Product not found") still shows once
 *   SEC-10  a cross-site GET of Inquiries does not mark leads seen; control:
 *           a same-origin GET does
 *   SEC-11  a lead's email "a?cc=…" cannot add a CC to the reply mailto:
 *   SEC-12  pdf_file[] / image_file[] give a message, never a fatal
 *   SEC-13  a future-dated ALLOW-PASSWORD-RESET does not open the reset form;
 *           control: a fresh one does
 *   B4      GO-LIVE B4 end to end (AUDIT-12 A12-L13-W5-G4-1): with NO
 *           config.local.php and a fresh flag, an anonymous Set Admin Password
 *           submit writes config.local.php as PHP, deletes the flag, signs
 *           that browser in with no hash on the page, and the new password
 *           signs in from a fresh browser
 *   SEC-14  a password longer than bcrypt's 72 bytes is refused
 *   SEC-16  admin/.htaccess's CSP carries form-action 'self' (source check —
 *           php -S ignores .htaccess)
 * Restores the catalog, inquiry log, seen mark, throttle file, flag and the
 * mirror's config.local.php (deleting any .bak the run caused).
 *
 *   node _harness/lowsA1-sec.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn, spawnSync, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(__dirname, 'site');
const ADMIN = path.join(SITE, 'admin');
const CONFIG = path.join(ADMIN, 'config.php');
const PRISTINE = path.join(__dirname, 'pristine');
const PORT = 8712;
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'audit-pass-123';

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

/* ---------------------------------------------------------------- http */
const jar = new Map();
function req(method, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ method, host: '127.0.0.1', port: PORT, path: p, timeout: 20000,
      headers: { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        for (const sc of res.headers['set-cookie'] || []) {
          const [kv] = sc.split(';'); const i = kv.indexOf('=');
          jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
        }
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}
const enc = (pairs) => pairs.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
const post = (p, pairs, headers = {}) => req('POST', p, enc(pairs), { 'Content-Type': 'application/x-www-form-urlencoded', ...headers });
const csrfOf = (html) => (/name="csrf_token"\s+value="([^"]*)"/.exec(html) || [, ''])[1];
// Every named control of the form containing `marker`, as [name, value] pairs.
function formFields(html, marker) {
  const forms = html.split(/<form\b/i).slice(1).map((f) => f.split(/<\/form>/i)[0]);
  const f = forms.find((x) => marker.test(x));
  if (!f) return null;
  const out = [];
  for (const m of f.matchAll(/<input\b[^>]*>/gi)) {
    const t = m[0];
    const name = (/\bname="([^"]*)"/.exec(t) || [])[1];
    if (!name) continue;
    const type = ((/\btype="([^"]*)"/.exec(t) || [])[1] || 'text').toLowerCase();
    if (['submit', 'button', 'file'].includes(type)) continue;
    if ((type === 'checkbox' || type === 'radio') && !/\bchecked\b/.test(t)) continue;
    const dec = (s) => s.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    out.push([name, dec((/\bvalue="([^"]*)"/.exec(t) || [, ''])[1])]);
  }
  for (const m of f.matchAll(/<textarea\b[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/textarea>/gi)) {
    out.push([m[1], m[2].replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')]);
  }
  for (const m of f.matchAll(/<select\b[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/select>/gi)) {
    const sel = /<option\b[^>]*\bselected\b[^>]*value="([^"]*)"|<option\b[^>]*value="([^"]*)"[^>]*\bselected\b/i.exec(m[2]);
    out.push([m[1], sel ? (sel[1] ?? sel[2]) : '']);
  }
  return out;
}
async function login() {
  const g = await req('GET', '/admin/auth.php');
  const r = await post('/admin/auth.php', [['password', PASSWORD], ['csrf_token', csrfOf(g.body)]]);
  return r.status === 302;
}
const php = (code) => spawnSync('php', ['-r', `$_SERVER['REQUEST_METHOD']='GET'; require ${JSON.stringify(CONFIG)}; ${code}`],
  { encoding: 'utf8' }).stdout.trim();

/* --------------------------------------------------------------- state */
const keep = {};
const saveFile = (p) => { keep[p] = fs.existsSync(p) ? fs.readFileSync(p) : null; };
const restoreFile = (p) => { if (keep[p] === null) fs.rmSync(p, { force: true }); else fs.writeFileSync(p, keep[p]); };
const THROTTLE = path.join(ADMIN, '.login-throttle.json');
const INQ = path.join(ADMIN, 'inquiries.jsonl');
const SEEN = path.join(ADMIN, '.inquiries-seen.json');
const FLAG = path.join(ADMIN, 'ALLOW-PASSWORD-RESET');
const LOCAL = path.join(ADMIN, 'config.local.php');
const CATALOG = path.join(SITE, 'data', 'products-all.json');

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`lowsA1-sec: port ${PORT} is already in use — stop that server first`);
    process.exit(2);
  }
  [THROTTLE, INQ, SEEN, FLAG, LOCAL].forEach(saveFile);
  const baksBefore = new Set(fs.readdirSync(ADMIN).filter((f) => f.startsWith('config.local.php.bak.')));
  fs.copyFileSync(path.join(PRISTINE, 'products-all.json'), CATALOG);
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, '-c', path.join(__dirname, 'php-mail.ini'),
    path.join(__dirname, 'router.php')], { cwd: SITE, stdio: 'ignore' });
  try {
    await new Promise((r) => setTimeout(r, 800));

    // ── SEC-6 (CLI) ──
    fs.rmSync(THROTTLE, { force: true });
    const waits = php(`$o=[]; for($i=1;$i<=7;$i++){ $o[]=login_attempt_gate("2001:db8:1:2::$i"); } $o[]=login_attempt_gate("2001:db8:9:9::1"); echo json_encode($o);`);
    let w = [];
    try { w = JSON.parse(waits); } catch { /* stays [] */ }
    note(w.length === 8 && w[6] > 0, 'SEC-6: the 7th attempt from another address in the same IPv6 /64 is refused', `waits ${waits}`);
    note(w.length === 8 && w[7] === 0, 'SEC-6: control — a different /64 is not affected', `waits ${waits}`);
    const big = {};
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < 20000; i++) big[`10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`] = { c: 1, t: now, r: 0 };
    fs.writeFileSync(THROTTLE, JSON.stringify(big));
    php('login_attempt_gate("192.0.2.1");');
    const after = Object.keys(JSON.parse(fs.readFileSync(THROTTLE, 'utf8'))).length;
    note(after <= 5001, 'SEC-6: a 20,000-record throttle file is cut to the cap on the next write', `${after} records`);
    fs.rmSync(THROTTLE, { force: true });

    note(await login(), 'setup: signed in to the mirror admin');

    // ── SEC-8 ──
    const sku = JSON.parse(fs.readFileSync(CATALOG, 'utf8'))[0].sku;
    const editUrl = `/admin/edit.php?sku=${encodeURIComponent(sku)}`;
    const tryPdf = async (link) => {
      const g = await req('GET', editUrl);
      const f = formFields(g.body, /name="orig_sig"/);
      if (!f) return { status: 0, body: 'no form' };
      const pairs = f.filter(([k]) => k !== 'additionalPdfs').concat([['additionalPdfs', `${link} | Sheet`]]);
      return post(editUrl, pairs);
    };
    for (const bad of ['//evil.example/x.pdf', '/\\evil.example/x.pdf']) {
      const r = await tryPdf(bad);
      const stored = JSON.parse(fs.readFileSync(CATALOG, 'utf8')).find((p) => p.sku === sku);
      note(r.status === 200 && !(stored.additionalPdfs || []).some((a) => a.url === bad),
        `SEC-8: an extra-PDF link of ${bad} is refused`, `status ${r.status}; stored ${JSON.stringify(stored.additionalPdfs)}`);
    }
    const okr = await tryPdf('/pdfs/SEC8-control.pdf');
    const stored = JSON.parse(fs.readFileSync(CATALOG, 'utf8')).find((p) => p.sku === sku);
    note(okr.status === 302 && (stored.additionalPdfs || []).some((a) => a.url === '/pdfs/SEC8-control.pdf'),
      'SEC-8: control — a normal /pdfs/ link still saves', `status ${okr.status}`);
    fs.copyFileSync(path.join(PRISTINE, 'products-all.json'), CATALOG);

    // ── SEC-9 ──
    const fake = 'Session expired: call 555-0100 to re-activate';
    const r9 = await req('GET', `/admin/index.php?msg=${encodeURIComponent(fake)}&type=error`);
    note(!r9.body.includes('555-0100'), 'SEC-9: a message typed into the URL is not rendered as an admin alert');
    await req('GET', '/admin/edit.php?sku=NO-SUCH-SKU-SEC9');
    const r9b = await req('GET', '/admin/index.php');
    const r9c = await req('GET', '/admin/index.php');
    note(/Product not found/.test(r9b.body) && !/Product not found/.test(r9c.body),
      'SEC-9: control — a real redirect message shows once, then is gone');

    // ── SEC-10 / SEC-11 ──
    const lead = { ts: new Date().toISOString(), type: 'rfq', name: 'Lows A1', email: 'lead?cc=attacker@evil.example&bcc=x@evil.example',
      subject: 'x', message: 'x', mailed: true };
    fs.writeFileSync(INQ, (keep[INQ] ? keep[INQ].toString() : '') + JSON.stringify(lead) + '\n');
    fs.writeFileSync(SEEN, JSON.stringify({ seen: 0, size: 0, ts: 'x' }));
    const seenOf = () => { try { return JSON.parse(fs.readFileSync(SEEN, 'utf8')).seen; } catch { return null; } };
    await req('GET', '/admin/inquiries.php', null, { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate' });
    note(seenOf() === 0, 'SEC-10: a cross-site GET of Inquiries does not mark the leads seen', `seen now ${seenOf()}`);
    const r10 = await req('GET', '/admin/inquiries.php', null, { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'navigate' });
    note(seenOf() > 0, 'SEC-10: control — a same-origin GET does', `seen now ${seenOf()}`);
    const hrefs = [...r10.body.matchAll(/href="(mailto:[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
    const leadHref = hrefs.find((h) => /lead/.test(h)) || '';
    note(leadHref !== '' && !/[?&](cc|bcc)=/i.test(leadHref), 'SEC-11: the lead\'s address cannot add a CC or BCC to the reply', `href ${leadHref}`);

    // ── SEC-12 ──
    for (const [page, field] of [['upload-pdf.php', 'pdf_file[]'], ['upload-image.php', 'image_file[]']]) {
      const g = await req('GET', `/admin/${page}?sku=${encodeURIComponent(sku)}`);
      const b = '----lowsA1' + Date.now();
      const body = Buffer.concat([
        Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n${csrfOf(g.body)}\r\n`),
        Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${field}"; filename="a.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4\r\n--${b}--\r\n`),
      ]);
      const r = await req('POST', `/admin/${page}?sku=${encodeURIComponent(sku)}`, body, { 'Content-Type': `multipart/form-data; boundary=${b}` });
      note(r.status === 200 && !/Fatal error|TypeError|Array to string/i.test(r.body) && /one (file|PDF|image|photo)/i.test(r.body),
        `SEC-12: ${field} on ${page} gets a message, not a fatal`, `status ${r.status}; ${(r.body.match(/Fatal error[^<]{0,120}|TypeError[^<]{0,120}/) || [''])[0]}`);
    }

    // ── SEC-13 ──
    fs.writeFileSync(FLAG, '');
    const future = new Date(Date.now() + 86400 * 1000);
    fs.utimesSync(FLAG, future, future);
    // Both requests anonymous: signed in, auth.php redirects before it ever
    // decides about the reset form, and the first check passed on unfixed
    // code for that reason alone.
    const jarCopy = new Map(jar); jar.clear();
    const r13 = await req('GET', '/admin/auth.php');
    note(!/name="set_password"/.test(r13.body), 'SEC-13: a future-dated ALLOW-PASSWORD-RESET does not open the reset form');
    fs.utimesSync(FLAG, new Date(), new Date());
    jar.clear();
    const r13b = await req('GET', '/admin/auth.php');
    jar.clear(); jarCopy.forEach((v, k) => jar.set(k, v));
    note(/name="set_password"/.test(r13b.body), 'SEC-13: control — a freshly uploaded flag does');
    fs.rmSync(FLAG, { force: true });

    // ── GO-LIVE B4: Set Admin Password, end to end, from day one ──
    // Nothing submitted this form before: the census found set_password only
    // as a presence regex above, so the reset handler and the create-file
    // branch of admin_password_write() (taken only when config.local.php does
    // not exist yet) could break with every suite green (AUDIT-12
    // A12-L13-W5-G4-1). No config.local.php, a fresh flag, an anonymous visitor.
    {
      const NEWPW = 'day-one-password-4417';
      fs.rmSync(LOCAL, { force: true });
      fs.writeFileSync(FLAG, '');
      jar.clear();
      const g = await req('GET', '/admin/auth.php');
      const r = await post('/admin/auth.php', [['new_password', NEWPW], ['confirm_password', NEWPW], ['set_password', '1'], ['csrf_token', csrfOf(g.body)]]);
      const written = fs.existsSync(LOCAL) ? fs.readFileSync(LOCAL, 'utf8') : '';
      note(r.status === 302 && /index\.php/.test(r.headers.location || '') && /^<\?php\b/.test(written) && /ADMIN_PASSWORD_HASH/.test(written) && !fs.existsSync(FLAG),
        'B4: Set Admin Password writes config.local.php as PHP, deletes the flag and redirects to the dashboard',
        `status ${r.status} ${r.headers.location || ''}; config.local.php ${written ? JSON.stringify(written.slice(0, 12)) : 'MISSING'}; flag ${fs.existsSync(FLAG) ? 'still there' : 'gone'}`);
      const d = await req('GET', '/admin/index.php');
      note(d.status === 200 && !/\$2y\$/.test(d.body), 'B4: and the browser that set it is signed in, with no hash printed on the page', `status ${d.status}`);
      jar.clear();
      const g2 = await req('GET', '/admin/auth.php');
      const li = await post('/admin/auth.php', [['password', NEWPW], ['csrf_token', csrfOf(g2.body)]]);
      note(li.status === 302 && !/\$2y\$/.test(li.body), 'B4: the new password signs in from a fresh browser', `status ${li.status}`);
      restoreFile(LOCAL);
      fs.rmSync(FLAG, { force: true });
      jar.clear();
      if (!(await login())) throw new Error('could not sign back in with the harness password after B4');
    }

    // ── SEC-14 (CLI) ──
    const long = 'a'.repeat(73);
    const p14 = php(`echo json_encode(admin_password_problems(${JSON.stringify(long)}, ${JSON.stringify(long)}, false));`);
    note(/72/.test(p14), 'SEC-14: a 73-byte password is refused, naming the 72-byte limit', p14);

    // ── SEC-16 ──
    const ht = fs.readFileSync(path.join(ROOT, 'admin', '.htaccess'), 'utf8');
    note(/Content-Security-Policy "[^"]*form-action 'self'/.test(ht), "SEC-16: the admin CSP carries form-action 'self'");
  } finally {
    srv.kill();
    [THROTTLE, INQ, SEEN, FLAG, LOCAL].forEach(restoreFile);
    for (const f of fs.readdirSync(ADMIN)) if (f.startsWith('config.local.php.bak.') && !baksBefore.has(f)) fs.rmSync(path.join(ADMIN, f), { force: true });
    fs.copyFileSync(path.join(PRISTINE, 'products-all.json'), CATALOG);
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nlowsA1-sec ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
