/**
 * Reads an AUDIT-10 state file (plans/audit10/state/<name>) for the audit10-*
 * probes that consume one.
 *
 * That folder was deleted in 1d57237 (2026-08-12, "Remove the residue of ten
 * finished plans"), and every probe reading it crashed with ENOENT before it
 * did anything — while _harness/README.md keeps these probes as the only
 * executable form of the AUDIT-10 findings' reproduce steps (AUDIT-12
 * A12-L13-01-5). A file in the folder wins (audit10-stylecensus.js regenerates
 * stylecensus.json there); otherwise the copy committed before the deletion is
 * read from git, which is what the AUDIT-10 records measured.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DELETED_IN = '1d57237';

function readState(name) {
  const live = path.join(ROOT, 'plans', 'audit10', 'state', name);
  if (fs.existsSync(live)) return fs.readFileSync(live, 'utf8');
  try {
    const text = execFileSync('git', ['show', `${DELETED_IN}^:plans/audit10/state/${name}`],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    console.error(`(reading plans/audit10/state/${name} as committed before ${DELETED_IN}, which deleted it)`);
    return text;
  } catch (e) {
    console.error(`audit10state: plans/audit10/state/${name} is missing and not in git history at ${DELETED_IN}^ (a shallow clone?) — nothing was run`);
    process.exit(2);
  }
}

module.exports = { readState };
