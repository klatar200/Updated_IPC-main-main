/**
 * Three transparent "outline" buttons were given --brand-primary-ink because
 * they sit immediately after a sibling button that declares
 * background: "var(--brand-primary)". They are transparent, so their text is
 * painted on the CONTAINER, not on the sibling:
 *
 *   2918  on the About CTA card      -> --brand-dark
 *   3338  on the FAQ card (#141414)  -> stays white, not a brand surface
 *   8471  on the Services CTA card   -> --brand-dark
 *
 * "Nearest preceding background" cannot see that a sibling's background is not
 * an ancestor's. Verified against the rendered tree.
 *
 * Usage: node _harness/inkfix2.js [--write]
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../src/App.jsx');
const lines = fs.readFileSync(FILE, 'utf8').split('\n');

const FIXES = [
  { line: 2918, to: '"rgba(var(--brand-dark-ink-rgb), 0.7)"', why: 'About CTA card sits on --brand-dark' },
  { line: 3338, to: '"rgba(255,255,255,0.7)"', why: 'FAQ card background is a hardcoded #141414' },
  { line: 8471, to: '"rgba(var(--brand-dark-ink-rgb), 0.7)"', why: 'Services CTA card sits on --brand-dark' },
];

const FROM = /"rgba\(var\(--brand-primary-ink-rgb\), 0\.7\)"/;

let bad = 0;
for (const f of FIXES) {
  const i = f.line - 1;
  if (!FROM.test(lines[i] || '')) {
    console.error(`FAIL line ${f.line} does not carry the expected value: ${JSON.stringify((lines[i] || '').trim())}`);
    bad++;
    continue;
  }
  lines[i] = lines[i].replace(FROM, f.to);
  console.log(`  App.jsx:${f.line}  -> ${f.to}\n      ${f.why}`);
}

if (!bad && process.argv.includes('--write')) {
  fs.writeFileSync(FILE, lines.join('\n'));
  console.log('\nwritten to src/App.jsx');
} else if (!bad) {
  console.log('\ndry run — pass --write to apply');
}
process.exit(bad ? 1 : 0);
