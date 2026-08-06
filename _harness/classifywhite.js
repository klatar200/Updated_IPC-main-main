/**
 * Classify each remaining `text-white` in src/App.jsx by the nearest enclosing
 * background declaration, brand or fixed, so the swap to an ink utility class
 * is a decision rather than a guess. Reports only; changes nothing.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/App.jsx'), 'utf8');

const MARKERS = [
  { re: /background:\s*"#0e2847"/g, s: 'FIXED #0e2847' },
  { re: /background:\s*"#0a2444"/g, s: 'FIXED #0a2444' },
  { re: /background:\s*"#141414"/g, s: 'FIXED #141414' },
  { re: /background:\s*"#0a2240"/g, s: 'FIXED #0a2240' },
  { re: /background:\s*\n?\s*"linear-gradient\(135deg, rgba\(20,20,20/g, s: 'FIXED hero-scrim' },
  { re: /background:\s*"linear-gradient\(135deg, var\(--brand-primary\) 0%, var\(--brand-accent-2\) 100%\)"/g, s: 'header' },
  { re: /className="ipc-page-header"/g, s: 'header' },
  { re: /background(?:Color)?:\s*"var\(--brand-dark\)"/g, s: 'dark' },
  { re: /background(?:Color)?:\s*"var\(--brand-primary\)"/g, s: 'primary' },
  { re: /background:\s*"#ffffff"/g, s: 'LIGHT' },
  { re: /background:\s*"#f5f7fa"/g, s: 'LIGHT' },
  { re: /background:\s*"transparent"/g, s: 'TRANSPARENT (inherits)' },
];

const anchors = [];
for (const mk of MARKERS) {
  const re = new RegExp(mk.re.source, 'g');
  let m;
  while ((m = re.exec(src))) anchors.push({ at: m.index, s: mk.s });
}
anchors.sort((a, b) => a.at - b.at);

const re = /text-white/g;
let m;
while ((m = re.exec(src))) {
  const line = src.slice(0, m.index).split('\n').length;
  let best = null;
  for (const a of anchors) { if (a.at > m.index) break; best = a; }
  const anchorLine = best ? src.slice(0, best.at).split('\n').length : '-';
  const dist = best ? m.index - best.at : Infinity;
  // A little surrounding text makes the call reviewable.
  const ctx = src.slice(m.index - 90, m.index + 60).replace(/\s+/g, ' ');
  console.log(`App.jsx:${String(line).padEnd(6)} -> ${String(best ? best.s : '(none)').padEnd(24)} (declared L${anchorLine}, ${dist} chars back)`);
  console.log(`   …${ctx}…\n`);
}
