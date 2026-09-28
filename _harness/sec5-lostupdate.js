/**
 * SEC-5 — two admin saves at once must not silently undo each other.
 * audit-runs/audit-2026-09-27.md SEC-5 / §6.
 *
 * Every catalog writer (add, edit, delete, both uploads) does
 * load_products() -> change one thing -> save_products(), and nothing held a
 * lock across that cycle. So a request that loaded the catalog BEFORE another
 * request saved, and saved AFTER it, wrote its stale copy over the other's
 * change. Measured by V1: an "added successfully" product vanished when a
 * slow photo upload finished; the audit log recorded both actions. edit.php's
 * orig_sig only covers the one record being edited, so it cannot see this.
 *
 * Deterministic, no timing luck: two real PHP processes run the real
 * load_products()/save_products() from the MIRROR's admin/config.php, as POSTs:
 *   A  loads, waits 1.5 s (a slow upload), appends SEC5-A, saves
 *   B  starts 0.3 s after A, loads, appends SEC5-B, saves at once
 * Unfixed, B saves first and A then writes its stale copy over it: SEC5-B is
 * lost although B reported success. Fixed, B waits for A's lock, loads A's
 * result, and both survive. The "B reported success" arm is what makes this
 * the silent version of the bug rather than a visible failure.
 *
 * A third arm races a backup RESTORE (save_products() with no load) against
 * the slow writer: the restore must land after it, not be overwritten by it.
 *
 * Restores the mirror catalog from _harness/pristine/ in a finally and asserts
 * the restore.  node _harness/sec5-lostupdate.js
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SITE = path.join(__dirname, 'site');
const CONFIG = path.join(SITE, 'admin', 'config.php');
const CATALOG = path.join(SITE, 'data', 'products-all.json');
const PRISTINE = path.join(__dirname, 'pristine', 'products-all.json');

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

// $mode: 'add' = load, sleep, append $sku, save.  'restore' = save the
// pristine catalog as-is (what backups.php does), no load.
const driver = (mode, sku, sleepMs) => `
  $_SERVER['REQUEST_METHOD'] = 'POST';
  require ${JSON.stringify(CONFIG)};
  if (${JSON.stringify(mode)} === 'restore') {
    $data = json_decode(file_get_contents(${JSON.stringify(PRISTINE)}), true);
    usleep(${sleepMs} * 1000);
    echo save_products($data) ? 'saved' : 'failed';
    exit;
  }
  $p = load_products();
  usleep(${sleepMs} * 1000);
  $p[] = ['id' => ${JSON.stringify(sku)}, 'sku' => ${JSON.stringify(sku)}, 'name' => 'SEC-5 race ' . ${JSON.stringify(sku)},
          'partType' => 'Accessory', 'description' => [], 'badges' => []];
  echo save_products($p) ? 'saved' : 'failed';
`;
const run = (code) => new Promise((resolve) => {
  const p = spawn('php', ['-r', code]);
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', () => resolve(out.trim()));
});
const skus = () => JSON.parse(fs.readFileSync(CATALOG, 'utf8')).map((p) => p.sku);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try {
    // ── arm 1: two adds ──
    fs.copyFileSync(PRISTINE, CATALOG);
    const n0 = skus().length;
    const a = run(driver('add', 'SEC5-A', 1500));
    await wait(300);
    const b = run(driver('add', 'SEC5-B', 0));
    const [ra, rb] = await Promise.all([a, b]);
    const after = skus();
    note(ra === 'saved' && rb === 'saved', 'both writers report success (as the admin pages would)', `A=${ra} B=${rb}`);
    note(after.includes('SEC5-A'), 'the slow writer\'s product (SEC5-A) is in the catalog', `catalog has ${after.length}`);
    note(after.includes('SEC5-B'), 'the fast writer\'s product (SEC5-B) survives the slow writer\'s save — no lost update',
      'SEC5-B reported "saved" and is gone: the slow writer saved a copy it loaded before SEC5-B existed');
    note(after.length === n0 + 2, `catalog grew by exactly 2 (${n0} -> ${n0 + 2})`, `now ${after.length}`);

    // ── arm 2: a restore racing a slow writer ──
    fs.copyFileSync(PRISTINE, CATALOG);
    const w = run(driver('add', 'SEC5-C', 1500));
    await wait(300);
    const r = run(driver('restore', '', 0));
    const [rw, rr] = await Promise.all([w, r]);
    const final = fs.readFileSync(CATALOG, 'utf8');
    note(rw === 'saved' && rr === 'saved', 'restore arm: both report success', `writer=${rw} restore=${rr}`);
    note(!skus().includes('SEC5-C') && JSON.stringify(JSON.parse(final)) === JSON.stringify(JSON.parse(fs.readFileSync(PRISTINE, 'utf8'))),
      'restore arm: the restore, issued second, is what ends up on disk',
      skus().includes('SEC5-C') ? 'the slow writer saved after the restore and overwrote it with its stale copy' : 'catalog differs from the restored backup');
  } finally {
    fs.copyFileSync(PRISTINE, CATALOG);
  }
  note(fs.readFileSync(CATALOG).equals(fs.readFileSync(PRISTINE)), 'mirror catalog restored byte-for-byte');
  const bad = results.filter((x) => !x.ok).length;
  console.log(`\nsec5-lostupdate ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
