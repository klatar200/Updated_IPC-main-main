/**
 * Audit-5 Medium findings — regression guards.
 * Needs :8123 (php-mail.ini) and a synced mirror. Run from the repo root.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { launch } = require('./browser.js');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, label, detail) => {
  if (c) { pass++; console.log(`ok   ${label}`); }
  else { fail++; console.log(`FAIL ${label}${detail ? '  — ' + detail : ''}`); }
};
const php = (code) => execFileSync('php', ['-r', code], { encoding: 'utf8', cwd: ROOT }).trim();
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
function req(opts, body) {
  return new Promise((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port: 8123, ...opts }, (x) => {
      let o = ''; x.on('data', (c) => (o += c)); x.on('end', () => res({ status: x.statusCode, body: o, headers: x.headers }));
    });
    r.on('error', rej); if (body) r.write(body); r.end();
  });
}
const POST = (p, o, extra = {}) => req({ path: p, method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(extra.headers || {}) } },
  new URLSearchParams(o).toString());

(async () => {
  // ── A-5.29 — a corrupt-but-parseable catalog must not fatal every admin page
  // The REAL load_products() on a {"products":"nope"} file, in a temp copy of
  // admin/ + data/ (config.php resolves data/ beside admin/). This arm used to
  // run a copy of the guard typed into the test, which stayed "array" with the
  // guard reverted (AUDIT-12 A12-L13-04-1).
  {
    const t = fs.mkdtempSync(path.join(require('os').tmpdir(), 'a529-'));
    fs.mkdirSync(path.join(t, 'admin')); fs.mkdirSync(path.join(t, 'data'));
    for (const f of fs.readdirSync(path.join(ROOT, 'admin'))) {
      if (/\.php$/.test(f) && f !== 'config.local.php') fs.copyFileSync(path.join(ROOT, 'admin', f), path.join(t, 'admin', f));
    }
    fs.writeFileSync(path.join(t, 'data', 'products-all.json'), '{"products":"nope"}');
    let got;
    try {
      got = execFileSync('php', ['-r', `require 'admin/config.php'; $p = load_products(); echo gettype($p), ':', count($p);`],
        { encoding: 'utf8', cwd: t, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch (e) { got = 'THREW: ' + String(e.stderr || e.message).split('\n').find((l) => /Error|error/.test(l)); }
    fs.rmSync(t, { recursive: true, force: true });
    ok(got === 'array:0', 'A-5.29 load_products() on a non-array products value returns [] instead of a TypeError', got);
  }

  // ── A-5.13 — the backslash/tab spellings of a protocol-relative URL
  const guard = php(`require 'admin/config.php';
    $out = [];
    foreach (['/\\\\evil.com/x.pdf', "/\\t/evil.com/x.pdf", '//evil.com/x.pdf', '/pdfs/ok.pdf', 'https://ok.example/a.pdf', 'javascript:alert(1)'] as $u) {
      $out[] = link_url_problem($u, 'x') === '' ? 'allow' : 'deny';
    }
    echo implode(',', $out);`);
  ok(guard === 'deny,deny,deny,allow,allow,deny',
     'A-5.13 link_url_problem() rejects backslash and tab spellings, keeps real paths', guard);
  const js = src('src/App.jsx');
  // RUN isSafeLinkUrl() read out of App.jsx over the same spellings. The old
  // arm passed on the "A-5.13" incident comment alone (AUDIT-12 A12-L13-04-1).
  {
    let jsGuard;
    try {
      const at = js.search(/function\s+isSafeLinkUrl\s*\(/);
      let d = 0, end = -1;
      for (let i = js.indexOf('{', at); i < js.length; i++) {
        if (js[i] === '{') d++; else if (js[i] === '}') { d--; if (d === 0) { end = i + 1; break; } }
      }
      const isSafeLinkUrl = new Function(`${js.slice(at, end)}\nreturn isSafeLinkUrl;`)();
      jsGuard = ['/\\evil.com/x.pdf', '/\t/evil.com/x.pdf', '//evil.com/x.pdf', '/pdfs/ok.pdf', 'https://ok.example/a.pdf', 'javascript:alert(1)']
        .map((u) => (isSafeLinkUrl(u) ? 'allow' : 'deny')).join(',');
    } catch (e) { jsGuard = 'THREW: ' + e.message; }
    ok(jsGuard === 'deny,deny,deny,allow,allow,deny',
       'A-5.13 isSafeLinkUrl() normalises the same way before deciding', jsGuard);
  }

  // ── A-5.12 — shape validation, not just is_array()
  const shapes = php(`require 'admin/config.php';
    echo (spec_table2_problem(['columnSpans'=>[], 'rows'=>['8.0','9.0']]) !== '' ? 'caught' : 'MISSED'), ',',
         (spec_table2_problem(['columnSpans'=>[], 'rows'=>[['1/2','0.75']]]) === '' ? 'ok' : 'FALSE-POSITIVE'), ',',
         (spec_table1_problem([['a','b']]) !== '' ? 'caught' : 'MISSED'), ',',
         (spec_table1_problem([['label'=>'OD','value'=>'1in']]) === '' ? 'ok' : 'FALSE-POSITIVE');`);
  ok(shapes === 'caught,ok,caught,ok', 'A-5.12 malformed spec tables are refused, valid ones accepted', shapes);
  ok(/spec_table2_problem/.test(src('admin/edit.php')) && /spec_table2_problem/.test(src('admin/add.php')),
     'A-5.12 both save paths call the validator');

  // ── A-5.17 / A-5.26 — timezone and session hardening
  ok(php(`require 'admin/config.php'; echo date_default_timezone_get();`) !== 'UTC',
     'A-5.17 a real timezone is configured for the admin');
  ok(/IPC_TIMEZONE/.test(src('public/contact.php')), 'A-5.17 contact.php sets its own timezone too');
  ok(/session\.use_strict_mode/.test(src('admin/config.php')),
     'A-5.26 sessions refuse a client-supplied id');

  // ── A-5.15 — a backup window that survives one sitting at the keyboard
  const keep = parseInt(php(`require 'admin/config.php'; echo BACKUP_KEEP;`), 10);
  ok(keep >= 90, `A-5.15 the backup window holds more than ten products' worth of saves (${keep})`);

  // ── A-5.16 — oversized uploads are scaled, sensible ones are untouched
  const dims = php(`require 'admin/config.php';
    $p = sys_get_temp_dir() . '/a516-' . getmypid() . '.jpg';
    $im = imagecreatetruecolor(4032, 3024); imagejpeg($im, $p, 90); imagedestroy($im);
    $did = image_downscale_in_place($p, 'jpg'); $a = getimagesize($p);
    $q = sys_get_temp_dir() . '/a516s-' . getmypid() . '.jpg';
    $im2 = imagecreatetruecolor(800, 600); imagejpeg($im2, $q, 90); imagedestroy($im2);
    $before = md5_file($q); $did2 = image_downscale_in_place($q, 'jpg');
    echo ($did ? 'scaled' : 'no'), ',', $a[0], ',', ($did2 ? 'touched' : 'untouched'), ',', ($before === md5_file($q) ? 'same' : 'changed');
    unlink($p); unlink($q);`);
  ok(dims === 'scaled,1600,untouched,same',
     'A-5.16 a phone-sized photo is scaled to 1600px and a small one is left byte-identical', dims);

  // ── A-5.20 / A-5.21 / A-5.22 — the unsaved-changes guard
  // The <script> tag itself, comments stripped: the incident comment above the
  // tag names unsaved.js and used to satisfy this (AUDIT-12 A12-L13-04-1).
  ok(/<script\b[^>]*\bsrc=["']unsaved\.js["']/.test(src('admin/edit.php').replace(/<!--[\s\S]*?-->/g, '')),
     'A-5.20 edit.php loads the unsaved-changes guard');
  const uns = src('admin/unsaved.js');
  ok(/ipc:structural-change/.test(uns), 'A-5.21 the guard listens for structural edits');
  ok(/ipc:structural-change/.test(src('admin/content-editor.js'))
     && /ipc:structural-change/.test(src('admin/spectable-editor.js')),
     'A-5.21 both editors announce reorder/remove/add');
  ok(/defaultPrevented/.test(uns), 'A-5.22 a cancelled submit re-arms the guard');
  ok(/data-no-guard/.test(src('admin/nav.php')), 'A-5.22 Sign Out no longer suppresses the guard');

  // ── A-5.14 — the providers revalidate when the tab comes back
  ok(/useRefetchOnReturn/.test(js) && (js.match(/useRefetchOnReturn\(/g) || []).length >= 3,
     'A-5.14 site-info and content both revalidate on return');

  // ── A-5.27 — a non-hex brand color is refused
  // Spelled "color" since A-9.B2-08(b): settings.php validated in British and
  // labelled in American on the same screen, and the American form is the
  // majority everywhere else on both surfaces.
  const login = await POST('/admin/auth.php', { password: 'audit-pass-123' });
  const cookie = (login.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
  const AUTH = { headers: { Cookie: cookie } };
  const settings = await req({ path: '/admin/settings.php', method: 'GET', ...AUTH });
  const tok = (settings.body.match(/name="csrf_token" value="([^"]+)"/) || [])[1] || '';
  const bad = await POST('/admin/settings.php', {
    csrf_token: tok, company_name: 'IPC', orig_sig: 'stale',
    theme_primary: 'url(https://attacker.example/ping)',
  }, AUTH);
  ok(/must be a hex color/.test(bad.body), 'A-5.27 a non-hex brand color is refused with a reason');

  // ── browser: A-5.11, A-5.23, A-5.28
  const br = await launch();
  const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
  await pg.goto('http://127.0.0.1:8123/admin/auth.php');
  await pg.fill('input[type="password"]', 'audit-pass-123');
  await pg.click('button[type="submit"], input[type="submit"]');
  await pg.waitForLoadState('networkidle');
  await pg.goto('http://127.0.0.1:8123/admin/add.php');
  await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(600);
  const seeded = await pg.evaluate(() => {
    const g = (n) => { const e = document.querySelector(`[name="${n}"]`); return e ? e.value : ''; };
    const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
    const t1 = parse(g('specTable1_rows'));
    const t2 = parse(g('specTable2_json'));
    return { r1: Array.isArray(t1) ? t1.length : -1, r2: t2 && Array.isArray(t2.rows) ? t2.rows.length : -1 };
  });
  ok(seeded.r1 === 0 && seeded.r2 === 0,
     'A-5.11 an untouched Add form posts no phantom spec rows', JSON.stringify(seeded));

  await pg.goto('http://127.0.0.1:8123/contact?productId=zzz-not-a-part');
  await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(500);
  const head = await pg.evaluate(() => ({
    t: document.title,
    robots: document.querySelector('meta[name="robots"]')?.content || '',
    canon: document.querySelector('link[rel="canonical"]')?.href || '',
  }));
  ok(!/Part not found/.test(head.t) && head.robots !== 'noindex' && /\/contact$/.test(head.canon),
     'A-5.28 a stray productId does not de-index a non-product route', JSON.stringify(head));

  await pg.goto('http://127.0.0.1:8123/products?productId=IP38FE');
  await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(600);
  await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pg.waitForTimeout(250);
  const y0 = await pg.evaluate(() => Math.round(window.scrollY));
  await pg.evaluate(() => {
    const b = [...document.querySelectorAll('button, a')].filter((e) => /view/i.test(e.textContent || ''));
    if (b.length) b[b.length - 1].click();
  });
  await pg.waitForTimeout(900);
  const y1 = await pg.evaluate(() => Math.round(window.scrollY));
  ok(y0 > 400 && y1 < 50, 'A-5.23 moving between products returns to the top', `${y0} -> ${y1}`);
  await br.close();

  console.log(`\naudit5-medium ${pass}/${pass + fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
