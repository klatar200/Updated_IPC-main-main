/**
 * ADM-3 — "undo a delete" must bring back the product's files, not just its
 * record. audit-runs/audit-2026-09-27.md ADM-3 (= SEC-7) / §6.
 *
 * delete.php unlinked the product's PDF and uploaded photo, while both the
 * confirmation screen and Help promise "This can be undone … restore the most
 * recent Product Catalog entry". Backups cover the JSON only, so a restore
 * brought the product back pointing at files that no longer existed: the
 * public Datasheet button downloaded the SPA shell (200 text/html) and the
 * dashboard still counted it "With PDF".
 *
 * Drives the real admin on its own `php -S` (:8702) over the harness mirror:
 *   1. upload a photo to IP56DR (which already has /pdfs/IP56DR.pdf), record
 *      both files' md5
 *   2. delete IP56DR through the real confirm form
 *      -> both files are gone from their public URLs (control: delete still
 *         takes them off the site)
 *   3. restore the newest Product Catalog backup through the real Backups page
 *      -> IP56DR is back, and BOTH URLs serve the original bytes again
 * Plus a shared-file control: deleting a product whose datasheet another
 * product still uses leaves that file untouched (the existing rule).
 *
 * Restores the mirror's catalog from pristine/, its PDFs from the repo's pdfs/,
 * and removes anything it uploaded or trashed, in a finally.
 *
 *   node _harness/adm3-deleterestore.js
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
const SITE_PDFS = path.join(SITE, 'pdfs');
const IMGDIR = path.join(SITE, 'uploads', 'images');
const PORT = 8702;
const BASE = `http://127.0.0.1:${PORT}`;
const SKU = 'IP56DR';
const TMP = fs.mkdtempSync('/tmp/ipc-adm3-');

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
const catalog = () => JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const product = (sku) => catalog().find((p) => p.sku === sku);
const listDir = (d) => (fs.existsSync(d) ? fs.readdirSync(d) : []);


(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`adm3-deleterestore: port ${PORT} is already in use — stop that server first`);
    process.exit(2);
  }
  const before = { pdfs: listDir(SITE_PDFS), imgs: listDir(IMGDIR) };
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, '-c', path.join(__dirname, 'php-mail.ini'),
    '-d', `sys_temp_dir=${TMP}`, '-d', `session.save_path=${TMP}`, path.join(__dirname, 'router.php')],
    { cwd: ROOT, stdio: 'ignore' });
  let browser = null;
  try {
    browser = await launch();
    await new Promise((r) => setTimeout(r, 800));
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept());
    const fetchFile = async (url) => {
      const r = await ctx.request.get(BASE + url);
      return { status: r.status(), type: (r.headers()['content-type'] || '').split(';')[0], body: await r.body() };
    };

    await page.goto(`${BASE}/admin/auth.php`);
    await page.fill('input[type="password"]', 'audit-pass-123');
    await Promise.all([page.waitForLoadState('networkidle'), page.locator('button[type="submit"]').first().click()]);

    // 1 — give IP56DR an uploaded photo alongside its PDF
    // A real 40x30 PNG from gd, so the upload passes every check including
    // the decode (a hand-written byte string failed it, correctly).
    const pngPath = path.join(TMP, 'p.png');
    spawnSync('php', ['-r', `$i=imagecreatetruecolor(40,30);imagefill($i,0,0,imagecolorallocate($i,200,40,40));imagepng($i,${JSON.stringify(pngPath)});`]);
    await page.goto(`${BASE}/admin/upload-image.php?sku=${SKU}`);
    await page.setInputFiles('input[type="file"][name="image_file"]', pngPath);
    await Promise.all([page.waitForLoadState('networkidle'),
      page.locator('form:has(input[name="image_file"]) button[type="submit"]').first().click()]);
    const p0 = product(SKU);
    const pdf0 = await fetchFile(p0.pdfUrl);
    const img0 = await fetchFile(p0.photoUrl);
    note(pdf0.type === 'application/pdf' && img0.type === 'image/png',
      `setup: ${SKU} has a live PDF (${p0.pdfUrl}) and an uploaded photo (${p0.photoUrl})`, `${pdf0.type} / ${img0.type}`);

    // 2 — delete through the real confirm form
    await page.goto(`${BASE}/admin/delete.php?sku=${SKU}`);
    await Promise.all([page.waitForLoadState('networkidle'), page.getByRole('button', { name: /Yes, Delete/ }).click()]);
    const pdf1 = await fetchFile(p0.pdfUrl);
    const img1 = await fetchFile(p0.photoUrl);
    note(!product(SKU), `delete: ${SKU} is gone from the catalog`);
    note(pdf1.type !== 'application/pdf' && img1.type !== 'image/png',
      'delete: its PDF and photo are no longer served at their public URLs (they still come off the site)',
      `PDF ${pdf1.status} ${pdf1.type}, photo ${img1.status} ${img1.type}`);

    // 3 — restore the newest Product Catalog backup through the real page
    await page.goto(`${BASE}/admin/backups.php`);
    const form = page.locator('form:has(input[name="backup"][value^="products-all.backup."])').first();
    await Promise.all([page.waitForLoadState('networkidle'), form.locator('button[type="submit"]').click()]);
    const msg = await page.locator('body').innerText();
    const p2 = product(SKU);
    note(!!p2 && p2.pdfUrl === p0.pdfUrl && p2.photoUrl === p0.photoUrl, `restore: ${SKU} is back with the same pdfUrl and photoUrl`,
      p2 ? `${p2.pdfUrl} / ${p2.photoUrl}` : 'not in catalog');
    const pdf2 = await fetchFile(p0.pdfUrl);
    const img2 = await fetchFile(p0.photoUrl);
    note(pdf2.type === 'application/pdf' && md5(pdf2.body) === md5(pdf0.body),
      'restore: the Datasheet URL serves the ORIGINAL PDF again (not the site shell)',
      `${pdf2.status} ${pdf2.type}${pdf2.type === 'text/html' ? ' — the dead-datasheet defect' : ''}`);
    note(img2.type === 'image/png' && md5(img2.body) === md5(img0.body),
      'restore: the photo URL serves the original photo again', `${img2.status} ${img2.type}`);
    note(/brought back|restored.*file|data sheet|photo/i.test(msg.split('\n').filter((l) => /restored/i.test(l)).join(' ')),
      'restore: the success message says the files came back too',
      msg.split('\n').filter((l) => /restored/i.test(l)).join(' | ').slice(0, 240));

    // Shared-file control — IP12GA and "IP12GA - IP1274" share one datasheet.
    const shared = catalog().filter((p) => p.pdfUrl === '/pdfs/IP12GA-IP1274.pdf');
    if (shared.length >= 2) {
      await page.goto(`${BASE}/admin/delete.php?sku=${encodeURIComponent(shared[0].sku)}`);
      await Promise.all([page.waitForLoadState('networkidle'), page.getByRole('button', { name: /Yes, Delete/ }).click()]);
      const s = await fetchFile('/pdfs/IP12GA-IP1274.pdf');
      note(s.type === 'application/pdf', 'control: deleting one of two products that share a datasheet leaves the file live', `${s.status} ${s.type}`);
    } else {
      note(false, 'control: the shipped catalog still has two products sharing IP12GA-IP1274.pdf', `found ${shared.length}`);
    }
  } finally {
    if (browser) await browser.close();
    srv.kill();
    fs.copyFileSync(PRISTINE, CATALOG);
    // PDFs: put back any repo PDF that went missing, drop anything new (trash files included).
    for (const f of listDir(SITE_PDFS)) if (!before.pdfs.includes(f)) fs.rmSync(path.join(SITE_PDFS, f), { recursive: true, force: true });
    for (const f of before.pdfs) {
      const src = path.join(ROOT, 'pdfs', f);
      if (!fs.existsSync(path.join(SITE_PDFS, f)) && fs.existsSync(src)) fs.copyFileSync(src, path.join(SITE_PDFS, f));
    }
    for (const f of listDir(IMGDIR)) if (!before.imgs.includes(f)) fs.rmSync(path.join(IMGDIR, f), { force: true });
    for (const f of listDir(path.join(SITE, 'data'))) if (/\.backup\./.test(f)) fs.rmSync(path.join(SITE, 'data', f));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  note(fs.readFileSync(CATALOG).equals(fs.readFileSync(PRISTINE)), 'mirror catalog restored byte-for-byte');
  note(JSON.stringify(listDir(SITE_PDFS)) === JSON.stringify(before.pdfs), 'mirror pdfs/ restored to its starting listing');

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nadm3-deleterestore ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
