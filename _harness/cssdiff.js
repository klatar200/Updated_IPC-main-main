/**
 * Diff the SELECTORS emitted into the CSS bundle against a reference copy.
 *
 * Tailwind's extractor scans raw source TEXT, comments included, so a bare word
 * in an App.jsx comment that happens to be a utility class name emits that whole
 * rule into the shipped CSS. It has happened twice here (`.ring`, `.grow`) and
 * both times the comment written to explain it reproduced the bug. The build
 * summary's byte count does not catch it — a rule added and a rule removed can
 * net to the same size.
 *
 * Usage:
 *   node _harness/cssdiff.js --save          snapshot the current bundle
 *   node _harness/cssdiff.js                 diff current against the snapshot
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SNAP = path.join(__dirname, 'out', 'cssdiff-selectors.json');

function currentSelectors() {
  const dir = path.join(ROOT, 'dist', 'assets');
  const file = fs.readdirSync(dir).find((f) => f.endsWith('.css'));
  if (!file) throw new Error('no css bundle in dist/assets');
  const css = fs.readFileSync(path.join(dir, file), 'utf8');
  // Strip at-rule preludes and declaration bodies, keep selector text.
  const sels = new Set();
  const re = /(^|[}])\s*([^{}@][^{}]*)\{/g;
  let m;
  while ((m = re.exec(css))) {
    for (const s of m[2].split(',')) {
      const t = s.trim().replace(/\s+/g, ' ');
      if (t) sels.add(t);
    }
  }
  return { file, sels: [...sels].sort() };
}

const { file, sels } = currentSelectors();

if (process.argv.includes('--save')) {
  fs.mkdirSync(path.dirname(SNAP), { recursive: true });
  fs.writeFileSync(SNAP, JSON.stringify({ file, sels }, null, 2));
  console.log(`saved ${sels.length} selectors from ${file} -> ${SNAP}`);
  process.exit(0);
}

if (!fs.existsSync(SNAP)) {
  console.log('no snapshot yet — run with --save first');
  process.exit(2);
}

const prev = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
const before = new Set(prev.sels);
const after = new Set(sels);
const added = sels.filter((s) => !before.has(s));
const removed = prev.sels.filter((s) => !after.has(s));

console.log(`reference: ${prev.file}  (${prev.sels.length} selectors)`);
console.log(`current  : ${file}  (${sels.length} selectors)`);
console.log(`\nADDED   (${added.length}):`);
for (const s of added) console.log('  + ' + s);
console.log(`\nREMOVED (${removed.length}):`);
for (const s of removed) console.log('  - ' + s);
