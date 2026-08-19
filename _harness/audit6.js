/**
 * audit6 — the nine findings in audit-runs/audit6.md.
 *
 * Written against the UNFIXED tree and watched to fail first (GUARDRAILS 4.4).
 * Baseline before any fix: 16/41, with every finding reproduced.
 *
 * Two of these can only be measured, not read:
 *
 *  - A-6.1 needs a real browser AND the real Content-Security-Policy string,
 *    because `php -S` ignores .htaccess (GUARDRAILS 4.3) and a source-read
 *    cannot tell you whether Chromium runs the handler. The check serves the
 *    page captured from a live CSRF failure on :8123, once with the policy and
 *    once without, and requires the control to pass — a probe whose control
 *    fails is measuring its own scaffolding.
 *  - A-6.6 needs the real GD, because PHP's own accounting does not see it:
 *    memory_get_peak_usage() reports 2MB while process RSS grows by 55MB.
 *
 * Needs :8123. Run from the repo root.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { launch } = require('./browser.js');

const ROOT = path.join(__dirname, '..');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
function ok(cond, label, detail) {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? '  — ' + detail : ''}`); }
}
function section(t) { console.log(`\n${t}`); }

/** POST junk to an admin page and get the real csrf_fail_page() HTML back. */
function captureCsrfFailPage() {
  return new Promise((resolve, reject) => {
    const body = 'csrf_token=bogus&x=1';
    const req = http.request({
      host: '127.0.0.1', port: 8123, path: '/admin/settings.php', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let out = '';
      res.on('data', (d) => (out += d));
      res.on('end', () => resolve(out));
    });
    req.on('error', reject);
    req.end(body);
  });
}

/**
 * Serve `html` at /fail (with or without the admin CSP) behind a /start page,
 * click the recovery control, and report whether history.back() actually ran.
 */
async function backButtonWorks(html, csp) {
  const srv = await new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      if (req.url === '/start') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        return res.end('<!doctype html><title>start</title><a id="go" href="/fail">go</a>');
      }
      if (req.url === '/fail') {
        const h = { 'Content-Type': 'text/html; charset=UTF-8' };
        if (csp) h['Content-Security-Policy'] = csp;
        res.writeHead(403, h);
        return res.end(html);
      }
      // csrf_fail_page() pulls its handler from a same-origin script; serve it
      // from the repo so the page under test is the shipped one.
      if (req.url === '/csrf-back.js') {
        const p = path.join(ROOT, 'admin/csrf-back.js');
        if (!fs.existsSync(p)) { res.writeHead(404); return res.end(''); }
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=UTF-8' });
        return res.end(fs.readFileSync(p));
      }
      res.writeHead(404); res.end('');
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = srv.address().port;
  const browser = await launch();
  const page = await browser.newPage();
  const violations = [];
  page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/start`);
  await page.click('#go');
  await page.waitForURL(/\/fail$/);
  await page.click('.btn-primary').catch(() => {});
  await page.waitForTimeout(700);
  const landed = new URL(page.url()).pathname;
  await browser.close();
  srv.close();
  return { wentBack: landed === '/start', violations };
}

/** Run a PHP snippet that has already required what it needs. */
function php(code) {
  return execFileSync('php', ['-r', code], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

(async () => {
  // ── A-6.1 ────────────────────────────────────────────────────────────────
  section('A-6.1  csrf_fail_page() recovery button under the admin CSP');
  const cfg = R('admin/config.php');
  const adminHt = R('admin/.htaccess');

  ok(!/onclick=/.test(cfg), 'config.php carries no inline event handler',
     'inline onclick is blocked by script-src self');
  ok(fs.existsSync(path.join(ROOT, 'admin/csrf-back.js')), 'admin/csrf-back.js exists');
  ok(/csrf-back\.js/.test(cfg), 'csrf_fail_page() loads csrf-back.js');

  const cspLine = (adminHt.match(/Content-Security-Policy\s+"([^"]+)"/) || [])[1];
  ok(!!cspLine && /script-src 'self'/.test(cspLine) && !/unsafe-inline/.test(cspLine.split('script-src')[1] || ''),
     'the policy under test is the shipped one (script-src self, no unsafe-inline)');

  const failHtml = await captureCsrfFailPage();
  ok(/Your sign-in session expired/.test(failHtml), 'captured the real expired-session page from :8123');

  const control = await backButtonWorks(failHtml, null);
  ok(control.wentBack, 'CONTROL — without the CSP header the recovery control goes back',
     'the probe proves nothing if this fails');
  const live = await backButtonWorks(failHtml, cspLine);
  ok(live.wentBack, 'with the shipped CSP the recovery control still goes back',
     live.violations[0] || 'no navigation');

  // ── A-6.2 ────────────────────────────────────────────────────────────────
  section('A-6.2  the three data-tree .htaccess files are in the deploy manifest');
  const readme = R('README.md');
  const uploadTable = readme.slice(readme.indexOf('| Upload to `public_html/` |'), readme.indexOf('**Do NOT upload:**'));
  for (const f of ['data/.htaccess', 'pdfs/.htaccess', 'uploads/.htaccess']) {
    ok(uploadTable.includes(f), `README upload table names ${f}`,
       'not in dist/, so nothing else will carry it to the server');
  }
  // Collapse whitespace first: the file is hard-wrapped, so the sentence this
  // asserts is split across a newline and a line-sensitive match would fail on
  // prose that says exactly the right thing.
  const readmeFlat = readme.replace(/\s+/g, ' ');
  ok(/`\.htaccess` inside (them|it|each one) is repo code/i.test(readmeFlat),
     'README says the .htaccess inside those folders is repo code, not customer state');
  ok(/rows mean each folder's \*\*contents\*\*/i.test(readmeFlat),
     'README says the do-not-upload rows mean the folder contents');

  // ── A-6.3 ────────────────────────────────────────────────────────────────
  section('A-6.3  reply_slot() redacts scheme-less hosts');
  const slotOut = php(
    '$s=file_get_contents("public/contact.php");' +
    'define("IPC_MAX_LINE",200);define("IPC_MAX_TEXT",5000);' +
    'preg_match("/function s\\\\(.*?\\\\n}\\\\n/s",$s,$a);eval($a[0]);' +
    'preg_match("/function reply_slot.*?\\\\n}\\\\n/s",$s,$b);eval($b[0]);' +
    '$c=["bare"=>"Pay at evil-example.com/ipc-pay","tld"=>"portal ipc-billing.net/pay",' +
    '"prefixed"=>"Pay now xhttps://evil.example/pay","scheme"=>"go https://evil.example/x",' +
    '"nl"=>"Jane\\nACTION REQUIRED","part"=>"IP12GA - IP1274","qty"=>"500 ft",' +
    '"mat"=>"PTFE 8.0 mil","date"=>"2026-09-01","initial"=>"J. Smith",' +
    '"nospace"=>"J.Smith","city"=>"St. Louis","abbrev"=>"Acme Mfg. Inc.",' +
    '"inches"=>"Fiberglass sleeving, 0.5 in."];' +
    'foreach($c as $k=>$v){echo $k,"\\t",reply_slot($v,80),"\\n";}'
  );
  const slot = Object.fromEntries(slotOut.trim().split('\n').map((l) => l.split('\t')));
  ok(!/evil-example\.com/.test(slot.bare), 'a bare domain.tld/path is redacted', slot.bare);
  ok(!/ipc-billing\.net/.test(slot.tld), 'a bare host with another TLD is redacted', slot.tld);
  ok(!/evil\.example/.test(slot.prefixed), 'a word-prefixed scheme is redacted', slot.prefixed);
  ok(!/evil\.example/.test(slot.scheme), 'a plain scheme is still redacted', slot.scheme);
  ok(!/\n/.test(slot.nl), 'the newline collapse still holds', JSON.stringify(slot.nl));
  ok(slot.part === 'IP12GA - IP1274', 'a real part number is untouched', slot.part);
  ok(slot.qty === '500 ft', 'a real quantity is untouched', slot.qty);
  ok(slot.mat === 'PTFE 8.0 mil', 'a decimal in a material is untouched', slot.mat);
  ok(slot.date === '2026-09-01', 'a real date is untouched', slot.date);
  ok(slot.initial === 'J. Smith', 'an initial-plus-surname is untouched', slot.initial);
  // The false-positive shapes this fix could plausibly have broken. The first
  // label must be 2+ characters, which is what keeps an initial working, and the
  // TLD must be 2+ LETTERS, which is what keeps 8.0 and 0.5 working.
  ok(slot.nospace === 'J.Smith', 'an initial with no space is untouched', slot.nospace);
  ok(slot.city === 'St. Louis', 'an abbreviated place name is untouched', slot.city);
  ok(slot.abbrev === 'Acme Mfg. Inc.', 'a company abbreviation is untouched', slot.abbrev);
  ok(slot.inches === 'Fiberglass sleeving, 0.5 in.', 'a decimal plus a unit abbreviation is untouched', slot.inches);

  // ── A-6.4 ────────────────────────────────────────────────────────────────
  section('A-6.4  compression covers the type modern Apache gives .js');
  const pubHt = R('public/.htaccess');
  // The whole mod_deflate block, not one line: Apache accepts the type list
  // spread over several AddOutputFilterByType directives and the file uses that
  // to keep the line lengths readable.
  const deflate = (pubHt.match(/<IfModule mod_deflate\.c>[\s\S]*?<\/IfModule>/) || [''])[0];
  ok(/\btext\/javascript\b/.test(deflate), 'DEFLATE list includes text/javascript', deflate);
  ok(/\bapplication\/javascript\b/.test(deflate), 'DEFLATE list still includes application/javascript');
  ok(/\bapplication\/xml\b/.test(deflate), 'DEFLATE list includes application/xml (sitemap.php)');

  // ── A-6.5 ────────────────────────────────────────────────────────────────
  section('A-6.5  admin HSTS survives a TLS-terminating proxy');
  ok(/SetEnvIf\s+X-Forwarded-Proto\s+"\^https\$"\s+IPC_TLS=1/.test(adminHt),
     'admin/.htaccess sets IPC_TLS from X-Forwarded-Proto');
  ok(/Strict-Transport-Security[^\n]*env=IPC_TLS/.test(adminHt),
     'admin HSTS keys on IPC_TLS, not env=HTTPS');
  ok(/Strict-Transport-Security[^\n]*env=IPC_TLS/.test(pubHt),
     'the public tree still keys on IPC_TLS (unchanged)');

  // ── A-6.6 ────────────────────────────────────────────────────────────────
  section('A-6.6  photo downscaling has a pixel ceiling');
  const bigPath = path.join(ROOT, '_harness/out/audit6-huge.jpg');
  fs.mkdirSync(path.dirname(bigPath), { recursive: true });
  // 9000x9000 = 81 MP, comfortably over any sane budget and ~2 s to build.
  php(`$im=imagecreatetruecolor(9000,9000);imagefilledrectangle($im,0,0,8999,8999,imagecolorallocate($im,200,120,60));imagejpeg($im,"${bigPath.replace(/\\/g, '/')}",70);`);
  const guard = php(
    'ob_start();require "admin/config.php";ob_end_clean();' +
    `$p=sys_get_temp_dir()."/audit6-huge.jpg";copy("${bigPath.replace(/\\/g, '/')}",$p);` +
    '$before=filesize($p);$r=image_downscale_in_place($p,"jpg");' +
    'echo ($r?"resized":"skipped"),"\\t",($before===filesize($p)?"intact":"changed"),"\\n";@unlink($p);'
  ).trim().split('\t');
  ok(guard[0] === 'skipped', 'an 81 MP upload is not decoded', `image_downscale_in_place returned ${guard[0]}`);
  ok(guard[1] === 'intact', 'the uploaded file is left exactly as it arrived', guard[1]);
  const phoneOut = php(
    'ob_start();require "admin/config.php";ob_end_clean();' +
    '$im=imagecreatetruecolor(4032,3024);imagejpeg($im,$p=sys_get_temp_dir()."/audit6-phone.jpg",70);' +
    '$r=image_downscale_in_place($p,"jpg");$g=getimagesize($p);' +
    'echo ($r?"resized":"skipped"),"\\t",$g[0],"\\n";@unlink($p);'
  ).trim().split('\t');
  ok(phoneOut[0] === 'resized' && phoneOut[1] === '1600',
     'an ordinary 12 MP phone photo is still scaled to 1600px', phoneOut.join(' '));
  fs.unlinkSync(bigPath);

  // ── A-6.7 ────────────────────────────────────────────────────────────────
  section('A-6.7  sitemap.php accepts both catalog shapes');
  const sitemapOut = php(
    '$dir=sys_get_temp_dir()."/audit6-sm";@mkdir($dir);@mkdir("$dir/data");' +
    'copy("public/sitemap.php","$dir/sitemap.php");' +
    '$rows=[["id"=>"AA"],["id"=>"BB"]];' +
    'file_put_contents("$dir/data/products-all.json",json_encode(["products"=>$rows]));' +
    '$w=shell_exec("php ".escapeshellarg("$dir/sitemap.php"));' +
    'echo substr_count($w,"productId="),"\\n";' +
    'file_put_contents("$dir/data/products-all.json",json_encode($rows));' +
    '$b=shell_exec("php ".escapeshellarg("$dir/sitemap.php"));' +
    'echo substr_count($b,"productId="),"\\n";' +
    'array_map("unlink",glob("$dir/data/*"));@rmdir("$dir/data");@unlink("$dir/sitemap.php");@rmdir($dir);'
  ).trim().split('\n');
  ok(sitemapOut[1] === '2', 'a bare-array catalog still emits its product URLs', sitemapOut[1]);
  ok(sitemapOut[0] === '2', 'a {products:[...]} catalog emits its product URLs too', sitemapOut[0]);

  // ── A-6.8 ────────────────────────────────────────────────────────────────
  section('A-6.8  every Site Images label carries the deploy warning');
  const content = R('admin/content.php');
  const siteImages = content.slice(content.indexOf("'siteImages' =>"), content.indexOf("'hero' =>"));
  for (const k of ['heroPhoto', 'bandTeamPhoto', 'bandBuildingPhoto', 'aboutPhoto', 'servicesPhoto']) {
    const line = siteImages.split('\n').find((l) => l.includes(`'${k}'`)) || '';
    ok(/uploads\/site\//.test(line), `${k} names uploads/site/ in its label`);
  }

  // ── A-6.9 ────────────────────────────────────────────────────────────────
  section('A-6.9  admin/README.md tracks BACKUP_KEEP');
  const keep = (R('admin/config.php').match(/define\('BACKUP_KEEP',\s*(\d+)\)/) || [])[1];
  const adminReadme = R('admin/README.md');
  ok(keep === '90', 'BACKUP_KEEP is 90', keep);
  ok(!/\b30 kept per prefix\b/.test(adminReadme), 'admin/README.md no longer says 30 kept per prefix');
  ok((adminReadme.match(new RegExp(`\\b${keep} kept per prefix\\b`, 'g')) || []).length === 2,
     `admin/README.md says "${keep} kept per prefix" in both places`);

  console.log(`\naudit6 ${pass}/${pass + fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
