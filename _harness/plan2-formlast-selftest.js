/**
 * Proves plan2-formlast.js actually catches a field added after the sentinel.
 *
 * PLAN-2 acceptance: "Prove it can fail: temporarily add a field after
 * form_complete, watch the check go red, remove it, watch it go green. Paste
 * both."
 *
 * The field is added to the MIRROR's copy of content.php, never to the repo's,
 * so an interrupted run cannot leave the real admin carrying a stray field
 * below the truncation sentinel — which is the exact defect under test.
 *
 * Usage: node _harness/plan2-formlast-selftest.js
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MIRROR = path.join(__dirname, 'site/admin/content.php');
const SOURCE = path.join(__dirname, '../admin/content.php');
const SENTINEL = '<input type="hidden" name="form_complete" value="1">';
const INTRUDER = '\n    <input type="hidden" name="added_after_the_sentinel" value="1">';

function runCheck() {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'plan2-formlast.js')], { encoding: 'utf8' });
  const line = (r.stdout || '').trim().split('\n').filter((l) => l.startsWith('plan2-formlast')).pop();
  return { status: r.status, summary: line || '(no summary)', out: r.stdout || '' };
}

function restoreMirror() {
  fs.copyFileSync(SOURCE, MIRROR);
}

let bad = 0;

// ── 1. green against the real file ──────────────────────────────────────────
restoreMirror();
const before = runCheck();
console.log(`[1] unmodified mirror        -> exit ${before.status}  ${before.summary}`);
if (before.status !== 0) { console.log('    FAIL: expected green before mutating'); bad++; }

// ── 2. add a field AFTER the sentinel ───────────────────────────────────────
const src = fs.readFileSync(MIRROR, 'utf8');
if (!src.includes(SENTINEL)) {
  console.log('    FAIL: sentinel not found in the mirror');
  process.exit(1);
}
fs.writeFileSync(MIRROR, src.replace(SENTINEL, SENTINEL + INTRUDER));

const during = runCheck();
console.log(`[2] field after the sentinel -> exit ${during.status}  ${during.summary}`);
const caught = during.status !== 0 && /form_complete is the LAST/.test(during.out);
if (!caught) {
  console.log('    FAIL: the check STAYED GREEN with a field below the sentinel');
  bad++;
} else {
  const detail = (during.out.match(/→ last was .*/) || [])[0];
  console.log(`    caught it: ${detail}`);
}

// ── 3. remove it, green again ───────────────────────────────────────────────
restoreMirror();
const after = runCheck();
console.log(`[3] field removed            -> exit ${after.status}  ${after.summary}`);
if (after.status !== 0) { console.log('    FAIL: did not return to green'); bad++; }

console.log(`\nplan2-formlast-selftest ${bad === 0 ? 'PASS' : 'FAIL'} — the check fails when it should and passes when it should`);
process.exit(bad === 0 ? 0 : 1);
