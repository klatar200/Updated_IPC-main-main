/**
 * Lows batch F — the documentation findings and the four with code behind
 * them (audit-runs/audit-2026-09-27.md): ADM-2, NEW-N3-3 (+R3-m3-2), DEP-8,
 * and the doc records ADM-9/10/11/12, DEP-4/6/7/9/10/11/12, NEW-N3-1/7/8/9/10/12,
 * NEW-V2-2, NEW-V4-2..8.
 *
 * Doc findings are checked as TEXT that must no longer be there (each one a
 * sentence the audit showed to be false) plus the text that replaced it; the
 * code findings are driven for real (own php -S on :8721 for N3-3).
 *   ADM-2    the "session expired" page tells you to sign in (new tab) BEFORE
 *            pressing Back
 *   N3-3     with uploads/.htaccess missing and unwritable (a dangling symlink),
 *            a real photo upload through php -S is refused, nothing lands,
 *            and the dashboard says why
 *   DEP-8    `vite build` prints no CJS-deprecation / module-type warnings
 *   docs     the false statements are gone; lint.php (file references) passes
 *
 *   node _harness/lowsF-docs.js
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.env.LOWSF_ROOT || path.join(__dirname, '..');   // LOWSF_ROOT: measure another checkout
const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── ADM-2 ── render the page through the real function
{
  const r = spawnSync('php', ['-r', `$_SERVER['REQUEST_METHOD']='GET'; require ${JSON.stringify(path.join(ROOT, 'admin', 'config.php'))}; csrf_fail_page('expired');`],
    { encoding: 'utf8' });
  const html = r.stdout || '';
  const signIn = html.search(/sign-in page<\/a> in a <strong>new tab<\/strong>/i);
  const back = html.search(/click <strong>Back to my unsaved page<\/strong>/i);
  note(signIn > -1 && back > -1 && signIn < back, 'ADM-2: the expired page says sign in (new tab) BEFORE pressing Back', `sign-in at ${signIn}, back at ${back}`);
}

// ── N3-3 ── a dangling symlink makes uploads/.htaccess both missing and
// unwritable (root ignores permissions, so a chmod would not do it). A real
// php -S over a throwaway copy of the admin, a real sign-in, a real PNG.
async function armN33() {
  const tmp = fs.mkdtempSync('/tmp/ipc-lowsF-');
  try {
    const admin = path.join(tmp, 'admin');
    fs.mkdirSync(admin, { recursive: true });
    for (const f of fs.readdirSync(path.join(ROOT, 'admin'))) {
      if (/\.(php|js|svg)$/.test(f) && f !== 'config.local.php') fs.copyFileSync(path.join(ROOT, 'admin', f), path.join(admin, f));
    }
    const hash = spawnSync('php', ['-r', "echo password_hash('lowsF-pass-123', PASSWORD_BCRYPT);"], { encoding: 'utf8' }).stdout;
    fs.writeFileSync(path.join(admin, 'config.local.php'), `<?php\ndefine('ADMIN_PASSWORD_HASH', '${hash}');\n`);
    for (const d of ['uploads/images', 'data', 'pdfs']) fs.mkdirSync(path.join(tmp, d), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'data', 'products-all.json'), path.join(tmp, 'data', 'products-all.json'));
    fs.symlinkSync('/nonexistent-dir/.htaccess', path.join(tmp, 'uploads', '.htaccess'));
    const PORT = 8721;
    const srv = require('child_process').spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', tmp], { cwd: tmp, stdio: 'ignore' });
    try {
      await new Promise((r) => setTimeout(r, 700));
      const { adminHttp } = require('./adminhttp');
      const a = adminHttp(PORT);
      await a.login('lowsF-pass-123');
      const dash = await a.req('GET', '/admin/index.php');
      note(/uploads\/\.htaccess<\/code> security file is missing/.test(dash.body), 'N3-3: the dashboard banners a missing uploads/.htaccess');
      const g = await a.req('GET', '/admin/upload-image.php?sku=CC');
      const png = spawnSync('php', ['-r', '$i=imagecreatetruecolor(20,20); imagepng($i);'], { encoding: 'buffer' }).stdout;
      const b = '----lowsF' + Date.now();
      const body = Buffer.concat([
        Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n${a.csrfOf(g.body)}\r\n`),
        Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="image_file"; filename="ok.png"\r\nContent-Type: image/png\r\n\r\n`),
        png, Buffer.from(`\r\n--${b}--\r\n`),
      ]);
      const r = await a.req('POST', '/admin/upload-image.php?sku=CC', body, { 'Content-Type': `multipart/form-data; boundary=${b}` });
      const landed = fs.readdirSync(path.join(tmp, 'uploads', 'images'));
      note(landed.length === 0 && /security file \(uploads\/\.htaccess\)/.test(r.body),
        'N3-3: a valid photo is refused, and nothing lands, while uploads/.htaccess is missing and cannot be written',
        `landed: ${landed.join(', ') || 'none'}; status ${r.status}`);
    } finally { srv.kill(); }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

(async () => {
await armN33();
// ── DEP-8 ──
{
  const out = fs.mkdtempSync('/tmp/ipc-lowsF-dist-');
  const r = spawnSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir'], { cwd: ROOT, encoding: 'utf8' });
  const text = (r.stdout || '') + (r.stderr || '');
  note(r.status === 0 && !/CJS build of Vite|MODULE_TYPELESS_PACKAGE_JSON|Module type of file/i.test(text),
    'DEP-8: the build prints no CJS-deprecation or module-type warnings', text.split('\n').filter((l) => /warn|deprecat/i.test(l)).join(' | '));
  note(/"engines"\s*:\s*\{\s*"node"/.test(read('package.json')), 'DEP-8: package.json declares engines.node');
  fs.rmSync(out, { recursive: true, force: true });
}

// ── doc statements the audit proved false: must be gone ──
const gone = [
  // Each pattern is the false sentence as it stood on main before this batch.
  ['GO-LIVE.md', /assets\/index-\*\.js/, 'DEP-4: the curl with a literal * in the bundle name'],
  ['GO-LIVE.md', /_harness\/out\/audit9\/step0\.md/, 'DEP-12: a citation of a gitignored file'],
  ['GO-LIVE.md', /into a `php\.ini` in `public_html\/`/, 'NEW-N3-1: "move the directives into a php.ini"'],
  ['public/.user.ini', /move the same\s*\n?;?\s*directives into a php\.ini/, 'NEW-N3-1: .user.ini\'s php.ini advice'],
  ['README.md', /Deploy `admin\/config\.local\.php` by hand/, 'DEP-6: "deploy config.local.php by hand"'],
  ['CLAUDE.md', /\| hand-deployed \|/, 'DEP-6: CLAUDE.md\'s hand-deployed config.local.php row'],
  ['CLAUDE.md', /create\/delete\s*\n?\s*`admin\/ALLOW-PASSWORD-RESET`/, 'DEP-11: "create/delete ALLOW-PASSWORD-RESET"'],
  ['admin/help.php', /After 5 incorrect attempts/, 'NEW-N3-10: "After 5 incorrect attempts"'],
  ['admin/README.md', /After 5 fail(ures|ed logins)/, 'NEW-N3-10: admin/README "After 5 failures"'],
  ['Email to Rick - Admin Dashboard Handoff.md', /\*\*Product Catalog\*\* page/, 'ADM-10: "Product Catalog page"'],
  ['admin/help.php', /<strong>Product Catalog<\/strong> page/, 'ADM-9e: help\'s "Product Catalog page"'],
];
for (const [file, re, label] of gone) {
  let t = '';
  try { t = read(file); } catch { note(false, `${label} — file ${file} readable`); continue; }
  note(!re.test(t), `docs: gone — ${label} (${file})`);
}
// …and what replaced them is there
const present = [
  // Text only this batch adds.
  ['GO-LIVE.md', /### B4\. Set the admin password/, 'DEP-6/V4-2: B4 sets the first-deploy password with the reset flow'],
  ['GO-LIVE.md', /Confirm the host runs PHP 7\.4 or newer/, 'DEP-7: a PHP 7.4 check in §A'],
  ['admin/help.php', /Server temporary folder writable/, 'NEW-N3-9: a temp-folder row in "What your server allows"'],
];
for (const [file, re, label] of present) note(re.test(read(file)), `docs: present — ${label} (${file})`);

// ── lint.php: every file CLAUDE.md names exists (catches the .mjs renames) ──
{
  const r = spawnSync('php', [path.join(__dirname, 'lint.php')], { cwd: ROOT, encoding: 'utf8' });
  const failing = (r.stdout || '').split('\n').filter((l) => /failing/.test(l) && !/\b0 failing/.test(l));
  note(failing.length === 0, 'lint.php: no failing checks (incl. doc file references)', failing.join(' | '));
}

const bad = results.filter((r) => !r.ok).length;
console.log(`\nlowsF-docs ${results.length - bad}/${results.length}`);
process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
