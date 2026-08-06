/**
 * The brand-primary-as-text sites that fgpatch.js's exact-string match missed:
 * ternary branches and a single-quoted value. All are the brand color used as
 * TEXT on a light background (measured — primary-as-text never appears on a
 * dark one), so all take --brand-primary-text.
 *
 * In the three ternaries the OTHER branch is already an ink because that state
 * paints on a brand-colored background; only the non-active branch changes.
 *
 * `scrollbar-color` is deliberately untouched — it is not text.
 *
 * Usage: node _harness/fgpatch2.js [--write]
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../src/App.jsx');
const lines = fs.readFileSync(FILE, 'utf8').split('\n');

const EDITS = [
  { find: ': "var(--brand-primary)",', what: 'ternary else-branch (breadcrumb / dropdown / sort header)' },
  { find: 'hasActive ? "var(--brand-primary)"', what: 'sidebar family heading, active' },
  { find: 'active ? "var(--brand-primary)"', what: 'sidebar product row, active' },
  { find: "'var(--brand-primary)'", what: 'single-quoted spec-table label' },
];

let changed = 0;
lines.forEach((line, i) => {
  // Never touch scrollbar-color, which is not text.
  if (line.includes('scrollbar-color')) return;
  for (const e of EDITS) {
    if (!line.includes(e.find)) continue;
    const before = line;
    lines[i] = lines[i].split(e.find).join(e.find.replace('--brand-primary)', '--brand-primary-text)'));
    if (lines[i] !== before) {
      console.log(`  App.jsx:${String(i + 1).padEnd(6)} ${e.what}`);
      changed++;
    }
    break;
  }
});

console.log(`\n${changed} replacements`);
if (process.argv.includes('--write')) {
  fs.writeFileSync(FILE, lines.join('\n'));
  console.log('written to src/App.jsx');
} else {
  console.log('dry run — pass --write to apply');
}
