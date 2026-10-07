/**
 * PLAN-12 §9.3 — the citation gate. A finding's `where` entries are checked
 * against the tree: the file exists, the line exists, and the quoted text is on
 * that line (±2, whitespace-normalised). A finding whose citation does not hold
 * is not sent to verification; it goes back to its finder.
 *
 * Why a script: AUDIT-11 published five numbers that did not reproduce, and
 * prior passes cited line numbers from a file that had since moved
 * (audit-runs/missed-coverage.md). A model-written `file:line` is a claim like
 * any other.
 *
 *   node _harness/audit12-cite.js                       check _harness/out/audit12/findings/*.json
 *   node _harness/audit12-cite.js path/to/finding.json  check one file
 *
 * Finding file: one object, or an array of objects, each with
 *   { id, rows: ["FILE-0001", ...], where: [{ file, line, quote }], ... }
 * `rows` must exist in _harness/out/audit12/ledger.jsonl. A `where` entry with
 * `url` instead of `file` (a rendered-page observation) is skipped here — its
 * evidence is an artifact path, which must exist.
 * Exit 1 if any citation fails.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'audit12');
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

const ledgerFile = path.join(OUT, 'ledger.jsonl');
const ledgerIds = fs.existsSync(ledgerFile)
  ? new Set(fs.readFileSync(ledgerFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id))
  : null;

const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : (fs.existsSync(path.join(OUT, 'findings')) ? fs.readdirSync(path.join(OUT, 'findings')).filter((f) => f.endsWith('.json')).map((f) => path.join(OUT, 'findings', f)) : []);

let checked = 0;
const fails = [];
for (const t of targets) {
  let list;
  try { list = JSON.parse(fs.readFileSync(t, 'utf8')); } catch (e) { fails.push(`${t}: not JSON (${e.message})`); continue; }
  for (const f of Array.isArray(list) ? list : [list]) {
    const tag = `${path.basename(t)} ${f.id || '(no id)'}`;
    if (!f.id) fails.push(`${tag}: no id`);
    if (!Array.isArray(f.where) || !f.where.length) { fails.push(`${tag}: no where[]`); continue; }
    if (!Array.isArray(f.rows) || !f.rows.length) fails.push(`${tag}: no ledger rows`);
    else if (ledgerIds) for (const r of f.rows) if (!ledgerIds.has(r)) fails.push(`${tag}: ledger row ${r} does not exist`);
    for (const w of f.where) {
      checked++;
      if (w.url) {
        if (!w.artifact || !fs.existsSync(path.resolve(ROOT, w.artifact))) fails.push(`${tag}: ${w.url} cites artifact ${w.artifact || '(none)'} which does not exist`);
        continue;
      }
      const abs = path.resolve(ROOT, w.file || '');
      if (!w.file || !abs.startsWith(ROOT + path.sep) || !fs.existsSync(abs)) { fails.push(`${tag}: file ${w.file} does not exist`); continue; }
      const lines = fs.readFileSync(abs, 'utf8').split('\n');
      const n = Number(w.line);
      if (!Number.isInteger(n) || n < 1 || n > lines.length) { fails.push(`${tag}: ${w.file}:${w.line} out of range (1–${lines.length})`); continue; }
      const q = norm(w.quote || '');
      if (q.length < 6) { fails.push(`${tag}: ${w.file}:${n} quote missing or under 6 characters`); continue; }
      const window = norm(lines.slice(Math.max(0, n - 3), n + 2).join(' '));
      if (!window.includes(q)) {
        const at = lines.findIndex((l) => norm(l).includes(q));
        fails.push(`${tag}: ${w.file}:${n} does not contain "${q.slice(0, 60)}"${at >= 0 ? ` (found at line ${at + 1})` : ' (not on any single line of the file)'}`);
      }
    }
  }
}
console.log(`audit12-cite: ${targets.length} file(s), ${checked} citation(s), ${fails.length} failure(s)`);
for (const f of fails) console.log('  FAIL ' + f);
if (!targets.length) console.log('  (nothing to check)');
process.exit(fails.length ? 1 : 0);
