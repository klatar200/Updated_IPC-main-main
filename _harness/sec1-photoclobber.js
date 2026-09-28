/**
 * SEC-1 (= ADM-4) — uploading a photo for one product must never overwrite a
 * file another product is using. audit-runs/audit-2026-09-27.md SEC-1 / §6.
 *
 * upload-image.php derived the filename from the SKU (image_filename_for_sku:
 * every character outside [A-Za-z0-9_-] becomes '-') and wrote it with no
 * owner check — upload-pdf.php has had that check since T3.6. Two real ways in,
 * both reproduced by V1 and V2:
 *   collide   SKUs "AUD-1" and "AUD 1" both map to AUD-1.png
 *   reuse     a product renamed OLD -> NEW keeps /uploads/images/OLD.png;
 *             a new product called OLD then uploads to OLD.png
 * Each overwrote the other product's live photo under "Photo replaced".
 *
 * Own `php -S` on :8704 over the mirror; seeds the catalog directly, uploads
 * through the real page. 8 checks: in both scenarios the other product's file
 * keeps its bytes, and the uploading product still gets its new photo under a
 * name of its own. Control: re-uploading a product's OWN photo (same type)
 * still replaces it in place.
 *
 *   node _harness/sec1-photoclobber.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(__dirname, 'site');
const CATALOG = path.join(SITE, 'data', 'products-all.json');
const PRISTINE = path.join(__dirname, 'pristine', 'products-all.json');
const IMGDIR = path.join(SITE, 'uploads', 'images');
const PORT = 8704;
const BASE = `http://127.0.0.1:${PORT}`;
const TMP = fs.mkdtempSync('/tmp/ipc-sec1-');

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const catalog = () => JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const bySku = (s) => catalog().find((p) => p.sku === s);
const listImgs = () => (fs.existsSync(IMGDIR) ? fs.readdirSync(IMGDIR) : []);
const png = (file, r, g, b) => spawnSync('php', ['-r',
  `$i=imagecreatetruecolor(40,30);imagefill($i,0,0,imagecolorallocate($i,${r},${g},${b}));imagepng($i,${JSON.stringify(file)});`]);
const stub = (sku, extra = {}) => ({ id: sku, sku, name: `SEC-1 ${sku}`, partType: 'Accessory', description: [], badges: [], ...extra });

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`sec1-photoclobber: port ${PORT} is already in use — stop that server first`);
    process.exit(2);
  }
  const RED = path.join(TMP, 'red.png'), BLUE = path.join(TMP, 'blue.png'), GREEN = path.join(TMP, 'green.png');
  png(RED, 220, 30, 30); png(BLUE, 30, 30, 220); png(GREEN, 30, 200, 30);
  const beforeImgs = listImgs();

  // Seed: the collide pair, and the reuse pair (NEWX still points at OLDX.png).
  fs.mkdirSync(IMGDIR, { recursive: true });
  fs.copyFileSync(RED, path.join(IMGDIR, 'OLDX.png'));
  const seeded = JSON.parse(fs.readFileSync(PRISTINE, 'utf8'))
    .concat([stub('AUD-1'), stub('AUD 1'), stub('NEWX', { photoUrl: '/uploads/images/OLDX.png' }), stub('OLDX')]);
  fs.writeFileSync(CATALOG, JSON.stringify(seeded, null, 2));

  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, '-c', path.join(__dirname, 'php-mail.ini'),
    '-d', `sys_temp_dir=${TMP}`, '-d', `session.save_path=${TMP}`, path.join(__dirname, 'router.php')],
    { cwd: ROOT, stdio: 'ignore' });
  let browser = null;
  try {
    browser = await launch();
    await new Promise((r) => setTimeout(r, 800));
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${BASE}/admin/auth.php`);
    await page.fill('input[type="password"]', 'audit-pass-123');
    await Promise.all([page.waitForLoadState('networkidle'), page.locator('button[type="submit"]').first().click()]);
    const upload = async (sku, file) => {
      await page.goto(`${BASE}/admin/upload-image.php?sku=${encodeURIComponent(sku)}`);
      await page.setInputFiles('input[type="file"][name="image_file"]', file);
      await Promise.all([page.waitForLoadState('networkidle'),
        page.locator('form:has(input[name="image_file"]) button[type="submit"]').first().click()]);
      return page.locator('body').innerText();
    };
    const fileOf = (sku) => path.join(IMGDIR, path.basename(bySku(sku).photoUrl || 'none'));

    // ── collide ──
    await upload('AUD-1', RED);
    const redOnDisk = md5(fileOf('AUD-1'));
    const t = await upload('AUD 1', BLUE);
    note(md5(fileOf('AUD-1')) === redOnDisk, 'collide: AUD-1\'s photo keeps its bytes after "AUD 1" uploads',
      `AUD-1 -> ${bySku('AUD-1').photoUrl} now ${md5(fileOf('AUD-1'))}, was ${redOnDisk}`);
    note(bySku('AUD 1').photoUrl && bySku('AUD 1').photoUrl !== bySku('AUD-1').photoUrl,
      'collide: "AUD 1" gets a file of its own', `both -> ${bySku('AUD 1').photoUrl}`);
    note(bySku('AUD 1').photoUrl && md5(fileOf('AUD 1')) === md5(BLUE) || /Photo uploaded/.test(t) && md5(fileOf('AUD 1')) !== redOnDisk,
      'collide: and that file is the photo "AUD 1" just uploaded', t.split('\n').filter((l) => /photo/i.test(l)).slice(0, 2).join(' | '));

    // ── reuse after rename ──
    const oldBytes = md5(path.join(IMGDIR, 'OLDX.png'));
    await upload('OLDX', BLUE);
    note(md5(path.join(IMGDIR, 'OLDX.png')) === oldBytes, 'reuse: NEWX\'s photo (OLDX.png) keeps its bytes after the new OLDX uploads',
      'NEWX now shows the new product\'s photo');
    note(bySku('NEWX').photoUrl === '/uploads/images/OLDX.png', 'reuse: NEWX still points at OLDX.png');
    note(bySku('OLDX').photoUrl && bySku('OLDX').photoUrl !== '/uploads/images/OLDX.png',
      'reuse: the new OLDX gets a file of its own', `OLDX -> ${bySku('OLDX').photoUrl}`);

    // ── control: own photo, same type, replaced in place ──
    const own = bySku('AUD-1').photoUrl;
    await upload('AUD-1', GREEN);
    note(bySku('AUD-1').photoUrl === own, 'control: re-uploading a product\'s own photo keeps its filename', `${own} -> ${bySku('AUD-1').photoUrl}`);
    note(md5(fileOf('AUD-1')) !== redOnDisk, 'control: and replaces its bytes', 'still the old bytes');
  } finally {
    if (browser) await browser.close();
    srv.kill();
    fs.copyFileSync(PRISTINE, CATALOG);
    for (const f of listImgs()) if (!beforeImgs.includes(f)) fs.rmSync(path.join(IMGDIR, f), { force: true });
    for (const f of fs.readdirSync(path.join(SITE, 'data'))) if (/\.backup\./.test(f)) fs.rmSync(path.join(SITE, 'data', f));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  note(fs.readFileSync(CATALOG).equals(fs.readFileSync(PRISTINE)), 'mirror catalog restored byte-for-byte');

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nsec1-photoclobber ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
