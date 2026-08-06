/**
 * brand-color-as-foreground — swap the brand colors used as TEXT for their
 * text-safe variants.
 *
 * --brand-primary as text: every rendered occurrence was measured
 * (_harness/fgsurfaces.js) to sit on white, #f5f7fa or #f8fafc — all light — so
 * all 49 source sites take --brand-primary-text unconditionally.
 *
 * --brand-accent-2 as text lands on THREE different backgrounds needing
 * opposite adjustments, so those 10 sites are mapped individually:
 *
 *   396   navbar tagline            on --brand-dark   -> --brand-accent-on-dark
 *   2435  on #ffffff                                  -> --brand-accent-text
 *   5590  sidebar "PRODUCT CATALOG" on --brand-dark   -> --brand-accent-on-dark
 *   5954  product-detail eyebrow    on a GRADIENT     -> LEFT ALONE
 *   6448  on #f5f7fa                                  -> --brand-accent-text
 *   7477  on a light accent tint                      -> --brand-accent-text
 *   7933  industries bullets on white                 -> --brand-accent-text
 *   8854  footer                    on #0a2240        -> --brand-accent-on-footer
 *   8882  footer                    on #0a2240        -> --brand-accent-on-footer
 *   8941  footer                    on #0a2240        -> --brand-accent-on-footer
 *
 * 5954 is left alone deliberately: it sits on the #0a2a52 -> --brand-primary
 * gradient, which is the brand-gradient-mixed-ends case already recorded in
 * WHATS_LEFT §2 — no single value serves both ends and picking one is a design
 * decision, not a mechanical swap.
 *
 * Usage: node _harness/fgpatch.js [--write]
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../src/App.jsx');
let src = fs.readFileSync(FILE, 'utf8');
const lines = src.split('\n');

// Keyed by ORDINAL, not by line number: adding the textSafeOn helpers shifted
// every line below them and a hardcoded table silently pointed at the wrong
// code. The ordinal is stable as long as no accent-2 text site is added or
// removed, and the count is asserted below.
const ACCENT_ORDER = [
  '--brand-accent-on-dark',      // 1  navbar tagline
  '--brand-accent-text',         // 2  on #ffffff
  '--brand-accent-on-dark',      // 3  sidebar "PRODUCT CATALOG"
  null,                          // 4  product-detail eyebrow — GRADIENT, leave
  '--brand-accent-text',         // 5  on #f5f7fa
  '--brand-accent-text',         // 6  on a light accent tint
  '--brand-accent-text',         // 7  industries bullets on white
  '--brand-accent-on-footer',    // 8  footer
  '--brand-accent-on-footer',    // 9  footer
  '--brand-accent-on-footer',    // 10 footer
];

const accentLines = [];
lines.forEach((l, i) => { if (/color: "var\(--brand-accent-2\)"/.test(l)) accentLines.push(i); });

const problems = [];
if (accentLines.length !== ACCENT_ORDER.length) {
  problems.push(`expected ${ACCENT_ORDER.length} accent-2 text sites, found ${accentLines.length} — the mapping is stale, re-derive it with _harness/fgsurfaces.js`);
}

let accentChanged = 0;
for (let n = 0; n < accentLines.length && !problems.length; n++) {
  const i = accentLines[n];
  const target = ACCENT_ORDER[n];
  const lineStr = String(i + 1);
  if (target === null) {
    console.log(`  App.jsx:${lineStr.padEnd(6)} LEFT ALONE (gradient — brand-gradient-mixed-ends)`);
    continue;
  }
  lines[i] = lines[i].replace('color: "var(--brand-accent-2)"', `color: "var(${target})"`);
  console.log(`  App.jsx:${lineStr.padEnd(6)} -> ${target}`);
  accentChanged++;
}

if (problems.length) {
  console.error('\n' + problems.join('\n'));
  process.exit(1);
}

src = lines.join('\n');

// --brand-primary as text: uniform, every measured occurrence is on a light
// background. Only the `color:` property — never a background or a border.
const before = src;
const primaryCount = (src.match(/color: "var\(--brand-primary\)"/g) || []).length;
src = src.replace(/color: "var\(--brand-primary\)"/g, 'color: "var(--brand-primary-text)"');
// The same value also appears inside hover handlers as a string assignment.
const hoverCount = (src.match(/\.style\.color = "var\(--brand-primary\)"/g) || []).length;
src = src.replace(/\.style\.color = "var\(--brand-primary\)"/g, '.style.color = "var(--brand-primary-text)"');

console.log(`\n  ${primaryCount} × color: var(--brand-primary) -> var(--brand-primary-text)`);
console.log(`  ${hoverCount} × hover-handler color assignment -> var(--brand-primary-text)`);
console.log(`  ${accentChanged} × accent-2 sites remapped, 1 left alone`);

if (src === before && !accentChanged) {
  console.log('\nnothing to do');
  process.exit(0);
}

if (process.argv.includes('--write')) {
  fs.writeFileSync(FILE, src);
  console.log('\nwritten to src/App.jsx');
} else {
  console.log('\ndry run — pass --write to apply');
}
