/**
 * A-5.10 / WHATS_LEFT §1ar — the front controller on REAL Apache 2.4 + mod_php.
 * `php -S` ignores .htaccess, so `_harness/prerender.js` proves index.php and
 * this proves the two .htaccess lines that route traffic to it.
 *
 * The vhost says `DirectoryIndex index.html` — Apache's stock value — so the
 * homepage check only passes if public/.htaccess's own DirectoryIndex is read.
 *
 *   /                      served by index.php (raw HTML carries its canonical)
 *   /products?productId=CC the product's title, share photo and canonical; 200, no-store
 *   /about?utm_source=x    REQUEST_URI survives the internal rewrite: About's head, not home's
 *   /products/CC/extra     noindex, no canonical, still 200 (A5)
 *   /index.html            the static file, untouched (no canonical — the browser adds it)
 *   /assets/nope.js        still a real 404 (audit5 Low), not the shell
 *   /sitemap.xml           still the generated sitemap
 *   damaged content.json   index.html byte for byte, 200
 *
 *   npm run build && node _harness/prerender-apache.js
 *   PRE_REF=origin/main node _harness/prerender-apache.js   # .htaccess from a ref (the before)
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const APACHE = '/usr/sbin/apache2';
const MODS = '/usr/lib/apache2/modules';
const libphp = fs.existsSync(MODS) && fs.readdirSync(MODS).find((f) => /^libphp[0-9.]*\.so$/.test(f));
if (!fs.existsSync(APACHE) || !libphp) {
  console.log('prerender-apache SKIPPED — needs apache2 and libapache2-mod-php');
  process.exit(3);
}
const REF = process.env.PRE_REF || '';
const src = (rel) => (REF
  ? spawnSync('git', ['show', `${REF}:${rel}`], { cwd: ROOT, encoding: 'utf8' }).stdout
  : fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const PORT = 8749;
const WORK = `/var/tmp/ipc-prerender-${process.pid}`;
const PUB = path.join(WORK, 'public_html');
// Plain HTTP with X-Forwarded-Proto: https — the TLS-terminating-proxy topology
// public/.htaccess already supports, so its HTTPS redirect stays out of the way.
const B = `http://127.0.0.1:${PORT}`;

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};
function get(url) {
  const r = spawnSync('curl', ['-s', '--noproxy', '*', '--max-time', '10', '-H', 'X-Forwarded-Proto: https', '-D', '-', url], { encoding: 'utf8' });
  const text = r.stdout || '';
  const cut = text.indexOf('\r\n\r\n');
  const hdr = text.slice(0, cut);
  const status = +((/^HTTP\/\S+\s+(\d+)/m.exec(hdr) || [])[1] || 0);
  const h = (name) => ((new RegExp(`^${name}:\\s*(.*)$`, 'mi').exec(hdr) || [])[1] || '').trim();
  return { status, h, body: text.slice(cut + 4) };
}
const tag = (body, re) => ((re.exec(body) || [])[1] || null);
const canonical = (b) => tag(b, /<link rel="canonical" href="([^"]*)"/);
const title = (b) => tag(b, /<title>([^<]*)<\/title>/);

let conf = null;
try {
  fs.mkdirSync(PUB, { recursive: true });
  spawnSync('cp', ['-r', path.join(ROOT, 'dist') + '/.', PUB]);
  fs.writeFileSync(path.join(PUB, '.htaccess'), src('public/.htaccess'));
  fs.mkdirSync(path.join(PUB, 'data'), { recursive: true });
  fs.writeFileSync(path.join(PUB, 'data', '.htaccess'), src('data/.htaccess'));
  for (const f of ['products-all.json', 'site-info.json', 'content.json']) fs.copyFileSync(path.join(ROOT, 'data', f), path.join(PUB, 'data', f));
  spawnSync('chmod', ['-R', 'a+rX', WORK]);
  fs.mkdirSync(path.join(WORK, 'logs'), { recursive: true });
  const mods = ['mpm_prefork', 'authz_core', 'authz_host', 'access_compat', 'mime', 'headers', 'setenvif', 'dir', 'alias', 'rewrite', 'deflate', 'filter']
    .map((m) => `LoadModule ${m}_module ${MODS}/mod_${m}.so`).join('\n');
  conf = path.join(WORK, 'httpd.conf');
  fs.writeFileSync(conf, `ServerRoot /etc/apache2
ServerName 127.0.0.1
PidFile ${WORK}/httpd.pid
Listen 127.0.0.1:${PORT}
${mods}
LoadModule php_module ${MODS}/${libphp}
TypesConfig /etc/mime.types
User www-data
Group www-data
ErrorLog ${WORK}/logs/error.log
<FilesMatch "\\.php$">
  SetHandler application/x-httpd-php
</FilesMatch>
# Apache's stock value. The homepage only reaches index.php if public/.htaccess says so.
DirectoryIndex index.html
DocumentRoot ${PUB}
<Directory ${PUB}>
  AllowOverride All
  Require all granted
</Directory>
`);
  const st = spawnSync(APACHE, ['-f', conf, '-k', 'start'], { encoding: 'utf8' });
  if (st.status !== 0) throw new Error('apache did not start: ' + st.stderr);
  spawnSync('sleep', ['1']);

  const home = get(`${B}/`);
  note(home.status === 200 && canonical(home.body) === 'https://www.insulationproducts.com/',
    '/ is served by index.php (DirectoryIndex from .htaccess)', `${home.status} canonical=${canonical(home.body)}`);

  const cc = get(`${B}/products?productId=CC`);
  note(cc.status === 200 && /Conduit Coupling/.test(title(cc.body) || '')
    && /og:image" content="https:\/\/www\.insulationproducts\.com\/images\/products\/CC\.jpg"/.test(cc.body)
    && canonical(cc.body) === 'https://www.insulationproducts.com/products?productId=CC',
  'a product URL carries its own title, share photo and canonical', `${cc.status} ${title(cc.body)} ${canonical(cc.body)}`);
  note(/no-store/.test(cc.h('Cache-Control')) && /^text\/html/.test(cc.h('Content-Type')),
    'the page is text/html and not cached', `${cc.h('Content-Type')} | ${cc.h('Cache-Control')}`);
  note(/<div id="ipc-prerender">/.test(cc.body) && /UV rated material/.test(cc.body), 'the plain-HTML body is in the response');

  const about = get(`${B}/about?utm_source=x`);
  note(canonical(about.body) === 'https://www.insulationproducts.com/about' && /^About/.test(title(about.body) || ''),
    'REQUEST_URI survives the rewrite: /about?utm_source=x gets About\'s head', `${title(about.body)} ${canonical(about.body)}`);

  const deep = get(`${B}/products/CC/extra`);
  note(deep.status === 200 && /<meta name="robots" content="noindex"/.test(deep.body) && canonical(deep.body) === null,
    'an unknown path: noindex, no canonical, still 200 (A5)', `${deep.status} canonical=${canonical(deep.body)}`);

  const shell = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const direct = get(`${B}/index.html`);
  note(direct.status === 200 && direct.body === shell, '/index.html is still the static file');

  const asset = get(`${B}/assets/nope.js`);
  note(asset.status === 404, 'a missing /assets/ file is still a real 404, not the page', String(asset.status));

  const sm = get(`${B}/sitemap.xml`);
  note(sm.status === 200 && /<urlset/.test(sm.body) && /productId=CC</.test(sm.body), '/sitemap.xml is still the generated sitemap', String(sm.status));

  fs.writeFileSync(path.join(PUB, 'data', 'content.json'), '{ broken');
  const fb = get(`${B}/about`);
  note(fb.status === 200 && fb.body === shell, 'a damaged content.json serves index.html byte for byte', `${fb.status} ${fb.body.length}/${shell.length}`);

  const log = fs.readFileSync(path.join(WORK, 'logs', 'error.log'), 'utf8');
  const php = log.split('\n').filter((l) => /PHP (Warning|Notice|Fatal|Deprecated|Parse)/.test(l));
  note(php.length === 0, 'no PHP warning, notice or error in Apache\'s error log', php.slice(0, 3).join(' | '));
} catch (e) {
  note(false, 'the harness ran', String(e && e.message || e));
} finally {
  if (conf) spawnSync(APACHE, ['-f', conf, '-k', 'stop']);
  spawnSync('sleep', ['1']);
  if (!process.env.PRE_KEEP) fs.rmSync(WORK, { recursive: true, force: true });
}
const bad = results.filter((r) => !r.ok).length;
console.log(`\nprerender-apache ${results.length - bad}/${results.length}${REF ? ` (.htaccess from ${REF})` : ''}`);
process.exit(bad === 0 ? 0 : 1);
