/**
 * 4.23 second pass — the brand-colored call sites whose background lives on a
 * PARENT element, so the object-local pass in inkpatch.js could not see them.
 *
 * Each entry was classified by reading the enclosing JSX (see
 * _harness/findwhite.js output), not by pattern-matching:
 *
 *   373, 384      navbar brand text            <header background var(--brand-dark)>
 *   6466, 6490    sticky RFQ bar               background var(--brand-dark)
 *   6537          sticky RFQ "additional PDF"  rgba(255,255,255,0.1) OVER var(--brand-dark)
 *   2345, 2349    homepage CTA band            gradient primary -> accent-2
 *   2371          homepage CTA outline button  same gradient
 *
 * DELIBERATELY LEFT WHITE:
 *   1453, 1484, 1521  the hero — its gradient sits under an rgba(20,20,20,0.72)
 *                     scrim, so white is legible at ANY brand color
 *   8720              the footer — background is a hardcoded #0a2240, not a
 *                     brand variable, so the owner cannot make it pale
 *
 * Usage: node _harness/inkpatch2.js [--write]
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../src/App.jsx');
const src = fs.readFileSync(FILE, 'utf8');
const lines = src.split('\n');

const TARGETS = [
  { line: 373, ink: 'var(--brand-dark-ink)', what: 'navbar brand name' },
  { line: 384, ink: 'var(--brand-dark-ink)', what: 'navbar tagline' },
  { line: 2345, ink: 'var(--brand-header-ink)', what: 'CTA band heading' },
  { line: 2349, ink: 'var(--brand-header-ink)', what: 'CTA band sub-text' },
  { line: 2371, ink: 'var(--brand-header-ink)', what: 'CTA band outline button' },
  { line: 6466, ink: 'var(--brand-dark-ink)', what: 'sticky RFQ product name' },
  { line: 6490, ink: 'var(--brand-dark-ink)', what: 'sticky RFQ data-sheet link' },
  { line: 6537, ink: 'var(--brand-dark-ink)', what: 'sticky RFQ additional-PDF link' },
];

const WHITE = /color:\s*"#(?:fff|ffffff)"/i;
let changed = 0;
const problems = [];

for (const t of TARGETS) {
  // The style object opens at t.line; the color may be a few lines below it.
  let found = -1;
  for (let i = t.line - 1; i < Math.min(lines.length, t.line + 14); i++) {
    if (WHITE.test(lines[i])) { found = i; break; }
  }
  if (found < 0) { problems.push(`no white foreground near line ${t.line} (${t.what})`); continue; }
  lines[found] = lines[found].replace(WHITE, `color: "${t.ink}"`);
  changed++;
  console.log(`  App.jsx:${String(found + 1).padEnd(6)} ${t.what.padEnd(30)} -> ${t.ink}`);
}

if (problems.length) {
  console.error('\n' + problems.join('\n'));
  process.exit(1);
}

console.log(`\n${changed}/${TARGETS.length} replaced`);
if (process.argv.includes('--write')) {
  fs.writeFileSync(FILE, lines.join('\n'));
  console.log('written to src/App.jsx');
} else {
  console.log('dry run — pass --write to apply');
}
