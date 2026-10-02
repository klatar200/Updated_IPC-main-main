/**
 * SEC-2 — a small image that decodes to a huge one must be refused BEFORE it
 * is decoded. audit-runs/audit-2026-09-27.md SEC-2 / §6.
 *
 * A-9.P3-2 added a full `imagecreatefromstring()` decode to upload-image.php
 * so a header-only polyglot could not pass as a photo. It ran BEFORE the 8 MB
 * size check and before anything looked at the pixel count, so the A-6.6
 * ceiling (IMG_MAX_PIXELS, enforced only later in image_downscale_in_place)
 * never got a say: measured, a 420 KB 12000x12000 PNG drove one PHP worker to
 * ~1 GB RSS, and 23000x23000 to 3.66 GB. memory_limit does not stop it — GD
 * allocates outside the Zend allocator (config.php A-6.6 comment).
 *
 * Runs its OWN `php -S` (one process, so its PID is the worker) on :8701 over
 * the harness mirror, signs in through the real form, and uploads through the
 * real upload page. Peak memory is read from /proc/<pid>/status VmHWM, which
 * GD cannot hide from.
 *
 *   bomb      8000x8000 PNG (64 MP, ~190 KB on disk): refused with the
 *             megapixel message, VmHWM grows < 64 MB, nothing written to
 *             uploads/images, photoUrl unchanged.
 *   control   a 1200x900 PNG still uploads and becomes the photoUrl — so a
 *             "refuse everything" fix cannot pass.
 *   phone50   8160x6144 PNG (50.1 MP, a 50 MP phone sensor's full size) is
 *             ACCEPTED and scaled to IMG_MAX_WIDTH — the ceiling went 40 → 52 MP
 *             on 2026-10-02 (WHATS_LEFT §1an) because SEC-2 had made the 40 MP
 *             one a refusal of ordinary phone photos.
 *
 * Needs Linux /proc and gd (the defect is gd's). Restores the mirror catalog
 * from _harness/pristine/ in a finally and asserts the restore.
 *
 *   node _harness/sec2-imagebomb.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(__dirname, 'site');
const PRISTINE = path.join(__dirname, 'pristine', 'products-all.json');
const CATALOG = path.join(SITE, 'data', 'products-all.json');
const IMGDIR = path.join(SITE, 'uploads', 'images');
const PORT = 8701;
const BASE = `http://127.0.0.1:${PORT}`;
const SKU = 'CC';
const TMP = fs.mkdtempSync('/tmp/ipc-sec2-');

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

// PNG writer: greyscale-free RGB, every row identical, so a 64 MP image
// deflates to a few hundred KB — exactly the shape of a decompression bomb.
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, noisy) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const row = Buffer.alloc(1 + w * 3);
  const parts = [];
  for (let y = 0; y < h; y++) {
    if (noisy) for (let i = 1; i < row.length; i++) row[i] = (i * 31 + y * 17) & 0xff;
    parts.push(Buffer.from(row));
  }
  const idat = zlib.deflateSync(Buffer.concat(parts), { level: 9 });
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const vmhwm = (pid) => {
  const m = fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmHWM:\s+(\d+)\s+kB/);
  return m ? Number(m[1]) : NaN;
};
const photoOf = () => (JSON.parse(fs.readFileSync(CATALOG, 'utf8')).find((p) => p.sku === SKU) || {}).photoUrl;
const imgFiles = () => (fs.existsSync(IMGDIR) ? fs.readdirSync(IMGDIR).filter((f) => !f.startsWith('.')) : []);

(async () => {
  const hasGd = spawnSync('php', ['-r', 'echo function_exists("imagecreatefromstring") ? "y" : "n";'], { encoding: 'utf8' }).stdout === 'y';
  if (!hasGd || !fs.existsSync('/proc/self/status')) {
    console.log('sec2-imagebomb SKIPPED — needs php-gd and Linux /proc');
    process.exit(3);
  }
  const bombPath = path.join(TMP, 'bomb.png');
  const okPath = path.join(TMP, 'normal.png');
  fs.writeFileSync(bombPath, png(8000, 8000, false));
  fs.writeFileSync(okPath, png(1200, 900, true));
  const phonePath = path.join(TMP, 'phone50.png');
  fs.writeFileSync(phonePath, png(8160, 6144, false));
  console.log(`bomb ${fs.statSync(bombPath).size} B for 64 MP · control ${fs.statSync(okPath).size} B`);

  // The worker PID must be OURS: a stale server already on the port would make
  // /proc/<pid> point at a process that exited, and every reading lie.
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`sec2-imagebomb: port ${PORT} is already in use — stop that server first`);
    process.exit(2);
  }
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, '-c', path.join(__dirname, 'php-mail.ini'),
    '-d', `sys_temp_dir=${TMP}`, '-d', `session.save_path=${TMP}`, path.join(__dirname, 'router.php')],
    { cwd: ROOT, stdio: 'ignore' });
  let browser = null;
  const before = { photo: photoOf(), files: imgFiles() };
  try {
    browser = await launch();
    await new Promise((r) => setTimeout(r, 800));
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${BASE}/admin/auth.php`);
    await page.fill('input[type="password"]', 'audit-pass-123');
    await Promise.all([page.waitForLoadState('networkidle'), page.locator('button[type="submit"]').first().click()]);

    const upload = async (file) => {
      await page.goto(`${BASE}/admin/upload-image.php?sku=${SKU}`);
      await page.setInputFiles('input[type="file"][name="image_file"]', file);
      const hw0 = vmhwm(srv.pid);
      await Promise.all([page.waitForLoadState('networkidle'),
        page.locator('form:has(input[name="image_file"]) button[type="submit"]').first().click()]);
      return { text: await page.locator('body').innerText(), grewKb: vmhwm(srv.pid) - hw0 };
    };

    // ── bomb ──
    const b = await upload(bombPath);
    console.log(`  bomb: peak RSS grew ${(b.grewKb / 1024).toFixed(1)} MB`);
    note(/megapixel/i.test(b.text) && !/Photo (uploaded|replaced)/.test(b.text),
      'bomb: a 64 MP upload is refused, and the message says it is too many megapixels',
      b.text.split('\n').filter((l) => /photo|megapixel|image|large/i.test(l)).slice(0, 3).join(' | '));
    note(b.grewKb < 64 * 1024,
      'bomb: refused WITHOUT decoding — worker peak memory grows < 64 MB',
      `grew ${(b.grewKb / 1024).toFixed(1)} MB (a full decode of 64 MP is ~250 MB)`);
    note(photoOf() === before.photo, 'bomb: the product photoUrl is unchanged', `now ${photoOf()}`);
    note(JSON.stringify(imgFiles()) === JSON.stringify(before.files), 'bomb: nothing was written to uploads/images',
      `files now ${imgFiles().join(', ')}`);

    // ── control ──
    const c = await upload(okPath);
    note(/Photo (uploaded|replaced)/.test(c.text), 'control: a normal 1200x900 photo still uploads',
      c.text.split('\n').filter((l) => /photo|image|error/i.test(l)).slice(0, 3).join(' | '));
    note(/\/uploads\/images\/CC\.png$/.test(photoOf() || ''), 'control: and it becomes the product photo', `photoUrl ${photoOf()}`);

    // ── phone50 ──
    const ph = await upload(phonePath);
    const w = spawnSync('php', ['-r', '$s=getimagesize($argv[1]); echo $s[0];', path.join(IMGDIR, 'CC.png')], { encoding: 'utf8' }).stdout;
    note(/Photo (uploaded|replaced)/.test(ph.text) && w === '1600',
      'phone50: a 50 MP phone-size photo is accepted and scaled to 1600 px wide',
      `${ph.text.split('\n').filter((l) => /photo|megapixel|image/i.test(l)).slice(0, 2).join(' | ')} · width ${w}`);
  } finally {
    if (browser) await browser.close();
    srv.kill();
    fs.copyFileSync(PRISTINE, CATALOG);
    for (const f of imgFiles()) if (!before.files.includes(f)) fs.unlinkSync(path.join(IMGDIR, f));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  note(fs.readFileSync(CATALOG).equals(fs.readFileSync(PRISTINE)), 'mirror catalog restored byte-for-byte');

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nsec2-imagebomb ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
