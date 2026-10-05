/**
 * Admin dashboard audit, 2026-10-05 (WHATS_LEFT §1ap) — one arm per finding.
 *
 * Three independent passes (data integrity, security, owner walkthrough) found
 * the defects below on a private copy of the built site. Each arm reproduces
 * the failure the audit measured and asserts the behaviour the owner needs;
 * the suite was run against the unfixed tree first and failed every arm.
 *
 *   DI-1  undoing a SKU rename via Backups brings the renamed data sheets back
 *   DI-2  Business Details refuses to load/save over a damaged site-info.json
 *   DI-3  a failed catalog save after a photo replace leaves the old photo
 *   DI-4  Remove Photo / replace → Backups restore brings the photo back
 *   DI-5  changing only the display phone moves the tel: number with it
 *   DI-6  an Additional-PDF / photo URL that is not on the server is reported
 *   DI-7  a second trash of the same name keeps the first one
 *   DI-8  a browser save of an unchanged product / Page Content is a no-op
 *   DI-9  Add Product on a damaged catalog says it is damaged
 *   UX-1  the Add/Edit live preview filters standard badges, shows approvals,
 *         and drops the operating temperature and summary like the site does
 *   UX-2  the badge hint is true, and a standard badge with its box unticked
 *         is reported on save
 *   UX-3  Help no longer claims the SEO rows set social-share previews
 *   UX-4  Catalog PDF / Site Images paths that are not on the server are reported
 *   UX-5..7  Backups, Audit Log and a size-chart edit page fit 390 px
 *   UX-8  a shipped product photo is not called "external"
 *   UX-9  the restore message shows the date as listed, not the file name
 *   UX-10 Help's Image Caption row names both places it shows
 *   UX-11 a rate-limited quote request raises the badge and keeps its fields
 *   UX-12 the Business Details preview shows the original value for a cleared box
 *   SEC-A1 an IPv4-mapped IPv6 client is throttled as its IPv4 address
 *   SEC-A2 behind a trusted proxy the throttle keys on the right-most XFF entry
 *   G2-G5 Help lists what is fixed (ISO cannot be emptied, share tags, alt text, labels)
 *
 * Works on its OWN copy of the mirror (_harness/out/aa11-site, rebuilt every
 * run), so renames, trash and uploads never touch _harness/site. Servers:
 * :8742 normal, :8743 the same docroot with a 100 KB file-size limit (a save
 * of the 240 KB catalog fails there, the way a full quota does).
 *
 *   npm run build && sh _harness/sync.sh && node _harness/adminaudit11.js
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync, execFileSync } = require('child_process');
const { adminHttp } = require('./adminhttp');
const { launch } = require('./browser');

const H = __dirname;
const ROOT = path.join(H, '..');
const SRC = path.join(H, 'site');
const SITE = path.join(H, 'out', 'aa11-site');
const TMP = path.join(H, 'out', 'aa11-tmp');
const PORT = 8742, LIMITED = 8743;
const BASE = `http://127.0.0.1:${PORT}`;
const PASS = 'audit-pass-123';
const D = (f) => path.join(SITE, 'data', f);

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};
const arm = async (label, fn) => { try { await fn(); } catch (e) { note(false, label, 'threw: ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const cat = () => JSON.parse(fs.readFileSync(D('products-all.json'), 'utf8'));
const prod = (sku) => cat().find((p) => p.sku === sku);
const onDisk = (url) => !!url && fs.existsSync(path.join(SITE, url));
const backups = (prefix) => fs.readdirSync(path.join(SITE, 'data')).filter((n) => n.startsWith(prefix + '.backup.'));
const newestBackup = (prefix) => backups(prefix).sort((a, b) => fs.statSync(D(a)).mtimeMs - fs.statSync(D(b)).mtimeMs || (a < b ? -1 : 1)).pop();
const reset = () => { for (const f of ['products-all.json', 'site-info.json', 'content.json']) fs.copyFileSync(path.join(H, 'pristine', f), D(f)); };

function multipart(fields, files) {
  const b = '----aa11' + Math.random().toString(16).slice(2);
  const parts = [];
  for (const [k, v] of fields) parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  for (const [k, name, buf, type] of files) {
    parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"; filename="${name}"\r\nContent-Type: ${type}\r\n\r\n`), buf, Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${b}--\r\n`));
  return { body: Buffer.concat(parts), type: 'multipart/form-data; boundary=' + b };
}
async function upload(a, url, fields, files) {
  const g = await a.req('GET', url);
  const m = multipart([['csrf_token', a.csrfOf(g.body)], ...fields], files);
  return a.req('POST', url, m.body, { 'Content-Type': m.type, 'Content-Length': m.body.length });
}
const img = (kind, rgb) => execFileSync('php', ['-r', `$i=imagecreatetruecolor(40,30);imagefill($i,0,0,imagecolorallocate($i,${rgb}));ob_start();image${kind}($i);echo ob_get_clean();`]);
const pdf = (tag) => Buffer.from(`%PDF-1.4\n% ${tag}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`);
const flashOf = async (a) => { const r = await a.req('GET', '/admin/index.php'); return ((/<div class="alert alert-(?:success|error)">([\s\S]*?)<\/div>/.exec(r.body) || [])[1] || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'"); };
async function saveEdit(a, sku, change = (f) => f) {
  const g = await a.req('GET', '/admin/edit.php?sku=' + encodeURIComponent(sku));
  const r = await a.post('/admin/edit.php?sku=' + encodeURIComponent(sku), change(a.formFields(g.body, /orig_sig/)));
  return { r, flash: r.status === 302 ? await flashOf(a) : r.body };
}
async function restore(a, file) {
  const g = await a.req('GET', '/admin/backups.php');
  return a.post('/admin/backups.php', [['csrf_token', a.csrfOf(g.body)], ['backup', file]]);
}
const successOf = (html) => ((/<div class="alert-success">([\s\S]*?)<\/div>/.exec(html) || [])[1] || '').trim();
const set = (pairs, k, v) => pairs.map(([n, x]) => (n === k ? [n, v] : [n, x]));

function startServer(port, limited) {
  const args = ['-S', `127.0.0.1:${port}`, '-t', SITE, '-c', path.join(H, 'php-mail.ini'),
    '-d', `sys_temp_dir=${TMP}`, '-d', `sendmail_path=${path.join(H, 'fakemail.sh')}`, path.join(H, 'router.php')];
  const cmd = limited
    ? spawn('sh', ['-c', `ulimit -f 100; trap '' XFSZ; exec php ${args.map((x) => `'${x}'`).join(' ')}`], { cwd: SITE, stdio: 'ignore' })
    : spawn('php', args, { cwd: SITE, stdio: 'ignore' });
  return cmd;
}

(async () => {
  for (const p of [PORT, LIMITED]) {
    if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', `http://127.0.0.1:${p}/`]).status === 0) { console.log(`adminaudit11: port ${p} in use`); process.exit(2); }
  }
  fs.rmSync(SITE, { recursive: true, force: true });
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  execFileSync('cp', ['-r', SRC, SITE]);
  reset();
  const srv = startServer(PORT, false);
  const lim = startServer(LIMITED, true);
  await wait(800);
  const browser = await launch();
  const a = adminHttp(PORT);
  try {
    if (!(await a.login(PASS))) throw new Error('sign-in failed');
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.goto(BASE + '/admin/auth.php');
    await page.fill('input[name=password]', PASS);
    await Promise.all([page.waitForNavigation(), page.press('input[name=password]', 'Enter')]);

    // ── DI-1 ──
    await arm('DI-1', async () => {
      reset();
      const before = prod('IP52EC');
      const urls = [before.pdfUrl, ...before.additionalPdfs.map((x) => x.url)];
      await saveEdit(a, 'IP52EC', (f) => set(f, 'sku', 'IP52ECX'));
      const moved = urls.every((u) => !onDisk(u));
      const rr = await restore(a, newestBackup('products-all'));
      const back = urls.filter(onDisk);
      note(moved && back.length === urls.length && /IP52EC-molded-cap\.pdf/.test(successOf(rr.body)),
        'DI-1: undoing a SKU rename from Backups puts the renamed data sheets back under their old names, and says so',
        `renamed away ${moved}; back on disk ${back.length}/${urls.length}; message "${successOf(rr.body).slice(0, 160)}"`);
    });

    // ── DI-2 ──
    await arm('DI-2', async () => {
      reset();
      const damaged = fs.readFileSync(D('site-info.json'), 'utf8').replace(/\}\s*$/, ',}');
      fs.writeFileSync(D('site-info.json'), damaged);
      const g = await a.req('GET', '/admin/settings.php');
      const f = a.formFields(g.body, /orig_sig/) || [];
      const r = await a.post('/admin/settings.php', set(f, 'company_name', 'IPC'));
      note(/site-info\.json[\s\S]{0,80}damaged|damaged[\s\S]{0,120}site-info\.json/i.test(g.body), 'DI-2: Business Details warns on open when site-info.json is damaged');
      note(fs.readFileSync(D('site-info.json'), 'utf8') === damaged && !/saved=1/.test(r.headers.location || ''),
        'DI-2: and refuses the save, leaving the damaged file for a Backups restore', `status ${r.status} ${r.headers.location || ''}`);
      reset();
    });

    // ── DI-3 / DI-4 ──
    await arm('DI-3', async () => {
      reset();
      await upload(a, '/admin/upload-image.php?sku=CC', [], [['image_file', 'red.png', img('png', '200,0,0'), 'image/png']]);
      const was = prod('CC').photoUrl;
      const b = adminHttp(LIMITED);
      await b.login(PASS);
      await upload(b, '/admin/upload-image.php?sku=CC', [], [['image_file', 'blue.jpg', img('jpeg', '0,0,200'), 'image/jpeg']]);
      const now = prod('CC').photoUrl;
      note(was === '/uploads/images/CC.png' && onDisk(now), 'DI-3: when the catalog save fails after a photo replace, the photo the catalog names is still on disk',
        `was ${was}, catalog now ${now}, on disk ${onDisk(now)}`);
    });
    await arm('DI-4', async () => {
      reset();
      await upload(a, '/admin/upload-image.php?sku=CC', [], [['image_file', 'red.png', img('png', '200,0,0'), 'image/png']]);
      await upload(a, '/admin/upload-image.php?sku=CC', [], [['image_file', 'blue.jpg', img('jpeg', '0,0,200'), 'image/jpeg']]);
      await restore(a, newestBackup('products-all'));
      const p1 = prod('CC').photoUrl;
      note(p1 === '/uploads/images/CC.png' && onDisk(p1), 'DI-4: replace a photo with another file type, then undo from Backups — the old photo comes back', `${p1} on disk ${onDisk(p1)}`);
      await upload(a, '/admin/upload-image.php?sku=CC', [['action', 'remove']], []);
      await restore(a, newestBackup('products-all'));
      const p2 = prod('CC').photoUrl;
      note(onDisk(p2) && /^\/uploads\/images\//.test(p2), 'DI-4: Remove Photo, then undo from Backups — the photo comes back', `${p2} on disk ${onDisk(p2)}`);
    });

    // ── DI-5 ──
    await arm('DI-5', async () => {
      reset();
      const save = async (ch) => { const g = await a.req('GET', '/admin/settings.php'); return a.post('/admin/settings.php', ch(a.formFields(g.body, /orig_sig/))); };
      await save((f) => set(set(f, 'contact_phone', '630.555.0100'), 'contact_phoneDial', '+16305550100'));
      await save((f) => set(f, 'contact_phone', '630.555.0199'));
      const c = JSON.parse(fs.readFileSync(D('site-info.json'), 'utf8')).contact;
      note(c.phone === '630.555.0199' && c.phoneDial === '+16305550199', 'DI-5: changing only the display phone moves the click-to-call number with it', JSON.stringify(c));
      const g = await a.req('GET', '/admin/settings.php');
      const r = await a.post('/admin/settings.php', set(set(a.formFields(g.body, /orig_sig/), 'contact_phone', '630.555.0111'), 'contact_phoneDial', '+16305550122'));
      note(r.status === 200 && JSON.parse(fs.readFileSync(D('site-info.json'), 'utf8')).contact.phone === '630.555.0199',
        'DI-5: typing two DIFFERENT numbers into the two boxes is refused with a reason, not saved', `status ${r.status}`);
      reset();
    });

    // ── DI-6 ──
    await arm('DI-6', async () => {
      reset();
      const { flash } = await saveEdit(a, 'IP52EC', (f) => set(set(f, 'additionalPdfs', '/pdfs/IP52EC-plugged-cap.pdf | Plugged Cap\n/pdfs/IP52EC-pluged-cap.pdf | Typo'), 'photoUrl', '/uploads/images/nope.jpg'));
      note(/IP52EC-pluged-cap\.pdf/.test(flash) && /nope\.jpg/.test(flash), 'DI-6: a data-sheet or photo address that is not on the server is named in the save message', flash.slice(0, 220));
      reset();
    });

    // ── DI-7 ──
    await arm('DI-7', async () => {
      reset();
      const add = async () => { const g = await a.req('GET', '/admin/add.php'); const f = a.formFields(g.body.replace(/<template[\s\S]*?<\/template>/gi, ''), /name="partType"/).filter(([k]) => !['sku', 'name', 'partType'].includes(k)); return a.post('/admin/add.php', [...f, ['sku', 'ZZT1'], ['name', 'Trash test'], ['partType', 'Tape']]); };
      const del = async () => { const g = await a.req('GET', '/admin/delete.php?sku=ZZT1'); return a.post('/admin/delete.php?sku=ZZT1', [['csrf_token', a.csrfOf(g.body)]]); };
      await add(); await upload(a, '/admin/upload-pdf.php?sku=ZZT1', [], [['pdf_file', 'v1.pdf', pdf('VERSION-ONE'), 'application/pdf']]);
      await del();
      await add(); await upload(a, '/admin/upload-pdf.php?sku=ZZT1', [], [['pdf_file', 'v2.pdf', pdf('VERSION-TWO'), 'application/pdf']]);
      await del();
      const v1 = fs.readdirSync(path.join(SITE, 'pdfs')).some((n) => { try { return fs.readFileSync(path.join(SITE, 'pdfs', n), 'latin1').includes('VERSION-ONE'); } catch { return false; } });
      note(v1, 'DI-7: deleting a re-added product twice keeps BOTH trashed data sheets — the first is not overwritten');
      for (const n of fs.readdirSync(path.join(SITE, 'pdfs'))) if (/ZZT1/.test(n)) fs.rmSync(path.join(SITE, 'pdfs', n));
      reset();
    });

    // ── DI-8 ──
    await arm('DI-8', async () => {
      reset();
      const n0 = backups('products-all').length;
      for (const sku of ['CC', 'IP12GA', 'IP52EC']) {
        await page.goto(BASE + '/admin/edit.php?sku=' + sku);
        await Promise.all([page.waitForNavigation(), page.click('form:has(input[name=orig_sig]) button[type=submit]')]);
      }
      note(backups('products-all').length === n0, 'DI-8: opening a product in a browser and saving it unchanged writes no backup (3 products, size charts included)', `${backups('products-all').length - n0} new backups`);
      const c0 = backups('content').length;
      await page.goto(BASE + '/admin/content.php');
      await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]:has-text("Save")')]);
      note(backups('content').length === c0, 'DI-8: saving Page Content unchanged in a browser writes no backup', `${backups('content').length - c0} new backups`);
      reset();
    });

    // ── DI-9 ──
    await arm('DI-9', async () => {
      reset();
      fs.writeFileSync(D('products-all.json'), fs.readFileSync(D('products-all.json'), 'utf8').replace(/\]\s*$/, ',]'));
      const g = await a.req('GET', '/admin/add.php');
      const f = (a.formFields(g.body.replace(/<template[\s\S]*?<\/template>/gi, ''), /name="partType"/) || []).filter(([k]) => !['sku', 'name', 'partType'].includes(k));
      const r = await a.post('/admin/add.php', [...f, ['sku', 'ZZD1'], ['name', 'Damaged test'], ['partType', 'Tape']]);
      note(/damaged/i.test(r.body) && !/Check file permissions/i.test(r.body), 'DI-9: Add Product on a damaged catalog says the catalog is damaged, not "check file permissions"');
      reset();
    });

    // ── UX-1 ──
    await arm('UX-1', async () => {
      reset();
      await page.goto(BASE + '/admin/edit.php?sku=CC90');
      await page.waitForSelector('.ipc-preview-body');
      const pv = await page.evaluate(() => {
        const b = document.querySelector('.ipc-preview-body');
        return { pills: [...b.querySelectorAll('.pp-badge')].map((x) => x.textContent.trim()), appr: [...b.querySelectorAll('.pp-appr')].map((x) => x.textContent.trim()),
          text: b.textContent, ticked: [...document.querySelectorAll('input[name="approvals[]"]:checked')].map((x) => x.value) };
      });
      note(!pv.pills.includes('UL Listed') && pv.pills.includes('Reusable'), 'UX-1: the preview drops badges that name a standard, as the product page does', JSON.stringify(pv.pills));
      note(pv.ticked.length > 0 && JSON.stringify(pv.appr) === JSON.stringify(pv.ticked), 'UX-1: the preview shows the ticked approvals', `appr ${JSON.stringify(pv.appr)} ticked ${JSON.stringify(pv.ticked)}`);
      const extra = await page.evaluate(() => ({ meta: (document.querySelector('.ipc-preview-body .pp-meta') || {}).textContent || '', summary: !!document.querySelector('.ipc-preview-body .pp-summary') }));
      note(!extra.meta.includes('125°C') && !extra.summary, 'UX-1: the preview leaves out Operating Temperature and the Specifications Summary, which the product page does not show', JSON.stringify(extra));
    });

    // ── UX-2 ──
    await arm('UX-2', async () => {
      reset();
      const eg = await a.req('GET', '/admin/edit.php?sku=CC');
      note(!/These appear as pill badges on the product detail page\./.test(eg.body), 'UX-2: the badge hint no longer says every badge shows on the product page');
      const { flash } = await saveEdit(a, 'CC', (f) => set(f, 'badges', 'UV Rated\nRoHS Compliant').filter(([k, v]) => !(k === 'approvals[]' && v === 'RoHS')));
      note(/RoHS/.test(flash) && /tick|box|Approvals/i.test(flash), 'UX-2: saving a badge that names a standard with its Approvals box unticked says it will not show', flash.slice(0, 220));
      reset();
    });

    // ── UX-3, UX-10, G2–G5 (Help) ──
    await arm('help', async () => {
      const helpRaw = (await a.req('GET', '/admin/help.php')).body;
      const help = helpRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      note(!/preview card when someone shares a page on social media/.test(help) && /social media[^.]{0,200}(fixed|not change|does not follow)/i.test(help),
        'UX-3: Help no longer says the SEO rows set social-share previews, and says those are fixed');
      const capRow = ((/<td>Image Caption<\/td><td>([\s\S]*?)<\/td>/.exec(helpRaw) || [])[1] || '');
      note(/photo/i.test(capRow) && /name|banner|title/i.test(capRow), 'UX-10: Help\'s Image Caption row (Adding a product) names both places the caption shows', capRow.slice(0, 160));
      note(/ISO[^.]{0,200}(cannot be (left )?empt|can't be (left )?empt|emptying it puts back)/i.test(help), 'G2: Help says the ISO box cannot be emptied');
      note(/View All Industries/.test(help) && /IMAGE COMING SOON/i.test(help) && /favicon|browser-tab icon/i.test(help), 'G5: Help lists the small fixed labels (View All Industries, IMAGE COMING SOON, browser-tab icon)');
      note(/(description|alt)[^.]{0,120}(read aloud|screen reader)[^.]{0,200}fixed|fixed[^.]{0,200}screen reader/i.test(help), 'G4: Help says the Site Images photo descriptions are fixed');
      note(/JavaScript switched off|without JavaScript|no-JavaScript/i.test(help) && /shared on social media/i.test(help), 'G3: Help names the fixed share tags and the no-JavaScript contact block');
    });

    // ── UX-4 ──
    await arm('UX-4', async () => {
      reset();
      const g = await a.req('GET', '/admin/settings.php');
      await a.post('/admin/settings.php', set(a.formFields(g.body, /orig_sig/), 'catalogPdfUrl', '/pdfs/nope-catalog.pdf'));
      const s2 = await a.req('GET', '/admin/settings.php?saved=1');
      note(/nope-catalog\.pdf[\s\S]{0,200}(not on the server|not found|does not exist|no such file)|(not on the server|not found|does not exist)[\s\S]{0,200}nope-catalog\.pdf/i.test(s2.body),
        'UX-4: a Catalog PDF address that is not on the server is reported after saving');
      reset();
      await page.goto(BASE + '/admin/content.php');
      await page.fill('[name="copy[siteImages][aboutPhoto]"]', 'images/site/Nope.JPG');
      await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]:has-text("Save")')]);
      const body = await page.content();
      note(/Nope\.JPG[\s\S]{0,300}(not on the server|not found|does not exist)|(not on the server|not found|does not exist)[\s\S]{0,300}Nope\.JPG/i.test(body), 'UX-4: a Site Images path that is not on the server is reported after saving');
      reset();
    });

    // ── UX-5/6/7 ──
    await arm('UX-5..7', async () => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const ph = await ctx.newPage();
      await ph.goto(BASE + '/admin/auth.php');
      await ph.fill('input[name=password]', PASS);
      await Promise.all([ph.waitForNavigation(), ph.press('input[name=password]', 'Enter')]);
      for (const [id, url] of [['UX-5', '/admin/backups.php'], ['UX-6', '/admin/audit-log.php'], ['UX-7', '/admin/edit.php?sku=IP12GA']]) {
        await ph.goto(BASE + url, { waitUntil: 'networkidle' });
        const w = await ph.evaluate(() => document.documentElement.scrollWidth);
        note(w <= 390, `${id}: ${url} fits a 390 px phone screen (no sideways scroll)`, `scrollWidth ${w}`);
      }
      await ctx.close();
    });

    // ── UX-8 ──
    await arm('UX-8', async () => {
      reset();
      const r = await a.req('GET', '/admin/upload-image.php?sku=CC');
      note(!/external — not stored/.test(r.body), 'UX-8: a photo shipped with the website is not labelled "external"');
    });

    // ── UX-9 ──
    await arm('UX-9', async () => {
      reset();
      await saveEdit(a, 'CC', (f) => set(f, 'caption', 'UX9 caption'));
      const file = newestBackup('products-all');
      const rr = await restore(a, file);
      const msg = successOf(rr.body);
      note(/\d{4}-\d\d-\d\d \d\d:\d\d:\d\d/.test(msg) && !msg.includes(file), 'UX-9: the restore message shows the date and time as listed, not the backup file name', msg.slice(0, 200));
      reset();
    });

    // ── UX-11 ──
    await arm('UX-11', async () => {
      const post = (i) => new Promise((resolve) => {
        const body = new URLSearchParams({ form_type: 'rfq', name: 'Pat Buyer', email: 'pat@example.com', company: 'Acme', phone: '630-555-0123',
          partNumber: 'IP33PO-' + i, material: 'Polyolefin', quantity: '500 ft #' + i, requiredDate: 'ASAP', specialReqs: 'none', additionalNotes: 'note ' + i }).toString();
        const req = require('http').request({ host: '127.0.0.1', port: PORT, method: 'POST', path: '/contact.php',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), Referer: BASE + '/contact', 'X-Requested-With': 'XMLHttpRequest' } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
        req.end(body);
      });
      const badgeNow = async () => +((/class="nav-badge"[^>]*>(\d+)</.exec((await a.req('GET', '/admin/index.php')).body) || [])[1] || 0);
      const LOG = path.join(SITE, 'admin', 'inquiries.jsonl');
      const n0 = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').length : 0;
      const b0 = await badgeNow();
      const codes = [];
      for (let i = 1; i <= 6; i++) codes.push(await post(i));
      const lines = fs.readFileSync(LOG, 'utf8').trim().split('\n').slice(n0).map((l) => JSON.parse(l));
      const rl = lines.find((e) => e.type === 'rate-limited');
      note(codes[5] === 429 && rl && rl.quantity === '500 ft #6' && rl.part === 'IP33PO-6', 'UX-11: a rate-limited quote request keeps its part number and quantity', `codes ${codes} entry ${JSON.stringify(rl || null).slice(0, 200)}`);
      const b1 = await badgeNow();
      note(lines.length === 6 && b1 - b0 === 6, 'UX-11: all six requests — five delivered, one rate-limited — raise the new-inquiries badge', `badge ${b0} → ${b1}, ${lines.length} new log lines`);
    });

    // ── UX-12 ──
    await arm('UX-12', async () => {
      reset();
      await page.goto(BASE + '/admin/settings.php');
      await page.fill('#addr_city', '');
      await page.dispatchEvent('#addr_city', 'input');
      const t = await page.textContent('#settings-preview');
      note(/Bolingbrook/.test(t), 'UX-12: with City emptied, the preview shows the original city the site falls back to', t.slice(0, 200));
      // The preview's fallback list must be App.jsx SITE_DEFAULTS, value for value.
      const app = fs.readFileSync(path.join(ROOT, 'src', 'App.jsx'), 'utf8');
      const o = app.indexOf('{', app.indexOf('const SITE_DEFAULTS = {'));
      let dep = 0, e = o;
      for (; e < app.length; e++) {
        const ch = app[e];
        if (ch === '/' && app[e + 1] === '/') { e = app.indexOf('\n', e); continue; }
        if (ch === '/' && app[e + 1] === '*') { e = app.indexOf('*/', e + 2) + 1; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { for (e++; app[e] !== ch; e++) if (app[e] === '\\') e++; continue; }
        if (ch === '{') dep++; else if (ch === '}' && --dep === 0) break;
      }
      const SD = eval('(' + app.slice(o, e + 1) + ')');
      const MAP = { company_name: SD.company.name, company_foundedYear: SD.company.foundedYear, contact_phone: SD.contact.phone, contact_email: SD.contact.email,
        addr_street: SD.address.street, addr_city: SD.address.city, addr_state: SD.address.state, addr_zip: SD.address.zip, hours_text: SD.hours.text,
        cert_iso: SD.certifications.iso, stats_min: SD.stats.minimumOrder, stats_feet: SD.stats.feetInStock };
      const php = JSON.parse(execFileSync('php', ['-r', `require ${JSON.stringify(path.join(ROOT, 'admin', 'config.php'))}; echo json_encode(SITE_INFO_PREVIEW_DEFAULTS, JSON_UNESCAPED_UNICODE);`]).toString());
      note(JSON.stringify(php) === JSON.stringify(MAP), 'UX-12: the preview fallbacks equal App.jsx SITE_DEFAULTS', `php ${JSON.stringify(php)}\n       js  ${JSON.stringify(MAP)}`);
    });

    // ── SEC-A1/A2 ──
    await arm('SEC-A', async () => {
      const cfg = path.join(ROOT, 'admin', 'config.php');
      const k = execFileSync('php', ['-r', `require ${JSON.stringify(cfg)}; echo login_throttle_key('::ffff:203.0.113.5'), '|', login_throttle_key('::ffff:198.51.100.9'), '|', login_throttle_key('2001:db8::1');`]).toString();
      note(k === '203.0.113.5|198.51.100.9|2001:db8::/64', 'SEC-A1: IPv4-mapped IPv6 clients are throttled as their own IPv4 address; real IPv6 still on its /64', k);
      const x = execFileSync('php', ['-r', `define('TRUST_PROXY_FORWARDED', true); $_SERVER['REMOTE_ADDR']='10.9.9.9'; $_SERVER['HTTP_X_FORWARDED_FOR']='10.0.0.7, 203.0.113.99'; require ${JSON.stringify(cfg)}; echo login_throttle_client_ip();`]).toString();
      note(x === '203.0.113.99', 'SEC-A2: behind a trusted proxy the throttle keys on the right-most X-Forwarded-For entry (the one the proxy added)', x);
    });
  } finally {
    await browser.close();
    srv.kill(); lim.kill();
  }
  const bad = results.filter((x) => !x.ok).length;
  console.log(`\nadminaudit11 ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
