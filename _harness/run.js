/**
 * Run a list of harness suites in sequence and print one summary line each.
 *
 * The guard hook blocks `for f in …; do … $f` shell loops, and GUARDRAILS 5
 * asks for a script file rather than inline code, so the regression batches
 * this release runs go through here.
 *
 *   node _harness/run.js invariants plan8-certs brandtext
 */
const path = require('path');
const { spawnSync } = require('child_process');

const suites = process.argv.slice(2);
if (!suites.length) {
  console.error('usage: node _harness/run.js <suite> [suite...]');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..');
// Every `php` a suite spawns (CLI checks, private `php -S` servers) inherits
// this, so it gets the same extensions and Windows sendmail_path as the
// hand-started servers (php-local.js says why both are needed).
if (!process.env.PHP_INI_SCAN_DIR) process.env.PHP_INI_SCAN_DIR = require('./php-local').ensure().scanDir;
const SCORE = /(\d+\s*\/\s*\d+)|(\d+ of \d+)|combinations meet/;
let failed = 0;

// contact.php's per-IP limit is 5 per 10 minutes, and every suite submits from
// 127.0.0.1 into the same temp dir as :8123: after contactflow, the next
// contact suite measured the limiter (429) instead of its own arms. Each suite
// starts from no limiter or auto-reply-cap state; one that needs some sets it.
// (Lock files, ipc_lk_*, are left: a server may hold one.)
const clearContactLimits = () => {
  const dir = require('os').tmpdir();
  let names = [];
  try { names = require('fs').readdirSync(dir); } catch { return; }
  for (const f of names) {
    if (/^ipc_(rl|ar)_[0-9a-f]{32}\.json$/.test(f)) { try { require('fs').unlinkSync(path.join(dir, f)); } catch { /* in use */ } }
  }
};

for (const s of suites) {
  clearContactLimits();
  const r = spawnSync(process.execPath, [path.join(__dirname, `${s}.js`)], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const lines = out.split(/\r?\n/).filter((l) => SCORE.test(l));
  const summary = lines.length ? lines[lines.length - 1].trim() : '(no score line)';
  const crashed = r.status !== 0 && !lines.length;
  if (r.status !== 0) failed++;
  console.log(
    `${String(r.status === 0 ? 'ok  ' : 'FAIL')} ${s.padEnd(22)} ${crashed ? 'CRASHED — ' + out.split(/\r?\n/).filter(Boolean).slice(-3).join(' | ') : summary}`
  );
  // Which checks: a red in a sweep that is green alone (order, timing) is
  // otherwise gone by the time anyone reruns it.
  if (r.status !== 0 && !crashed) {
    const all = out.split(/\r?\n/);
    let shown = 0;
    all.forEach((x, i) => {
      if (!/^\s*FAIL\b/.test(x) || shown++ >= 8) return;
      console.log(`       ${x.trim().slice(0, 220)}`);
      if (/^\s*→/.test(all[i + 1] || '')) console.log(`         ${all[i + 1].trim().slice(0, 220)}`);
    });
  }
}

console.log(`\n${suites.length - failed}/${suites.length} suites exited clean`);
process.exit(failed === 0 ? 0 : 1);
