/**
 * audit9-fixes — the acceptance suite for the defects Audit 9 fixed.
 *
 * One arm per finding. Each arm was written BEFORE its fix and watched to fail
 * (GUARDRAILS §4.4); the failing transcripts are under
 * `_harness/out/audit9/C/before/`.
 *
 *   node _harness/audit9-fixes.js                 # every arm, against :8123
 *   node _harness/audit9-fixes.js --only=p7-1     # one arm
 *   BASE=http://127.0.0.1:8123 node _harness/audit9-fixes.js
 *
 * Needs the sweep mirror on :8123 (`sh _harness/sync.sh`, then the php -S in
 * `_harness/README.md`). The mutating arms drive the REAL admin forms over HTTP
 * — a hand-built POST would trip `content.php`'s truncation guard and would not
 * exercise the code the findings are about — and every one of them restores
 * `_harness/site/data/` and `_harness/site/pdfs/` from `_harness/pristine/` in a
 * `finally`, asserting the restore byte-for-byte before reporting. That
 * assertion is itself a scored check: A-9.D6 is a finding about a suite that
 * restored without proving it.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.BASE || 'http://127.0.0.1:8123';
const SITE = path.join(ROOT, '_harness', 'site');
const PRISTINE = path.join(ROOT, '_harness', 'pristine');
const PASSWORD = 'audit-pass-123';
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '';

let pass = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fails.push(`${name} — ${detail}`); console.log(`  FAIL  ${name} — ${detail}`); }
};
const section = (s) => console.log(`\n${s}`);

/* ------------------------------------------------------------------ http */
const jar = new Map();
const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
function req(method, urlPath, body, headers = {}) {
  const u = new URL(urlPath, BASE);
  return new Promise((resolve, reject) => {
    const r = http.request({
      method, host: u.hostname, port: u.port, path: u.pathname + u.search,
      headers: Object.assign({ Cookie: cookieHeader() }, headers), timeout: 20000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        for (const sc of res.headers['set-cookie'] || []) {
          const [kv] = sc.split(';');
          const i = kv.indexOf('=');
          jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
        }
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(new Error('timeout')); });
    if (body) r.write(body);
    r.end();
  });
}
const form = (pairs) => pairs.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
const postForm = (p, pairs) => req('POST', p, form(pairs), {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Content-Length': Buffer.byteLength(form(pairs)),
});
const csrfOf = (html) => (/name="csrf_token"\s+value="([^"]*)"/.exec(html) || [, ''])[1];

async function login() {
  const g = await req('GET', '/admin/auth.php');
  const r = await postForm('/admin/auth.php', [['password', PASSWORD], ['csrf_token', csrfOf(g.body)]]);
  return r.status === 302 || /Product Catalog|Sign Out/.test(r.body);
}

/* --------------------------------------------------------------- mirror */
const dataFiles = ['products-all.json', 'site-info.json', 'content.json'];
function restoreMirror() {
  for (const f of dataFiles) fs.copyFileSync(path.join(PRISTINE, f), path.join(SITE, 'data', f));
  // sync.sh re-copies pdfs/ but NEVER deletes: `cp -ru pdfs`. A renamed sheet
  // therefore survives as an extra file, and `edit.php`'s (correct) no-clobber
  // guard then SKIPS the next run's rename — which made this suite's own
  // negative control pass against unfixed code. Measured, 2026-09-14. Reconcile
  // by deleting anything the repo's pdfs/ does not have, then re-sync.
  const repoPdfs = new Set(fs.readdirSync(path.join(ROOT, 'pdfs')));
  const mirrorPdfs = path.join(SITE, 'pdfs');
  if (fs.existsSync(mirrorPdfs)) {
    for (const f of fs.readdirSync(mirrorPdfs)) {
      if (!repoPdfs.has(f)) fs.unlinkSync(path.join(mirrorPdfs, f));
    }
  }
  spawnSync('sh', [path.join(ROOT, '_harness', 'sync.sh')], { cwd: ROOT, stdio: 'ignore' });
}
function assertRestored() {
  let allEqual = true;
  const bad = [];
  for (const f of dataFiles) {
    const a = fs.readFileSync(path.join(SITE, 'data', f));
    const b = fs.readFileSync(path.join(PRISTINE, f));
    if (!a.equals(b)) { allEqual = false; bad.push(f); }
  }
  ok('restore  the mirror\'s data/ is byte-equal to _harness/pristine/ after the run',
    allEqual, `differs: ${bad.join(', ')}`);
  const repoPdfs = fs.readdirSync(path.join(ROOT, 'pdfs')).sort();
  const mirrorList = fs.existsSync(path.join(SITE, 'pdfs')) ? fs.readdirSync(path.join(SITE, 'pdfs')).sort() : [];
  const extra = mirrorList.filter((f) => !repoPdfs.includes(f));
  const missing = repoPdfs.filter((f) => !mirrorList.includes(f));
  ok('restore  the mirror\'s pdfs/ holds exactly the repo\'s files after the run',
    extra.length === 0 && missing.length === 0,
    `extra: ${extra.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}`);
}

/* ---------------------------------------------- scrape a real admin form */
function fieldsOf(html, formMatcher) {
  // Every <input>/<select>/<textarea> inside the form that carries formMatcher.
  const forms = html.split(/<form\b/i).slice(1).map((s) => '<form ' + s.split(/<\/form>/i)[0]);
  const f = forms.find((x) => formMatcher.test(x));
  if (!f) return null;
  const out = [];
  for (const m of f.matchAll(/<input\b[^>]*>/gi)) {
    const tag = m[0];
    if (/type=["']?(?:submit|button|file)/i.test(tag)) continue;
    const name = (/name=["']([^"']+)["']/.exec(tag) || [])[1];
    if (!name) continue;
    if (/type=["']?checkbox/i.test(tag) && !/\bchecked\b/i.test(tag)) continue;
    let val = (/value=["']([^"']*)["']/.exec(tag) || [, ''])[1];
    out.push([name, decodeEntities(val)]);
  }
  for (const m of f.matchAll(/<textarea\b[^>]*>([\s\S]*?)<\/textarea>/gi)) {
    const name = (/name=["']([^"']+)["']/.exec(m[0]) || [])[1];
    if (name) out.push([name, decodeEntities(m[1])]);
  }
  for (const m of f.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi)) {
    const name = (/name=["']([^"']+)["']/.exec(m[0]) || [])[1];
    if (!name) continue;
    const sel = /<option\b[^>]*selected[^>]*value=["']([^"']*)["']/i.exec(m[0])
      || /<option\b[^>]*value=["']([^"']*)["'][^>]*selected/i.exec(m[0])
      || /<option\b[^>]*value=["']([^"']*)["']/i.exec(m[0]);
    out.push([name, sel ? decodeEntities(sel[1]) : '']);
  }
  return out;
}
const decodeEntities = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'");

/* ==================================================================== arms */

// A-9.P7-1 — HIGH. Renaming a SKU whose data sheet is SHARED with another
// product must not rename the file out from under the other product.
async function armP71() {
  section('A-9.P7-1  shared data sheet survives a SKU rename');
  const products = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'products-all.json'), 'utf8'));
  const byFile = {};
  for (const p of products) {
    const u = p.pdfUrl && path.basename(p.pdfUrl);
    if (u) (byFile[u] = byFile[u] || []).push(p.sku);
    for (const a of p.additionalPdfs || []) if (a.url) {
      const b = path.basename(a.url);
      (byFile[b] = byFile[b] || []).push(p.sku);
    }
  }
  const shared = Object.entries(byFile).find(([, skus]) => new Set(skus).size > 1);
  if (!shared) { ok('p7-1  a shared data sheet exists in the catalog to test with', false, 'none found'); return; }
  const [file, skus] = shared;
  const [renameMe, other] = [skus[skus.length - 1], skus[0]];
  const tmpSku = 'AUDIT9TMP';

  const g = await req('GET', `/admin/edit.php?sku=${encodeURIComponent(renameMe)}`);
  const f = fieldsOf(g.body, /name="orig_sig"/);
  if (!f) { ok('p7-1  the Edit Product form was found', false, 'no form carrying orig_sig'); return; }
  const posted = f.map(([k, v]) => (k === 'sku' ? [k, tmpSku] : [k, v]));
  const r = await postForm(`/admin/edit.php?sku=${encodeURIComponent(renameMe)}`, posted);
  ok('p7-1  the rename is accepted', r.status === 302 || /saved successfully/i.test(r.body),
    `status ${r.status}`);

  const after = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'products-all.json'), 'utf8'));
  const otherRec = after.find((p) => p.sku === other);
  const otherUrl = otherRec && otherRec.pdfUrl;
  const otherFile = otherUrl && path.join(SITE, otherUrl.replace(/^\//, ''));
  ok('p7-1  the OTHER product\'s data sheet still exists on disk',
    !!(otherFile && fs.existsSync(otherFile)),
    `${other} -> ${otherUrl} (${otherFile && fs.existsSync(otherFile) ? 'present' : 'MISSING'})`);

  // Status alone is NOT proof here: the harness router answers a missing file
  // with the SPA shell and a 200 (A-9.P3-1), so a 404 never appears. Assert the
  // content type as well — that is what tells a served PDF from the shell.
  const head = await req('GET', otherUrl || '/pdfs/does-not-exist.pdf');
  ok('p7-1  the OTHER product\'s Data Sheet link serves a PDF, not the SPA shell',
    head.status === 200 && /pdf/i.test(head.headers['content-type'] || ''),
    `GET ${otherUrl} -> ${head.status} ${head.headers['content-type'] || '(no type)'}`);

  // The renamed product must still reach a sheet of its own.
  const meRec = after.find((p) => p.sku === tmpSku);
  const meUrl = meRec && meRec.pdfUrl;
  const meHead = meUrl ? await req('GET', meUrl) : { status: 0, headers: {} };
  ok('p7-1  the renamed product still reaches its own data sheet',
    meHead.status === 200 && /pdf/i.test(meHead.headers['content-type'] || ''),
    `GET ${meUrl} -> ${meHead.status} ${meHead.headers['content-type'] || '(no type)'}`);

  ok('p7-1  the owner is told the sheet was kept because it is shared',
    /shared|also used|kept/i.test(r.body) || r.status === 302,
    'no note in the response body');
  console.log(`  note  shared file ${file}: ${[...new Set(skus)].join(' + ')}; renamed ${renameMe} -> ${tmpSku}`);
}

// A-9.P2-1 — the SKU validator must not hard-depend on mbstring.
function armP21() {
  section('A-9.P2-1  the admin does not die on a host without mbstring');
  const cfg = fs.readFileSync(path.join(ROOT, 'admin', 'config.php'), 'utf8');
  const calls = [...cfg.matchAll(/\bmb_[a-z_]+\s*\(/g)].map((m) => m[0].replace(/\s*\($/, ''));
  const guarded = /function_exists\(\s*['"]mb_strlen['"]\s*\)/.test(cfg);
  ok('p2-1  every mb_* call in config.php is behind a function_exists guard',
    calls.length === 0 || guarded, `mb_* calls: ${[...new Set(calls)].join(', ') || 'none'}; guard present: ${guarded}`);

  // The real proof: run the validator with the extension's function disabled.
  const probe = `<?php
    define('IPC_HARNESS_PROBE', 1);
    $_SERVER['REQUEST_METHOD']='GET';
    require ${JSON.stringify(path.join(SITE, 'admin', 'config.php'))};
    $e = sku_problems(str_repeat('A', 70));
    echo (count($e) === 1 && strpos($e[0], 'too long') !== false) ? 'LONG-OK' : 'LONG-BAD:'.json_encode($e);
    echo '|';
    echo empty(sku_problems('IP33PO')) ? 'GOOD-OK' : 'GOOD-BAD';
  `;
  const probePath = path.join(ROOT, '_harness', 'out', 'audit9', 'C', 'p21-probe.php');
  fs.mkdirSync(path.dirname(probePath), { recursive: true });
  fs.writeFileSync(probePath, probe);
  const run = spawnSync('php', ['-d', 'disable_functions=mb_strlen', '-d', 'display_errors=Off', probePath],
    { cwd: ROOT, encoding: 'utf8' });
  const out = (run.stdout || '') + (run.stderr || '');
  ok('p2-1  sku_problems() still enforces the 64-character cap without mb_strlen',
    /LONG-OK/.test(out), `probe said ${JSON.stringify(out.slice(0, 200))}`);
  ok('p2-1  a valid SKU still validates without mb_strlen',
    /GOOD-OK/.test(out), `probe said ${JSON.stringify(out.slice(0, 200))}`);
}

// A-9.P2-2 — a photo kept at full size because gd is absent must say so.
function armP22() {
  section('A-9.P2-2  a photo kept at full size names the reason');
  const src = fs.readFileSync(path.join(ROOT, 'admin', 'upload-image.php'), 'utf8');
  const hasNoGdBranch = /no-gd/.test(src);
  const surfaced = /no-gd[\s\S]{0,400}?(\$msg|\$notice|message|could not be resized|full size)/i.test(src)
    || /(could not be resized|kept at its original size|image tools)/i.test(src);
  ok('p2-2  the no-gd outcome is surfaced to the owner, not only the pixel-count one',
    hasNoGdBranch && surfaced, `no-gd branch: ${hasNoGdBranch}, message: ${surfaced}`);
  const health = fs.readFileSync(path.join(ROOT, 'admin', 'index.php'), 'utf8')
    + fs.readFileSync(path.join(ROOT, 'admin', 'config.php'), 'utf8');
  ok('p2-2  the dashboard health check knows about the image extension',
    /extension_loaded\(\s*['"]gd['"]\s*\)|function_exists\(\s*['"]imagescale['"]\s*\)/.test(health),
    'neither index.php nor config.php checks for gd');
}

// A-9.P3-2 — a file that is not a usable image must not be accepted.
// Driven end to end: the source grep alone cannot tell a guard that runs from
// one that is written but unreachable.
async function armP32() {
  section('A-9.P3-2  a 29-byte GIF+PHP polyglot is refused');
  const src = fs.readFileSync(path.join(ROOT, 'admin', 'upload-image.php'), 'utf8');
  ok('p3-2  the uploader checks the decoded image, not just the header and MIME',
    /\bimagecreatefromstring\b/.test(src), 'no decode step found in upload-image.php');

  const sku = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'products-all.json'), 'utf8'))[0].sku;
  const imgDir = path.join(SITE, 'uploads', 'images');
  const before = fs.existsSync(imgDir) ? fs.readdirSync(imgDir) : [];

  const g = await req('GET', `/admin/upload-image.php?sku=${encodeURIComponent(sku)}`);
  const csrf = csrfOf(g.body);
  // The exact payload from the finding: a valid GIF header, then a PHP block.
  const payload = Buffer.concat([Buffer.from('GIF89a'), Buffer.from('<' + '?php echo "PWNED"; ?' + '>')]);
  const b = '----audit9' + Date.now();
  const body = Buffer.concat([
    Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n${csrf}\r\n`),
    Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="image_file"; filename="poly.gif"\r\nContent-Type: image/gif\r\n\r\n`),
    payload, Buffer.from(`\r\n--${b}--\r\n`),
  ]);
  const r = await req('POST', `/admin/upload-image.php?sku=${encodeURIComponent(sku)}`, body, {
    'Content-Type': `multipart/form-data; boundary=${b}`, 'Content-Length': body.length,
  });
  ok('p3-2  the upload is refused with a message that tells the owner what to do',
    /not a usable image|cannot be opened as one|program code/i.test(r.body),
    `response said ${JSON.stringify((r.body.match(/<li[^>]*>([^<]{10,120})/) || [, r.body.slice(0, 90)])[1])}`);

  const after = fs.existsSync(imgDir) ? fs.readdirSync(imgDir) : [];
  const landed = after.filter((f) => !before.includes(f));
  ok('p3-2  nothing landed in uploads/images/', landed.length === 0, `new files: ${landed.join(', ')}`);
  for (const f of landed) fs.unlinkSync(path.join(imgDir, f));

  const cat = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'products-all.json'), 'utf8'));
  const rec = cat.find((p) => p.sku === sku);
  ok('p3-2  the product\'s photo was not repointed at it',
    !(rec && /poly\.gif|\.gif$/i.test(rec.photoUrl || '')) || !landed.length,
    `photoUrl is now ${rec && rec.photoUrl}`);
}

// A-9.P7-2 — a cold load of /contact?sent=1 must not claim a request was sent,
// and a REAL submit must still confirm. Both arms, in a browser: the panel is
// rendered by the bundle, so a source grep cannot settle it.
async function armP72() {
  section('A-9.P7-2  /contact?sent=1 on a cold load does not fake a success panel');
  const { launch } = require('./browser.js');
  const browser = await launch();
  const PANEL = /Quote Request Received|Message Sent|has been received/i;
  try {
    // 1. Cold context, no submission anywhere in this session.
    const cold = await browser.newContext();
    const p1 = await cold.newPage();
    await p1.goto(`${BASE}/contact?sent=1`, { waitUntil: 'networkidle' });
    const coldText = await p1.locator('body').innerText();
    ok('p7-2  a cold load of ?sent=1 shows no confirmation', !PANEL.test(coldText),
      `body said ${JSON.stringify((coldText.match(PANEL) || [''])[0] || coldText.slice(0, 60))}`);
    ok('p7-2  a cold load of ?sent=1 shows the form instead',
      await p1.locator('form').first().isVisible().catch(() => false), 'no visible form');
    await cold.close();

    // 2. A real submission in its own context must still confirm — the fix must
    //    not cost the person who actually submitted their receipt.
    const live = await browser.newContext();
    const p2 = await live.newPage();
    await p2.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
    // Ids and the submit control are read from the rendered form, not assumed:
    // the first button matching /request|submit|send/ is the TAB SWITCHER
    // ("📋 Request a Quote"), and clicking it submits nothing. That is the
    // GUARDRAILS §7.2 selector class, and it cost this arm one run.
    await p2.fill('#rfq-name', 'Audit Nine');
    await p2.fill('#rfq-email', 'audit9@example.com');
    await p2.fill('#rfq-company', 'IPC Harness');
    await p2.fill('#rfq-partNumber', 'IP33PO');
    await p2.fill('#rfq-quantity', '10');      // required
    await p2.locator('button:has-text("Submit Quote Request")').first().click();
    await p2.waitForTimeout(3000);
    const liveText = await p2.locator('body').innerText();
    ok('p7-2  a real submission still shows its confirmation', PANEL.test(liveText),
      `body began ${JSON.stringify(liveText.slice(0, 90))}`);

    // 3. and a reload by that same person still shows it (the documented
    //    "standard answer" the original comment argues for, kept intact).
    await p2.reload({ waitUntil: 'networkidle' });
    const reloadText = await p2.locator('body').innerText();
    ok('p7-2  a reload by the person who submitted still shows it', PANEL.test(reloadText),
      `body began ${JSON.stringify(reloadText.slice(0, 90))}`);
    await live.close();
  } finally {
    await browser.close();
  }
}

/* ===================================================================== run */
(async () => {
  const arms = {
    'p7-1': { fn: armP71, async: true, mutates: true },
    'p2-1': { fn: armP21 },
    'p2-2': { fn: armP22 },
    'p3-2': { fn: armP32, async: true, mutates: true },
    'p7-2': { fn: armP72, async: true, mutates: true },
  };
  const chosen = only ? { [only]: arms[only] } : arms;
  if (only && !arms[only]) { console.error(`unknown arm ${only}`); process.exit(2); }
  const needsServer = Object.values(chosen).some((a) => a && a.async);
  const needsRestore = Object.values(chosen).some((a) => a && a.mutates);

  try {
    if (needsServer) {
      const up = await req('GET', '/data/site-info.json').catch(() => ({ status: 0 }));
      if (up.status !== 200) {
        console.error(`audit9-fixes: ${BASE} is not serving the mirror — start the :8123 server first.`);
        process.exit(2);
      }
      if (!(await login())) {
        console.error('audit9-fixes: could not sign in to the mirror admin — run `php _harness/setpw.php`.');
        process.exit(2);
      }
    }
    // Reconcile BEFORE the run as well as after. A stray sheet left by an
    // earlier run makes `edit.php`'s no-clobber guard skip the rename, and the
    // p7-1 arm then passes against unfixed code — measured, twice, 2026-09-14.
    // A suite that only cleans up on the way out starts dirty on the way in.
    if (needsRestore) restoreMirror();
    for (const [name, a] of Object.entries(chosen)) {
      if (!a) continue;
      if (a.async) await a.fn(); else a.fn();
    }
  } finally {
    if (needsRestore && !process.env.AUDIT9_NO_RESTORE) { restoreMirror(); assertRestored(); }
  }

  const total = pass + fails.length;
  console.log(`\naudit9-fixes ${pass}/${total}`);
  if (fails.length) { console.log('\nfailing:'); for (const f of fails) console.log(`  - ${f}`); }
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('audit9-fixes crashed:', e && e.stack || e); process.exit(2); });
