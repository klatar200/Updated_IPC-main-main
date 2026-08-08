/**
 * One-shot: line endings and byte counts for data/ vs _harness/pristine/.
 * Written 2026-08-08 for the PLAN-8 baseline — the plan's completion criterion
 * is `cmp` byte-identity between the two, and on a core.autocrlf=true checkout
 * that can fail for line endings alone rather than for content.
 */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');

const FILES = ['products-all.json', 'content.json', 'site-info.json'];
for (const name of FILES) {
  for (const rel of [`data/${name}`, `_harness/pristine/${name}`]) {
    const b = fs.readFileSync(path.join(R, rel));
    let cr = 0, lf = 0;
    for (let i = 0; i < b.length; i++) {
      if (b[i] === 13) cr++;
      if (b[i] === 10) lf++;
    }
    console.log(rel.padEnd(42), 'bytes=' + String(b.length).padStart(7), 'CR=' + String(cr).padStart(6), 'LF=' + String(lf).padStart(6));
  }
  console.log('');
}
