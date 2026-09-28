/**
 * Lows batch E — the .htaccess files, on REAL Apache 2.4 + mod_ssl + mod_php:
 * PUB-1 (+ NEW-V3-1), PUB-10, PUB-11, NEW-N3-6 (audit-runs/audit-2026-09-27.md).
 * `php -S` ignores .htaccess, so none of this is visible to the rest of the
 * harness.
 *
 * One Apache instance, two listeners: plain HTTP on :8731 and HTTPS on :8732
 * with a throwaway self-signed certificate. The docroot is dist/ plus the
 * repo's admin/, uploads/, pdfs/ and data/ .htaccess files, built under
 * /var/tmp (the Apache user cannot traverse /tmp/claude-0). 14 checks:
 *   PUB-1   HSTS is sent over HTTPS on /, on a rewritten SPA route and on
 *           /admin/; not over plain HTTP; sent over HTTP when a TLS-terminating
 *           proxy says X-Forwarded-Proto: https; never with includeSubDomains
 *   V3-1    a client-sent "HTTPS: on" header over plain HTTP gets no HSTS
 *   PUB-10  uploaded photos and data sheets are revalidated (no-cache), not
 *           cached for a day / heuristically
 *   PUB-11  a missing file under /pdfs, /uploads, /images or /data, and a
 *           missing /favicon.ico, is a real 404 — not the SPA shell with a 200;
 *           control: an SPA route still gets the shell
 *   N3-6    the LimitExcept comments no longer imply they stop TRACE
 *
 *   node _harness/lowsE-apache.js              # the working tree
 *   LOWSE_REF=origin/main node _harness/lowsE-apache.js   # .htaccess from a ref
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const APACHE = '/usr/sbin/apache2';
const MODS = '/usr/lib/apache2/modules';
const libphp = fs.existsSync(MODS) && fs.readdirSync(MODS).find((f) => /^libphp[0-9.]*\.so$/.test(f));
if (!fs.existsSync(APACHE) || !libphp || !fs.existsSync(path.join(MODS, 'mod_ssl.so'))) {
  console.log('lowsE-apache SKIPPED — needs apache2, mod_ssl and libapache2-mod-php');
  process.exit(3);
}
const REF = process.env.LOWSE_REF || '';
const src = (rel) => (REF
  ? spawnSync('git', ['show', `${REF}:${rel}`], { cwd: ROOT, encoding: 'utf8' }).stdout
  : fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const HTTP = 8731;
const HTTPS = 8732;
const WORK = `/var/tmp/ipc-lowsE-${process.pid}`;
const PUB = path.join(WORK, 'public_html');

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

function head(url, extra = []) {
  const r = spawnSync('curl', ['-s', '-k', '--noproxy', '*', '--max-time', '10', '-o', '/dev/null', '-D', '-', ...extra, url], { encoding: 'latin1' });
  const text = r.stdout || '';
  const status = +((/^HTTP\/\S+\s+(\d+)/m.exec(text) || [])[1] || 0);
  const h = (name) => ((new RegExp(`^${name}:\\s*(.*)$`, 'mi').exec(text) || [])[1] || '').trim();
  return { status, h, text };
}

let conf = null;
try {
  // ── docroot ──
  fs.mkdirSync(PUB, { recursive: true });
  spawnSync('cp', ['-r', path.join(ROOT, 'dist') + '/.', PUB]);   // path.join would drop the '/.'
  fs.writeFileSync(path.join(PUB, '.htaccess'), src('public/.htaccess'));
  for (const d of ['admin', 'uploads', 'uploads/images', 'pdfs', 'data', 'images']) fs.mkdirSync(path.join(PUB, d), { recursive: true });
  fs.writeFileSync(path.join(PUB, 'admin', '.htaccess'), src('admin/.htaccess'));
  fs.writeFileSync(path.join(PUB, 'admin', 'index.php'), '<?php echo "admin";');
  fs.writeFileSync(path.join(PUB, 'uploads', '.htaccess'), src('uploads/.htaccess'));
  fs.writeFileSync(path.join(PUB, 'pdfs', '.htaccess'), src('pdfs/.htaccess'));
  fs.writeFileSync(path.join(PUB, 'data', '.htaccess'), src('data/.htaccess'));
  fs.copyFileSync(path.join(ROOT, 'data', 'products-all.json'), path.join(PUB, 'data', 'products-all.json'));
  fs.writeFileSync(path.join(PUB, 'uploads', 'images', 'CC.png'), Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4540000000049454e44ae426082', 'hex'));
  fs.writeFileSync(path.join(PUB, 'pdfs', 'CC.pdf'), '%PDF-1.4\n%%EOF\n');
  fs.rmSync(path.join(PUB, 'favicon.ico'), { force: true });
  spawnSync('chmod', ['-R', 'a+rX', WORK]);

  // ── certificate ──
  const key = path.join(WORK, 'k.pem');
  const crt = path.join(WORK, 'c.pem');
  spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt, '-days', '1', '-subj', '/CN=127.0.0.1'], { stdio: 'ignore' });

  // ── Apache ──
  fs.mkdirSync(path.join(WORK, 'logs'), { recursive: true });
  const mods = ['mpm_prefork', 'authz_core', 'authz_host', 'access_compat', 'mime', 'headers', 'setenvif', 'dir', 'alias', 'rewrite', 'socache_shmcb', 'ssl']
    .map((m) => `LoadModule ${m}_module ${MODS}/mod_${m}.so`).join('\n');
  conf = path.join(WORK, 'httpd.conf');
  fs.writeFileSync(conf, `ServerRoot /etc/apache2
ServerName 127.0.0.1
PidFile ${WORK}/httpd.pid
Listen 127.0.0.1:${HTTP}
Listen 127.0.0.1:${HTTPS}
${mods}
LoadModule php_module ${MODS}/${libphp}
TypesConfig /etc/mime.types
User www-data
Group www-data
ErrorLog ${WORK}/logs/error.log
<FilesMatch "\\.php$">
  SetHandler application/x-httpd-php
</FilesMatch>
DirectoryIndex index.php index.html
DocumentRoot ${PUB}
<Directory ${PUB}>
  AllowOverride All
  Require all granted
</Directory>
<VirtualHost 127.0.0.1:${HTTPS}>
  SSLEngine on
  SSLCertificateFile ${crt}
  SSLCertificateKeyFile ${key}
</VirtualHost>
`);
  const st = spawnSync(APACHE, ['-f', conf, '-k', 'start'], { encoding: 'utf8' });
  if (st.status !== 0) throw new Error('apache did not start: ' + st.stderr);
  spawnSync('sleep', ['1']);

  const S = `https://127.0.0.1:${HTTPS}`;
  const P = `http://127.0.0.1:${HTTP}`;

  // ── PUB-1 / V3-1 ──
  for (const [label, url] of [['/', `${S}/`], ['a rewritten SPA route', `${S}/products`], ['/admin/', `${S}/admin/`]]) {
    const r = head(url);
    note(/max-age=\d+/.test(r.h('Strict-Transport-Security')), `PUB-1: HSTS is sent over HTTPS on ${label}`, `status ${r.status}, HSTS "${r.h('Strict-Transport-Security')}"`);
  }
  const plain = head(`${P}/`, ['-H', 'X-Forwarded-Proto: http']);
  note(plain.h('Strict-Transport-Security') === '', 'PUB-1: no HSTS over plain HTTP (control)', plain.h('Strict-Transport-Security'));
  const proxied = head(`${P}/products`, ['-H', 'X-Forwarded-Proto: https']);
  note(/max-age=\d+/.test(proxied.h('Strict-Transport-Security')), 'PUB-1: HSTS is sent behind a TLS-terminating proxy (X-Forwarded-Proto: https)', `status ${proxied.status}`);
  const spoof = head(`${P}/`, ['-H', 'HTTPS: on', '-H', 'X-Forwarded-Proto: http']);
  note(spoof.h('Strict-Transport-Security') === '', 'V3-1: a client-sent "HTTPS: on" header over plain HTTP does not earn HSTS', spoof.h('Strict-Transport-Security'));
  // Includes the proxied response: on unfixed files the HTTPS responses send
  // no HSTS at all, and "no includeSubDomains" passed on nothing.
  const anyHsts = [head(`${S}/`).h('Strict-Transport-Security'), head(`${S}/admin/`).h('Strict-Transport-Security'),
    proxied.h('Strict-Transport-Security')].join(' | ');
  note(/max-age/.test(anyHsts) && !/includeSubDomains/i.test(anyHsts), 'PUB-1: HSTS does not claim includeSubDomains (subdomain TLS is unverified)', anyHsts);

  // ── PUB-10 ──
  const img = head(`${S}/uploads/images/CC.png`);
  note(img.status === 200 && /no-cache/.test(img.h('Cache-Control')), 'PUB-10: an uploaded photo is revalidated on every use (no-cache), not cached for a day', `status ${img.status}, Cache-Control "${img.h('Cache-Control')}"`);
  const pdf = head(`${S}/pdfs/CC.pdf`);
  note(pdf.status === 200 && /no-cache/.test(pdf.h('Cache-Control')), 'PUB-10: a data sheet is revalidated on every use (was: no Cache-Control at all)', `status ${pdf.status}, Cache-Control "${pdf.h('Cache-Control')}"`);

  // ── PUB-11 ──
  const missing = ['/pdfs/nope.pdf', '/uploads/images/nope.png', '/images/nope.jpg', '/data/nope.json', '/favicon.ico'];
  const shells = missing.map((u) => [u, head(`${S}${u}`)]).filter(([, r]) => r.status !== 404).map(([u, r]) => `${u} ${r.status} ${r.h('Content-Type')}`);
  note(shells.length === 0, 'PUB-11: a missing data sheet, photo, image, data file or favicon is a real 404, not the site shell', shells.join(' | '));
  const route = head(`${S}/products`);
  note(route.status === 200 && /text\/html/.test(route.h('Content-Type')), 'PUB-11: control — an SPA route still gets the shell (200 text/html)', `${route.status} ${route.h('Content-Type')}`);

  // ── N3-6 ──
  const over = ['admin/.htaccess', 'data/.htaccess', 'pdfs/.htaccess'].filter((f) => {
    const t = src(f);
    const i = t.indexOf('<LimitExcept');
    return !/TRACE/.test(t.slice(Math.max(0, i - 700), i));
  });
  note(over.length === 0, 'N3-6: every LimitExcept block says it does NOT stop TRACE (a server setting does)', `silent in: ${over.join(', ')}`);
} catch (e) {
  note(false, 'the harness ran', String(e && e.message || e));
} finally {
  if (conf) spawnSync(APACHE, ['-f', conf, '-k', 'stop']);
  spawnSync('sleep', ['1']);
  if (!process.env.LOWSE_KEEP) fs.rmSync(WORK, { recursive: true, force: true });
}
const bad = results.filter((r) => !r.ok).length;
console.log(`\nlowsE-apache ${results.length - bad}/${results.length}${REF ? ` (.htaccess from ${REF})` : ''}`);
process.exit(bad === 0 ? 0 : 1);
