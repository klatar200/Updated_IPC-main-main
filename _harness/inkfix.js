/**
 * Corrective pass for inkpatch3.js's mis-classifications.
 *
 * inkpatch3 resolves a call site's surface by nearest-preceding-anchor. That
 * treats anything inside the Navbar's span as sitting on --brand-dark, but
 * several blocks in there (and one on the FAQ page) set a HARDCODED dark
 * background instead:
 *
 *   #0e2847  the two mega-menu panels
 *   #0a2444  the mobile drawer
 *   #141414  the FAQ "Still have questions?" card
 *   #0a2240  the footer
 *
 * None of those is owner-controlled, so their text must stay white. Giving them
 * a brand ink is actively harmful: on a pale palette the ink resolves to
 * #141414 and the FAQ card rendered #141414 text on a #141414 background —
 * 1:1, measured by _harness/inkaudit.js. This reverts exactly those sites.
 *
 * Delta-only (GUARDRAILS §5): it rewrites nothing that is not inside one of the
 * fixed-background regions.
 *
 * Usage: node _harness/inkfix.js [--write]
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../src/App.jsx');
const src = fs.readFileSync(FILE, 'utf8');

// Every background anchor, brand and fixed alike, so "nearest wins" is honest.
const MARKERS = [
  { re: /background:\s*"#0e2847"/g, surface: 'FIXED' },
  { re: /background:\s*"#0a2444"/g, surface: 'FIXED' },
  { re: /background:\s*"#141414"/g, surface: 'FIXED' },
  { re: /background:\s*"#0a2240"/g, surface: 'FIXED' },
  { re: /background:\s*\n?\s*"linear-gradient\(135deg, rgba\(20,20,20/g, surface: 'FIXED' },
  { re: /background:\s*"linear-gradient\(135deg, var\(--brand-primary\) 0%, var\(--brand-accent-2\) 100%\)"/g, surface: 'brand' },
  { re: /className="ipc-page-header"/g, surface: 'brand' },
  { re: /background(?:Color)?:\s*"var\(--brand-dark\)"/g, surface: 'brand' },
  { re: /background(?:Color)?:\s*"var\(--brand-primary\)"/g, surface: 'brand' },
  { re: /background:\s*active\s*\?\s*"var\(--brand-primary\)"/g, surface: 'brand' },
  { re: /background:\s*!mobileFamily\s*\?\s*"var\(--brand-primary\)"/g, surface: 'brand' },
  // A white/transparent background ends a dark region just as definitively.
  { re: /background:\s*"#ffffff"/g, surface: 'LIGHT' },
  { re: /background:\s*"#f5f7fa"/g, surface: 'LIGHT' },
  { re: /className="bg-white"/g, surface: 'LIGHT' },
];

const anchors = [];
for (const mk of MARKERS) {
  const re = new RegExp(mk.re.source, 'g');
  let m;
  while ((m = re.exec(src))) anchors.push({ at: m.index, surface: mk.surface });
}
anchors.sort((a, b) => a.at - b.at);

function nearest(i) {
  let best = null;
  for (const a of anchors) { if (a.at > i) break; best = a; }
  return best;
}

// Anything inkpatch3 wrote.
const INKED = /"rgba\(var\(--brand-(?:primary|dark|header)-ink-rgb\),\s*([0-9.]+)\)"|"var\(--brand-(?:primary|dark|header)-ink\)"/g;

const edits = [];
let m;
while ((m = INKED.exec(src))) {
  const a = nearest(m.index);
  if (!a || a.surface !== 'FIXED') continue;
  const alpha = m[1];
  const to = alpha !== undefined ? `"rgba(255,255,255,${alpha})"` : '"#ffffff"';
  edits.push({ start: m.index, end: m.index + m[0].length, from: m[0], to, anchorAt: a.at });
}

let out = '';
let cursor = 0;
for (const e of edits) {
  const line = src.slice(0, e.start).split('\n').length;
  const anchorLine = src.slice(0, e.anchorAt).split('\n').length;
  console.log(`  App.jsx:${String(line).padEnd(6)} revert ${e.from.padEnd(46)} -> ${e.to}`);
  console.log(`           (fixed background declared at line ${anchorLine})`);
  out += src.slice(cursor, e.start) + e.to;
  cursor = e.end;
}
out += src.slice(cursor);

console.log(`\n${edits.length} reverts inside fixed-background regions`);
if (process.argv.includes('--write')) {
  fs.writeFileSync(FILE, out);
  console.log('written to src/App.jsx');
} else {
  console.log('dry run — pass --write to apply');
}
