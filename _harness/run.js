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
const SCORE = /(\d+\s*\/\s*\d+)|(\d+ of \d+)|combinations meet/;
let failed = 0;

for (const s of suites) {
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
}

console.log(`\n${suites.length - failed}/${suites.length} suites exited clean`);
process.exit(failed === 0 ? 0 : 1);
