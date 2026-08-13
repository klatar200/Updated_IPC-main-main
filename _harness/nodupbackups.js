/**
 * F1/F2 — a save that changes nothing writes nothing.
 *
 * The defect: backup_before_write() copied the live file on every single write,
 * with no content comparison of any kind, and eleven save_*() call sites across
 * eight files route through it — every photo upload, PDF upload, add, delete
 * and restore is a full-catalog save. The Backups page filled with runs of
 * entries that were all "42 products / 241 KB".
 *
 * The damage is not disk space, it is EVICTION. BACKUP_KEEP is 30, so thirty
 * duplicate copies of the current state push the one pre-mistake copy off the
 * end of the list — which is precisely the recovery help.php promises.
 *
 * What this asserts, end to end through the real admin rather than by calling
 * the PHP directly, because the thing being fixed is what happens when the
 * owner presses Save:
 *
 *   1. Re-saving an unchanged page writes NO new backup and does not touch the
 *      live file's bytes.
 *   2. That no-op still SUCCEEDS — it redirects, and the page reports "No
 *      changes to save" rather than an error. A no-op that surfaced an error
 *      would strand the optimistic-concurrency pages (F3).
 *   3. The concurrency signature still round-trips after a no-op: an immediate
 *      second save from the reloaded page is accepted, not rejected as stale.
 *   4. A save that DOES change something still writes exactly one backup — the
 *      fix must not have disabled backups altogether.
 *
 * Runs against Business Details (settings.php / site-info.json) because it is
 * the smallest of the three forms and carries a signature.
 *
 * Usage: node _harness/nodupbackups.js      (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const DATA = path.join(__dirname, 'site', 'data');
const OUT = path.join(__dirname, 'out', 'nodupbackups');
fs.mkdirSync(OUT, { recursive: true });

const backups = () => (fs.readdirSync(DATA) || []).filter(f => /^site-info\.backup\./.test(f)).sort();
const liveBytes = () => fs.readFileSync(path.join(DATA, 'site-info.json'));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); };

(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  await p.goto(BASE + '/admin/index.php', { waitUntil: 'domcontentloaded' });
  if (await p.$('input[type=password]')) {
    await p.fill('input[type=password]', PW);
    await p.click('button[type=submit]');
    await p.waitForLoadState('domcontentloaded');
  }

  const save = async () => {
    await p.click('button[type=submit].btn-primary, .form-actions button[type=submit]');
    await p.waitForLoadState('domcontentloaded');
    await p.waitForTimeout(150);
  };

  // ── 0: settle the form ───────────────────────────────────────────────────
  //
  // The FIRST save against a pristine site-info.json is a real change, and
  // correctly so: settings.php rebuilds the file from the form (invariant 4),
  // and the form carries two fields the shipped file does not — social.instagram
  // and social.tiktok — which arrive as "" and are written. Measured against a
  // fresh mirror the diff is exactly those two keys plus the resulting key
  // reordering. So the baseline for "unchanged" is AFTER one save, not before
  // it. Getting this wrong is what made the first run of this suite report 2/9
  // against a working implementation.
  //
  // Worth knowing for the live site too: the owner's first Save on Business
  // Details will still write one backup. Every one after it is free.
  await p.goto(BASE + '/admin/settings.php', { waitUntil: 'domcontentloaded' });
  await save();
  ok(/[?&]saved=1/.test(p.url()),
    'first save against a pristine file is a REAL change (adds the two empty social fields)');

  // ── 1 + 2: unchanged save ────────────────────────────────────────────────
  await p.goto(BASE + '/admin/settings.php', { waitUntil: 'domcontentloaded' });
  const before = backups(), beforeBytes = liveBytes();
  await save();
  const after = backups(), afterBytes = liveBytes();

  ok(after.length === before.length,
    `unchanged save wrote no backup (${before.length} -> ${after.length})`);
  ok(Buffer.compare(beforeBytes, afterBytes) === 0,
    'unchanged save left site-info.json byte-identical');
  ok(/[?&]saved=nochange/.test(p.url()),
    `unchanged save redirected as a success (${p.url().split('/').pop()})`);

  const banner = await p.evaluate(() => {
    const i = document.querySelector('.alert-info');
    const s = document.querySelector('.alert-success');
    return { info: i && i.textContent.trim().slice(0, 40), success: s && s.textContent.trim().slice(0, 30) };
  });
  ok(!!banner.info && !banner.success,
    `reported "No changes to save", not a green Saved banner (${JSON.stringify(banner)})`);

  // ── 3: the signature still round-trips after a no-op ─────────────────────
  await save();
  ok(/[?&]saved=nochange/.test(p.url()),
    'a second save straight after the no-op is still accepted (signature refreshed, not stale)');
  ok(backups().length === before.length,
    `still no backups after the second no-op (${backups().length})`);

  // ── 4: a real change still backs up ──────────────────────────────────────
  const field = await p.$('input[name="contact[fax]"]') || await p.$('input[type=text]');
  const original = await field.inputValue();
  const marker = '555-0100-' + String(before.length);
  await field.fill(marker);
  await save();
  const changed = backups();
  ok(changed.length === before.length + 1,
    `a real change wrote exactly one backup (${before.length} -> ${changed.length})`);
  ok(/[?&]saved=1/.test(p.url()), 'a real change reports the normal Saved banner');

  // put it back (this is itself a real change, so it writes one more backup)
  const field2 = await p.$('input[name="contact[fax]"]') || await p.$('input[type=text]');
  await field2.fill(original);
  await save();
  ok(backups().length === before.length + 2,
    'restoring the original value wrote its own backup (it is a real change too)');

  fs.writeFileSync(path.join(OUT, 'nodupbackups.json'), JSON.stringify({ pass, fail }, null, 2));
  console.log(`\nnodupbackups ${pass}/${pass + fail}`);
  await b.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
