/**
 * DEP-3 — script execution in uploads/ and data/, measured on a REAL Apache.
 *
 * `php -S` ignores .htaccess (GUARDRAILS 4.3), so every other suite is blind
 * to this. audit-runs/audit-2026-09-27.md DEP-3 / §6: on a host that maps PHP
 * with `AddHandler` (common on shared hosting), mod_mime hands a file to PHP
 * for ANY .php extension in its name, so `x.php.jpg` executes. The shipped
 * rules failed three ways:
 *   - uploads/.htaccess's deny regex was `$`-anchored, so it never matched
 *     `x.php.jpg` at all;
 *   - both uploads/.htaccess and the runtime copy upload-image.php writes
 *     (uploads_runtime_htaccess()) carried a LATER image allow-list
 *     <FilesMatch> with `Order Deny,Allow` / `Allow from all`. Apache merges
 *     matching sections in order, so it re-allowed any name ending in an
 *     image extension even when the deny above had matched it;
 *   - data/.htaccess's regex was `$`-anchored, case-sensitive and had no
 *     `phar`, so `x.phar` executed even under Ubuntu's stock handler.
 * pdfs/.htaccess (broad `(\.|$)` rule, no allow section) was the one that
 * held, and it is the control here.
 *
 * Two handler models, both mod_php 8.x under prefork, each against the four
 * directories' real .htaccess files plus the runtime copy:
 *   addhandler — `AddHandler application/x-httpd-php .php .php5 .phtml .phar`
 *   sethandler — Debian/Ubuntu stock `<FilesMatch ".+\.ph(?:ar|p|tml)$">`
 * Every script-named payload must answer 403 AND never print the marker; every
 * legitimate file must answer 200 with its body. The legit arm is what stops a
 * "deny everything" fix from passing.
 *
 * Needs /usr/sbin/apache2 and libphp8.x. Without them it prints SKIPPED and
 * exits 3 — never 0, so a sweep cannot count an unmeasured run as a pass.
 * Builds its docroot under /var/tmp (the Apache user cannot traverse a 0700
 * scratch dir) on ports 8691-8692, and removes it on exit.
 *
 * Deny-by-default (2026-09-29): in uploads/ (and the runtime copy) every
 * NON-image file must also answer 403 — an uploaded page, script, text, JSON or
 * extension-less file — while JPG/PNG/WEBP/GIF (any case) and an SVG logo
 * still serve, the SVG only with its sandboxing CSP.
 *
 *   node _harness/dep3-scriptblock.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const APACHE = '/usr/sbin/apache2';
const MODS = '/usr/lib/apache2/modules';
const libphp = fs.existsSync(MODS) && fs.readdirSync(MODS).find((f) => /^libphp[0-9.]*\.so$/.test(f));
if (!fs.existsSync(APACHE) || !libphp) {
  console.log('dep3-scriptblock SKIPPED — needs /usr/sbin/apache2 and libphp (apt install apache2 libapache2-mod-php)');
  process.exit(3);
}

const WORK = `/var/tmp/ipc-dep3-${process.pid}`;
const MARK = 'EXEC-' + 'MARKER';
const PAYLOAD = `<?php echo "EXEC-" . "MARKER"; ?>\n`;
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
  '1f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4540000000049454e44ae426082', 'hex');

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

// Script-named payloads. Each is a real PHP open tag, so "executed" is
// unambiguous: the marker appears only if PHP ran it.
const PAYLOADS = ['x.php', 'x.php.jpg', 'x.pHp.png', 'x.phtml.gif', 'x.php5', 'x.PHP', 'x.phar', 'x.php.pdf', 'x.phps'];

// uploads/ is deny-by-default: these are not scripts, and must still be 403.
const NONIMAGE = [['page.html', '<script>alert(1)</script>\n'], ['x.js', 'alert(1)\n'], ['notes.txt', 'hi\n'],
  ['data.json', '{}\n'], ['noext', 'hi\n'], ['x.svgz', 'hi\n']];
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>\n';
const isUploads = (dir) => /^(rt\/)?uploads(\/|$)/.test(dir);

// Directory -> .htaccess source, and the legitimate files that must still serve.
const DIRS = {
  'uploads': { ht: fs.readFileSync(path.join(ROOT, 'uploads/.htaccess')), legit: [['ok.png', PNG]] },
  'uploads/images': { ht: null, legit: [['CC.png', PNG], ['IP12-GA.jpg', PNG], ['UPPER.JPG', PNG]] },
  'uploads/site': { ht: null, legit: [['hero.v2.png', PNG], ['logo.svg', SVG]] },
  'rt/uploads': { ht: null, legit: [['ok.png', PNG]] }, // runtime copy, filled below
  'rt/uploads/images': { ht: null, legit: [['CC.webp', PNG], ['logo.svg', SVG]] },
  'data': { ht: fs.readFileSync(path.join(ROOT, 'data/.htaccess')), legit: [['products-all.json', '[]\n']] },
  'pdfs': { ht: fs.readFileSync(path.join(ROOT, 'pdfs/.htaccess')), legit: [['CC.pdf', '%PDF-1.4\n%%EOF\n']] },
};

// The runtime copy is served exactly as upload-image.php would write it.
const rt = spawnSync('php', ['-r', 'require $argv[1]; echo uploads_runtime_htaccess();', path.join(ROOT, 'admin/config.php')], { encoding: 'utf8' });
if (rt.status !== 0 || !rt.stdout.includes('FilesMatch')) {
  note(false, 'uploads_runtime_htaccess() is callable from admin/config.php', (rt.stderr || rt.stdout).slice(0, 300));
} else {
  DIRS['rt/uploads'].ht = Buffer.from(rt.stdout);
}

const MODELS = {
  addhandler: 'AddHandler application/x-httpd-php .php .php5 .phtml .phar',
  sethandler: '<FilesMatch ".+\\.ph(?:ar|p|tml)$">\n  SetHandler application/x-httpd-php\n</FilesMatch>',
};

function build(model, port) {
  const base = path.join(WORK, model);
  const pub = path.join(base, 'pub');
  for (const [dir, spec] of Object.entries(DIRS)) {
    const d = path.join(pub, dir);
    fs.mkdirSync(d, { recursive: true });
    if (spec.ht) fs.writeFileSync(path.join(d, '.htaccess'), spec.ht);
    for (const p of PAYLOADS) fs.writeFileSync(path.join(d, p), PAYLOAD);
    for (const [name, body] of spec.legit) fs.writeFileSync(path.join(d, name), body);
    if (isUploads(dir)) for (const [name, body] of NONIMAGE) fs.writeFileSync(path.join(d, name), body);
  }
  fs.mkdirSync(path.join(base, 'logs'), { recursive: true });
  const mods = ['mpm_prefork', 'authz_core', 'authz_host', 'access_compat', 'mime', 'headers', 'setenvif', 'dir', 'alias']
    .map((m) => `LoadModule ${m}_module ${MODS}/mod_${m}.so`).join('\n');
  const conf = `ServerRoot /etc/apache2
ServerName 127.0.0.1
PidFile ${base}/httpd.pid
Listen 127.0.0.1:${port}
${mods}
LoadModule php_module ${MODS}/${libphp}
TypesConfig /etc/mime.types
User www-data
Group www-data
ErrorLog ${base}/logs/error.log
${MODELS[model]}
DocumentRoot ${pub}
<Directory ${pub}>
  AllowOverride All
  Require all granted
</Directory>
`;
  fs.writeFileSync(path.join(base, 'httpd.conf'), conf);
  return path.join(base, 'httpd.conf');
}

function get(port, urlPath) {
  const r = spawnSync('curl', ['-s', '--noproxy', '*', '--max-time', '10', '-o', '-', '-w', '\n%{http_code}',
    `http://127.0.0.1:${port}/${urlPath}`], { encoding: 'latin1' });
  const out = r.stdout || '';
  const i = out.lastIndexOf('\n');
  return { code: Number(out.slice(i + 1)), body: out.slice(0, i) };
}

const confs = [];
try {
  fs.mkdirSync(WORK, { recursive: true });
  let port = 8691;
  for (const model of Object.keys(MODELS)) {
    const conf = build(model, port);
    execFileSync('chown', ['-R', 'www-data:www-data', WORK]);
    execFileSync('chmod', ['-R', 'u+rwX,go+rX', WORK]);
    const st = spawnSync(APACHE, ['-f', conf, '-k', 'start'], { encoding: 'utf8' });
    if (st.status !== 0) { note(false, `${model}: apache starts`, st.stderr); port++; continue; }
    confs.push(conf);
    spawnSync('sleep', ['1']);

    console.log(`\n${model}`);
    for (const [dir, spec] of Object.entries(DIRS)) {
      if (dir.startsWith('rt/') && !DIRS['rt/uploads'].ht) continue;
      const leaks = [];
      for (const p of PAYLOADS) {
        const r = get(port, `${dir}/${p}`);
        if (r.body.includes(MARK)) leaks.push(`${p} EXECUTED (${r.code})`);
        else if (r.code !== 403) leaks.push(`${p} ${r.code} (served, not denied)`);
      }
      note(leaks.length === 0, `${model}: ${dir}/ denies all ${PAYLOADS.length} script-named files (403, never executed)`, leaks.join(', '));
      const broke = [];
      for (const [name, body] of spec.legit) {
        const r = get(port, `${dir}/${name}`);
        if (r.code !== 200 || r.body !== Buffer.from(body).toString('latin1')) broke.push(`${name} ${r.code}`);
      }
      note(broke.length === 0, `${model}: ${dir}/ still serves its legitimate files (200, exact bytes)`, broke.join(', '));
      if (isUploads(dir)) {
        const open = NONIMAGE.map(([n]) => [n, get(port, `${dir}/${n}`).code]).filter(([, c]) => c !== 403).map(([n, c]) => `${n} ${c}`);
        note(open.length === 0, `${model}: ${dir}/ denies every non-image file (deny-by-default)`, open.join(', '));
        const svg = spec.legit.find(([n]) => n.endsWith('.svg'));
        if (svg) {
          const h = spawnSync('curl', ['-s', '--noproxy', '*', '--max-time', '10', '-o', '/dev/null', '-D', '-', `http://127.0.0.1:${port}/${dir}/${svg[0]}`], { encoding: 'latin1' }).stdout || '';
          note(/^content-security-policy:.*sandbox/mi.test(h), `${model}: ${dir}/ serves an SVG only with the sandboxing CSP`, h.split('\n')[0]);
        }
      }
    }
    port++;
  }
} finally {
  for (const c of confs) spawnSync(APACHE, ['-f', c, '-k', 'stop']);
  spawnSync('sleep', ['1']);
  fs.rmSync(WORK, { recursive: true, force: true });
}

const bad = results.filter((r) => !r.ok).length;
console.log(`\ndep3-scriptblock ${results.length - bad}/${results.length}`);
process.exit(bad === 0 ? 0 : 1);
