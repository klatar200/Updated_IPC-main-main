/**
 * NEW-N2-1 / NEW-N2-2 — a damaged or incomplete data file must never be saved
 * over. audit-runs/audit-2026-09-27.md §7.1, verified in §9.1.
 *
 * Every loader maps a file that does not parse onto [] — the same value as
 * "missing" — and the admin took [] as the truth:
 *   N2-2  products-all.json with one stray comma read "0 products", and Add
 *         Product then saved a ONE-product catalog over it, "added successfully"
 *   N2-1  a damaged content.json showed every Page Content section empty and
 *         the next Save wrote [] everywhere (a deletion, invariant 3); a
 *         content.json merely MISSING a section key (the realistic case: a
 *         release adds a section, data/ is never re-uploaded) lost that
 *         section's built-in text on the next ordinary save
 *
 * Own `php -S` on :8707 over the mirror, real pages, 11 checks:
 *   catalog   damaged -> dashboard banner; Add Product refused and the file's
 *             bytes are untouched; a Backups restore still repairs it
 *   content   damaged -> error on arrival; Save refused, bytes untouched
 *   missing   contactTips key removed -> an ordinary Save keeps it absent and
 *             keeps every other section; the control: an existing section is
 *             still saved as it was
 * Restores the mirror's data from pristine/ in a finally.
 *
 *   node _harness/n2-damageddata.js
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(__dirname, 'site');
const DATA = path.join(SITE, 'data');
const PRISTINE = path.join(__dirname, 'pristine');
const PORT = 8707;
const BASE = `http://127.0.0.1:${PORT}`;
const TMP = fs.mkdtempSync('/tmp/ipc-n2-');

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};
const f = (n) => path.join(DATA, n);
const restoreAll = () => {
  for (const n of ['products-all.json', 'content.json', 'site-info.json']) fs.copyFileSync(path.join(PRISTINE, n), f(n));
  for (const x of fs.readdirSync(DATA)) if (/\.backup\./.test(x)) fs.rmSync(f(x));
};

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`n2-damageddata: port ${PORT} is already in use — stop that server first`);
    process.exit(2);
  }
  restoreAll();
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, '-c', path.join(__dirname, 'php-mail.ini'),
    '-d', `sys_temp_dir=${TMP}`, '-d', `session.save_path=${TMP}`, path.join(__dirname, 'router.php')],
    { cwd: ROOT, stdio: 'ignore' });
  let browser = null;
  try {
    browser = await launch();
    await new Promise((r) => setTimeout(r, 800));
    const page = await (await browser.newContext()).newPage();
    page.on('dialog', (d) => d.accept());
    await page.goto(`${BASE}/admin/auth.php`);
    await page.fill('input[type="password"]', 'audit-pass-123');
    await Promise.all([page.waitForLoadState('networkidle'), page.locator('button[type="submit"]').first().click()]);
    const text = () => page.locator('body').innerText();
    const saveContent = () => Promise.all([page.waitForLoadState('networkidle'),
      page.getByRole('button', { name: /Save Content/i }).first().click()]);

    // ── catalog ──
    // One real save first, so Backups has a good catalog to restore.
    await page.goto(`${BASE}/admin/edit.php?sku=CC`);
    await page.fill('[name="caption"]', 'N2 backup seed');
    await Promise.all([page.waitForLoadState('networkidle'), page.getByRole('button', { name: /save/i }).first().click()]);
    const good = fs.readFileSync(f('products-all.json'), 'utf8');
    const broken = good.replace(/\]\s*$/, ',]');                       // one stray comma
    fs.writeFileSync(f('products-all.json'), broken);
    await page.goto(`${BASE}/admin/index.php`);
    note(/products-all\.json[^\n]*damaged|damaged[^\n]*products-all\.json/i.test(await text()),
      'catalog: the dashboard says products-all.json is damaged');
    await page.goto(`${BASE}/admin/add.php`);
    await page.fill('[name="sku"]', 'N2NEW1');
    await page.fill('[name="name"]', 'N2 new product');
    // partType is a required <select>: left empty, the BROWSER blocks the
    // submit and the two checks below pass without the server ever being
    // asked — which is exactly how the first version of this suite read 2
    // false passes against the unfixed code.
    await page.selectOption('[name="partType"]', { index: 1 });
    let posted = false;
    page.once('request', (r) => { if (r.method() === 'POST' && /add\.php/.test(r.url())) posted = true; });
    await Promise.all([page.waitForLoadState('networkidle'), page.getByRole('button', { name: /^Add Product$/ }).click()]);
    const addText = await text();
    note(posted, 'catalog: setup — the Add Product form really reached the server');
    note(fs.readFileSync(f('products-all.json'), 'utf8') === broken,
      'catalog: Add Product did not write over the damaged file (bytes untouched)',
      `file now ${fs.readFileSync(f('products-all.json'), 'utf8').length} bytes, was ${broken.length}`);
    note(!/added successfully/i.test(addText), 'catalog: and it did not say "added successfully"');
    await page.goto(`${BASE}/admin/backups.php`);
    const form = page.locator('form:has(input[name="backup"][value^="products-all.backup."])').first();
    await Promise.all([page.waitForLoadState('networkidle'), form.locator('button[type="submit"]').click()]);
    let parsed = null;
    try { parsed = JSON.parse(fs.readFileSync(f('products-all.json'), 'utf8')); } catch { /* stays null */ }
    note(Array.isArray(parsed) && parsed.length >= 42, 'catalog: a Backups restore still repairs the damaged file',
      parsed ? `${parsed.length} products` : 'still unparseable');

    // ── content damaged ──
    restoreAll();
    const cbroken = fs.readFileSync(f('content.json'), 'utf8').slice(0, -2);
    fs.writeFileSync(f('content.json'), cbroken);
    await page.goto(`${BASE}/admin/content.php`);
    note(/content\.json[^\n]*damaged/i.test(await text()), 'content: Page Content says content.json is damaged on arrival');
    await saveContent();
    note(fs.readFileSync(f('content.json'), 'utf8') === cbroken, 'content: Save did not write over the damaged file (bytes untouched)');
    note(!/Content saved/i.test(await text()), 'content: and it did not say "Content saved"');

    // ── content missing a section ──
    restoreAll();
    const c = JSON.parse(fs.readFileSync(f('content.json'), 'utf8'));
    const tipsBefore = c.contactTips;
    delete c.contactTips;
    fs.writeFileSync(f('content.json'), JSON.stringify(c, null, 4));
    await page.goto(`${BASE}/admin/content.php`);
    await saveContent();
    const after = JSON.parse(fs.readFileSync(f('content.json'), 'utf8'));
    note(Array.isArray(tipsBefore) && tipsBefore.length > 0, 'missing: setup — the shipped contactTips has rows');
    note(!('contactTips' in after), 'missing: an ordinary Save leaves the absent section absent (the website keeps its built-in text)',
      `saved as ${JSON.stringify(after.contactTips)}`);
    note(JSON.stringify(after.faq) === JSON.stringify(c.faq) && JSON.stringify(after.privacySections) === JSON.stringify(c.privacySections),
      'missing: control — the sections that ARE saved come back exactly as they were');
  } finally {
    if (browser) await browser.close();
    srv.kill();
    restoreAll();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nn2-damageddata ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
